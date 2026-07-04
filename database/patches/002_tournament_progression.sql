/* =============================================================================
   Patch 002 — Module B/E: Tournament/Round/Race Progression
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Tournaments.AdvancementRule  — rule chọn ngựa đi tiếp, cấu hình per giải:
         'TopPerRace'    (MVP/default): mỗi race lấy Top N theo FinishPosition.
         'EarningsBased' : xếp theo EarningsAwarded (purse thực kiếm được) —
                           hệ thống KHÔNG có điểm số, chỉ có tiền thưởng.
         'Hybrid'        : Top N mỗi race trước, slot còn lại theo earnings.
     • Tournaments.AdvancementCount — N của TopPerRace (default 5, khớp cấu trúc
       PrizeDistributions Top1–Top5).
     • RaceEntries.AdvancementStatus — kết quả progression sau khi race Official:
         'Qualified'    : đủ điều kiện allocate vào round kế tiếp.
         'AlsoEligible' : dự bị — dead heat tại ranh qualify hoặc overflow;
                          Admin quyết định khi allocate (draw/manual).
         'Eliminated'   : bị loại, KHÔNG được allocate round sau.
         NULL           : chưa tính (race chưa Official / entry Cancelled /
                          round chung kết không có advancement).
     • RaceEntries.AdvancementRank   — thứ hạng dùng để xét đi tiếp (MVP =
       FinishPosition trong race).
     • RaceEntries.AdvancementReason — lý do/evidence (dead heat, disqualified,
       admin draw...) phục vụ audit.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Tournaments: AdvancementRule + AdvancementCount
   --------------------------------------------------------------------------- */
IF COL_LENGTH('Tournaments', 'AdvancementRule') IS NULL
    ALTER TABLE Tournaments ADD AdvancementRule VARCHAR(20) NOT NULL
        CONSTRAINT DF_Tournaments_AdvRule DEFAULT 'TopPerRace';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Tournaments_AdvRule')
    ALTER TABLE Tournaments ADD CONSTRAINT CHK_Tournaments_AdvRule
        CHECK (AdvancementRule IN ('TopPerRace','EarningsBased','Hybrid'));
GO

IF COL_LENGTH('Tournaments', 'AdvancementCount') IS NULL
    ALTER TABLE Tournaments ADD AdvancementCount INT NOT NULL
        CONSTRAINT DF_Tournaments_AdvCount DEFAULT 5;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Tournaments_AdvCount')
    ALTER TABLE Tournaments ADD CONSTRAINT CHK_Tournaments_AdvCount
        CHECK (AdvancementCount > 0);
GO

/* ---------------------------------------------------------------------------
   2) RaceEntries: AdvancementStatus / AdvancementRank / AdvancementReason
   --------------------------------------------------------------------------- */
IF COL_LENGTH('RaceEntries', 'AdvancementStatus') IS NULL
    ALTER TABLE RaceEntries ADD AdvancementStatus VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_RaceEntries_AdvStatus')
    ALTER TABLE RaceEntries ADD CONSTRAINT CHK_RaceEntries_AdvStatus
        CHECK (AdvancementStatus IS NULL OR AdvancementStatus IN ('Qualified','AlsoEligible','Eliminated'));
GO

IF COL_LENGTH('RaceEntries', 'AdvancementRank') IS NULL
    ALTER TABLE RaceEntries ADD AdvancementRank INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_RaceEntries_AdvRank')
    ALTER TABLE RaceEntries ADD CONSTRAINT CHK_RaceEntries_AdvRank
        CHECK (AdvancementRank IS NULL OR AdvancementRank > 0);
GO

IF COL_LENGTH('RaceEntries', 'AdvancementReason') IS NULL
    ALTER TABLE RaceEntries ADD AdvancementReason NVARCHAR(255) NULL;
GO

/* ---------------------------------------------------------------------------
   3) Index phục vụ picker/guard: lọc entry theo AdvancementStatus
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RaceEntries_AdvStatus')
    CREATE INDEX IX_RaceEntries_AdvStatus ON RaceEntries (AdvancementStatus)
        WHERE AdvancementStatus IS NOT NULL;
GO
