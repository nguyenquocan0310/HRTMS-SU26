-- =============================================================================
-- Patch P001 — Thêm cột LegalConsentAccepted vào bảng Horses
-- Module: C — Đăng ký Ngựa & Duyệt Hồ sơ
-- Yêu cầu: EC-22 (cam kết pháp lý trước khi gửi hồ sơ)
-- Ngày: 2026-06-20
-- Tác giả: Module C team
-- =============================================================================
-- Chạy file này nếu bạn đã có DB từ hrtms_schema.sql (trước ngày 2026-06-20).
-- Nếu tạo DB mới từ hrtms_schema.sql hiện tại → KHÔNG cần chạy file này.
-- =============================================================================

USE HRTMS;
GO

-- Kiểm tra cột đã tồn tại chưa trước khi thêm (idempotent)
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME  = 'Horses'
      AND COLUMN_NAME = 'LegalConsentAccepted'
)
BEGIN
    ALTER TABLE Horses
    ADD LegalConsentAccepted BIT NOT NULL DEFAULT 0;

    PRINT 'P001: Column LegalConsentAccepted added to Horses successfully.';
END
ELSE
BEGIN
    PRINT 'P001: Column LegalConsentAccepted already exists — skipped.';
END
GO
