/* =============================================================================
   Patch 005 — Module E: Optimistic concurrency cho Races / RaceEntries
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Races.RowVersion       — ROWVERSION, concurrency token do SQL Server sinh.
     • RaceEntries.RowVersion — ROWVERSION, concurrency token do SQL Server sinh.

   Lý do:
     Nhiều actor ghi đồng thời cùng 1 row (Doctor sửa weight trong lúc Referee
     confirm starting list; 2 Admin cùng thao tác 1 entry) hiện là last-write-wins
     âm thầm. EF Core map cột này bằng IsRowVersion() (HRTMSDbContext) — request
     ghi đè dữ liệu đã đổi sẽ nhận DbUpdateConcurrencyException → API trả
     409 CONCURRENCY_CONFLICT (ExceptionMiddleware).

   Ghi chú:
     • Các path dùng ExecuteUpdateAsync (withdraw, trừ ví...) bypass change
       tracker — không đi qua RowVersion, đã tự bảo vệ bằng UPDATE có điều kiện.
     • ROWVERSION do DB quản lý hoàn toàn: không cần backfill, không cần default.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Races.RowVersion
   --------------------------------------------------------------------------- */
IF COL_LENGTH('Races', 'RowVersion') IS NULL
    ALTER TABLE Races ADD RowVersion ROWVERSION NOT NULL;
GO

/* ---------------------------------------------------------------------------
   2) RaceEntries.RowVersion
   --------------------------------------------------------------------------- */
IF COL_LENGTH('RaceEntries', 'RowVersion') IS NULL
    ALTER TABLE RaceEntries ADD RowVersion ROWVERSION NOT NULL;
GO

PRINT 'Patch 005 applied: Races.RowVersion + RaceEntries.RowVersion (optimistic concurrency).';
GO
