/* =============================================================================
   Patch 009 — Referee can manually close the Protest window early
   -----------------------------------------------------------------------------
   Adds RaceReports.ProtestWindowClosedAt so a Referee can close the protest
   window before Race.ProtestDeadlineMinutes elapses (minimum 5 minutes after
   RaceReport.SubmittedAt, enforced in application code). ProtestWindowPolicy
   treats a non-null ProtestWindowClosedAt as "window closed" the same as
   passing the deadline.

   trg_RaceReports_Immutable whitelists updatable columns explicitly, so the
   trigger must be recreated to include the new column or the update would be
   silently dropped.

   Idempotent: safe to run more than once.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.RaceReports')
      AND name = 'ProtestWindowClosedAt'
)
BEGIN
    ALTER TABLE dbo.RaceReports ADD ProtestWindowClosedAt DATETIME2 NULL;
END
GO

CREATE OR ALTER TRIGGER trg_RaceReports_Immutable
ON RaceReports
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM deleted WHERE IsLocked = 1)
    BEGIN
        RAISERROR('RaceReport is locked and cannot be updated or deleted.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        UPDATE rr
        SET
            RaceId        = i.RaceId,
            LeadRefereeId = i.LeadRefereeId,
            Notes         = i.Notes,
            IsLocked      = i.IsLocked,
            SubmittedAt   = i.SubmittedAt,
            LockedAt      = i.LockedAt,
            ProtestWindowClosedAt = i.ProtestWindowClosedAt
        FROM RaceReports rr
        INNER JOIN inserted i ON rr.RaceReportId = i.RaceReportId;
    END
    ELSE
    BEGIN
        DELETE FROM RaceReports
        WHERE RaceReportId IN (SELECT RaceReportId FROM deleted);
    END
END;
GO