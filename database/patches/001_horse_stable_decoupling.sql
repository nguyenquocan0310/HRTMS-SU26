/* =============================================================================
   Patch 001 — Module C: Tách "Kho ngựa" (Horse Stable) khỏi Giải đấu
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Horses trở thành hồ sơ vĩnh viễn của Owner (bỏ TournamentId).
     • Thêm bảng HorseTournamentEntries = 1 enrollment / (Horse, Tournament),
       mang screening + AdminApproval THEO TỪNG GIẢI (duyệt lại mỗi giải).
     • Pairings đổi composite-FK (TournamentId, HorseId) → trỏ vào enrollment.

   Ghi chú phạm vi:
     • CHỈ bỏ Horses.TournamentId. GIỮ NGUYÊN 4 cột ScreeningStatus /
       ScreeningReason / AdminApprovalStatus / RejectionReason trên Horses
       (baseline profile-level) để các module khác (Pairing/RaceEntry) vẫn
       biên dịch & chạy mà không phải sửa.

   Idempotent: chạy lại nhiều lần đều an toàn (dùng IF EXISTS / IF NOT EXISTS).
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Gỡ các ràng buộc/khóa neo trên Horses(TournamentId, HorseId)
      (phải gỡ FK của Pairings trước vì nó tham chiếu UQ của Horses)
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Pairings_HorseTournament')
    ALTER TABLE Pairings DROP CONSTRAINT FK_Pairings_HorseTournament;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Horses_OwnerRoster')
    ALTER TABLE Horses DROP CONSTRAINT FK_Horses_OwnerRoster;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Horses_Tournament')
    ALTER TABLE Horses DROP CONSTRAINT FK_Horses_Tournament;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Horses_TournamentHorse')
    ALTER TABLE Horses DROP CONSTRAINT UQ_Horses_TournamentHorse;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Horses_Tournament' AND object_id = OBJECT_ID('Horses'))
    DROP INDEX IX_Horses_Tournament ON Horses;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Horses_TournamentApproval' AND object_id = OBJECT_ID('Horses'))
    DROP INDEX IX_Horses_TournamentApproval ON Horses;
GO

/* ---------------------------------------------------------------------------
   2) Bỏ cột Horses.TournamentId (root cause: ép đăng ký lại mỗi giải)
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'TournamentId' AND Object_ID = OBJECT_ID('Horses'))
    ALTER TABLE Horses DROP COLUMN TournamentId;
GO

/* ---------------------------------------------------------------------------
   3) Bảng enrollment mới: HorseTournamentEntries
      1 dòng / (Horse, Tournament); mang screening + AdminApproval theo giải.
      OwnerId denormalized (= Horse.OwnerId) để neo composite-FK roster-check.
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HorseTournamentEntries')
BEGIN
    CREATE TABLE HorseTournamentEntries (
        EnrollmentId        INT             IDENTITY(1,1) NOT NULL,
        HorseId             INT             NOT NULL,
        TournamentId        INT             NOT NULL,
        OwnerId             INT             NOT NULL,            -- = Horse.OwnerId (neo roster-FK)
        [Status]            VARCHAR(20)     NOT NULL DEFAULT 'Enrolled',
        ScreeningStatus     VARCHAR(20)     NOT NULL DEFAULT 'NotScreened',
        ScreeningReason     NVARCHAR(500)   NULL,
        AdminApprovalStatus VARCHAR(20)     NOT NULL DEFAULT 'Pending',
        RejectionReason     NVARCHAR(500)   NULL,
        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT PK_HTE PRIMARY KEY (EnrollmentId),
        CONSTRAINT FK_HTE_Horse FOREIGN KEY (HorseId) REFERENCES Horses(HorseId),
        CONSTRAINT FK_HTE_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
        CONSTRAINT FK_HTE_OwnerRoster FOREIGN KEY (TournamentId, OwnerId)
            REFERENCES TournamentParticipants(TournamentId, UserId),
        CONSTRAINT UQ_HTE_HorseTournament UNIQUE (HorseId, TournamentId),   -- 1 enrollment / giải
        CONSTRAINT UQ_HTE_TournamentHorse UNIQUE (TournamentId, HorseId),   -- neo cho Pairings FK
        CONSTRAINT CHK_HTE_Status CHECK ([Status] IN ('Enrolled','Withdrawn')),
        CONSTRAINT CHK_HTE_Screening CHECK (ScreeningStatus IN ('NotScreened','AutoEligible','ManualReview','AutoRejected')),
        CONSTRAINT CHK_HTE_Approval CHECK (AdminApprovalStatus IN ('Pending','Approved','Rejected'))
    );

    CREATE INDEX IX_HTE_Horse ON HorseTournamentEntries (HorseId);
    CREATE INDEX IX_HTE_TournamentApproval ON HorseTournamentEntries (TournamentId, AdminApprovalStatus);
END
GO

/* ---------------------------------------------------------------------------
   3b) Backfill enrollment từ dữ liệu Pairings hiện có
       → mỗi (TournamentId, HorseId) đang được dùng trong Pairings phải có
         enrollment tương ứng, nếu không bước (4) add FK sẽ FAIL (Msg 547).
       Pre-existing pairing = ngựa đã hợp lệ trong giải → set Approved/AutoEligible.
       Idempotent: chỉ chèn dòng còn thiếu (NOT EXISTS).
   --------------------------------------------------------------------------- */
INSERT INTO HorseTournamentEntries
    (HorseId, TournamentId, OwnerId, [Status], ScreeningStatus, AdminApprovalStatus, CreatedAt, UpdatedAt)
SELECT DISTINCT p.HorseId, p.TournamentId, h.OwnerId, 'Enrolled', 'AutoEligible', 'Approved',
       GETUTCDATE(), GETUTCDATE()
FROM Pairings p
JOIN Horses h ON h.HorseId = p.HorseId
WHERE NOT EXISTS (
    SELECT 1 FROM HorseTournamentEntries e
    WHERE e.HorseId = p.HorseId AND e.TournamentId = p.TournamentId
);
GO

/* ---------------------------------------------------------------------------
   4) Pairings: composite-FK (TournamentId, HorseId) trỏ vào enrollment
      → đảm bảo ngựa của pairing đã enroll vào đúng giải (DB-level guarantee).
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Pairings_HorseTournament')
    ALTER TABLE Pairings
        ADD CONSTRAINT FK_Pairings_HorseTournament
        FOREIGN KEY (TournamentId, HorseId)
        REFERENCES HorseTournamentEntries(TournamentId, HorseId);
GO
