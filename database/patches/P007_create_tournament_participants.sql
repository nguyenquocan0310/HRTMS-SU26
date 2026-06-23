-- =============================================================================
-- Patch P007 — Tạo bảng TournamentParticipants (roster thành viên theo giải)
-- Module: B — Quản lý Giải đấu / Đăng ký tham gia
-- Mục đích: Roster Owner/Jockey/Doctor/Referee theo từng giải.
--   Duyệt chứng chỉ là GLOBAL (Module A); bảng này quản lý việc THAM GIA 1 giải
--   cụ thể — Admin duyệt Pending -> Approved. Mọi API chọn người (owner mời jockey,
--   admin phân công doctor/referee) tham chiếu roster Approved của giải.
-- Ngày: 2026-06-23
-- =============================================================================

USE HRTMS;
GO

-- Tạo bảng nếu chưa có (idempotent)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'TournamentParticipants'
)
BEGIN
    CREATE TABLE TournamentParticipants (
        ParticipantId         INT             IDENTITY(1,1)   NOT NULL,
        TournamentId          INT                             NOT NULL,
        UserId                INT                             NOT NULL,
        [Role]                VARCHAR(20)                     NOT NULL,
        [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Pending',
        RejectionReason       NVARCHAR(500)                   NULL,
        RegisteredAt          DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
        ApprovedBy            INT                             NULL,
        ApprovedAt            DATETIME2                       NULL,

        CONSTRAINT PK_TournamentParticipants    PRIMARY KEY (ParticipantId),
        CONSTRAINT FK_TP_Tournament             FOREIGN KEY (TournamentId)  REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
        CONSTRAINT FK_TP_User                   FOREIGN KEY (UserId)        REFERENCES Users(UserId),
        CONSTRAINT FK_TP_ApprovedBy             FOREIGN KEY (ApprovedBy)    REFERENCES Users(UserId),
        CONSTRAINT UQ_TP_TourUser               UNIQUE (TournamentId, UserId),
        CONSTRAINT CHK_TP_Role                  CHECK ([Role]   IN ('Owner','Jockey','Doctor','Referee')),
        CONSTRAINT CHK_TP_Status                CHECK ([Status] IN ('Pending','Approved','Rejected'))
    );

    PRINT 'P007: Table TournamentParticipants created.';
END
ELSE
BEGIN
    PRINT 'P007: Table TournamentParticipants already exists — skipped.';
END
GO

-- Index roster cho truy vấn lọc theo (TournamentId, Role, Status)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_TournamentParticipants_Roster'
)
AND EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentParticipants'
)
BEGIN
    CREATE INDEX IX_TournamentParticipants_Roster
        ON TournamentParticipants (TournamentId, [Role], [Status]);

    PRINT 'P007: IX_TournamentParticipants_Roster added.';
END
ELSE
BEGIN
    PRINT 'P007: IX_TournamentParticipants_Roster already exists or table missing.';
END
GO
