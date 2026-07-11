/* =============================================================================
   Patch 004 — Module H mở rộng: Live Race Simulation (UI-S07)
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Thêm cột Races.ActualStartTime — thời điểm Referee thực sự bấm "Start Race"
       (khác ScheduledTime là giờ dự kiến). FE dùng cột này để biết khi nào bắt
       đầu chạy animation random-walk (client-side, 100ms/tick).
     • Không thêm bảng mới: Violation trong lúc Live vẫn dùng lại bảng
       RaceReports/Violations sẵn có — Referee ghi nhận vi phạm trong lúc Live sẽ
       tạo (hoặc tái sử dụng) 1 RaceReport chưa khóa (IsLocked = 0) cho race đó.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Races') AND name = 'ActualStartTime'
)
    ALTER TABLE Races ADD ActualStartTime DATETIME2 NULL;
GO
