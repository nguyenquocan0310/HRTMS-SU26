-- =============================================================================
-- P009: AuditLogs append-only enforcement
-- EC-19 / BR-20 / REQ-NF-SEC.7 / REQ-NF-CMPL.5
-- Áp dụng lên DB đang chạy — không cần drop/recreate schema.
-- Chạy bởi: DBA hoặc CI deployment pipeline
-- Ngày: 2026
-- =============================================================================
USE HRTMS;
GO

-- -----------------------------------------------------------------------------
-- Lớp 1: INSTEAD OF trigger — chặn UPDATE/DELETE ở tầng SQL Engine
-- Hoạt động ngay cả khi caller là sysadmin hoặc EF Core dùng connection pool.
-- CREATE OR ALTER: idempotent, chạy lại nhiều lần không lỗi.
-- -----------------------------------------------------------------------------
CREATE OR ALTER TRIGGER trg_AuditLogs_AppendOnly
ON AuditLogs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR(
        'AuditLogs là bất biến (append-only): không thể sửa hoặc xóa bản ghi kiểm toán.',
        16, 1);
    ROLLBACK TRANSACTION;
END;
GO

-- Kiểm tra trigger đã tồn tại
IF NOT EXISTS (
    SELECT 1 FROM sys.triggers
    WHERE name = 'trg_AuditLogs_AppendOnly'
      AND parent_id = OBJECT_ID('AuditLogs')
)
    RAISERROR('Trigger trg_AuditLogs_AppendOnly chưa được tạo — kiểm tra lại script.', 16, 1);
GO

-- -----------------------------------------------------------------------------
-- Lớp 2: DB role + DENY — defense-in-depth, chặn trước khi trigger được gọi.
-- Application user nên được add vào role này trong môi trường production.
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.database_principals
    WHERE name = 'hrtms_app_role' AND type = 'R'
)
BEGIN
    CREATE ROLE hrtms_app_role;
    PRINT 'Role hrtms_app_role đã được tạo.';
END
ELSE
    PRINT 'Role hrtms_app_role đã tồn tại, bỏ qua CREATE.';
GO

DENY UPDATE, DELETE ON AuditLogs TO hrtms_app_role;
GO
PRINT 'DENY UPDATE, DELETE trên AuditLogs → hrtms_app_role: OK.';
GO

-- -----------------------------------------------------------------------------
-- Hướng dẫn sau khi chạy patch này:
--
-- Thêm DB user của application vào role (thay <app_db_user> bằng tên thật):
--   ALTER ROLE hrtms_app_role ADD MEMBER [<app_db_user>];
--
-- Kiểm tra:
--   -- Thử UPDATE (phải fail):
--   UPDATE AuditLogs SET Action = 'TAMPERED' WHERE AuditLogId = 1;
--   -- Thử DELETE (phải fail):
--   DELETE FROM AuditLogs WHERE AuditLogId = 1;
--   -- INSERT (phải thành công):
--   INSERT INTO AuditLogs (ActorId, Action, EntityName, EntityId, CreatedAt)
--   VALUES (1, 'Test', 'AuditLogs', '0', GETUTCDATE());
-- -----------------------------------------------------------------------------