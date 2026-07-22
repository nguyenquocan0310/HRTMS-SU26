/* =============================================================================
   Patch 010 — AuditLogs.Action: VARCHAR(50) -> NVARCHAR(100)
   -----------------------------------------------------------------------------
   Action giờ ghi câu mô tả tiếng Việt cụ thể ngay tại nguồn (thay vì code
   tiếng Anh như "Declare_Official") để hiển thị trực tiếp lên UI Audit Log
   mà không cần map dịch riêng ở frontend. Hệ quả 2 việc cần đổi:
     1. VARCHAR không phải Unicode -> chữ có dấu tiếng Việt sẽ bị hỏng khi lưu.
        Đổi sang NVARCHAR để lưu đúng.
     2. Một số câu mô tả dài hơn 50 ký tự -> nới lên 100 cho an toàn dư dả.

   Idempotent: safe to run more than once.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

ALTER TABLE dbo.AuditLogs
    ALTER COLUMN [Action] NVARCHAR(100) NOT NULL;
GO
