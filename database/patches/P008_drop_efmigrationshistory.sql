-- =============================================================================
-- Patch P008 — Dọn bảng rác __EFMigrationsHistory
-- Lý do: dự án đi DB-first (schema = hrtms_schema.sql + patches), KHÔNG dùng EF
--   migrations. Bảng __EFMigrationsHistory bị tạo do Program.cs trước đây gọi
--   context.Database.Migrate() lúc khởi động (đã đổi sang CanConnect()).
-- Ngày: 2026-06-25
-- =============================================================================
-- QUAN TRỌNG: chỉ chạy patch này SAU KHI đã pull code bỏ Database.Migrate()
-- (nếu app còn gọi Migrate() thì lần chạy kế tiếp sẽ tạo lại bảng này).
-- =============================================================================

USE HRTMS;
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = '__EFMigrationsHistory')
BEGIN
    DROP TABLE dbo.[__EFMigrationsHistory];
    PRINT 'P008: Dropped orphan table __EFMigrationsHistory.';
END
ELSE
BEGIN
    PRINT 'P008: __EFMigrationsHistory not present - skipped.';
END
GO
