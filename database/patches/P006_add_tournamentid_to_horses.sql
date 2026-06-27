-- =============================================================================
-- Patch P006 — Thêm cột TournamentId vào bảng Horses
-- Module: C — Đăng ký Ngựa & Duyệt Hồ sơ
-- Yêu cầu: REQ-F-HRS.4 (auto-reject theo AllowedBreed của giải) — 1 ngựa = 1 giải
-- Ngày: 2026-06-23
-- =============================================================================
-- Chạy file này nếu bạn đã có DB từ hrtms_schema.sql từ trước.
-- Cột để NULL-able để không phá dữ liệu ngựa cũ; tầng app (HorseService) bắt buộc
-- gán TournamentId khi đăng ký ngựa mới.
-- =============================================================================

USE HRTMS;
GO

-- Thêm cột TournamentId nếu chưa có (idempotent)
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME  = 'Horses'
      AND COLUMN_NAME = 'TournamentId'
)
BEGIN
    ALTER TABLE Horses
    ADD TournamentId INT NULL;

    PRINT 'P006: Column TournamentId added to Horses.';
END
ELSE
BEGIN
    PRINT 'P006: Column TournamentId already exists — skipped.';
END
GO

-- Index cho TournamentId
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_Horses_Tournament'
)
AND EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Horses' AND COLUMN_NAME = 'TournamentId'
)
BEGIN
    CREATE INDEX IX_Horses_Tournament ON Horses (TournamentId);
    PRINT 'P006: IX_Horses_Tournament added.';
END
ELSE
BEGIN
    PRINT 'P006: IX_Horses_Tournament already exists or column missing.';
END
GO

-- FK Horses.TournamentId -> Tournaments(TournamentId)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Horses_Tournament'
)
AND EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Horses' AND COLUMN_NAME = 'TournamentId'
)
BEGIN
    ALTER TABLE Horses
    ADD CONSTRAINT FK_Horses_Tournament
    FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId);

    PRINT 'P006: FK_Horses_Tournament added.';
END
ELSE
BEGIN
    PRINT 'P006: FK_Horses_Tournament already exists or column missing.';
END
GO
