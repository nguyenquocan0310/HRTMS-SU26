/* =============================================================================
   Patch 008 — Reduce default Protest window from 120 to 10 minutes
   -----------------------------------------------------------------------------
   Races.ProtestDeadlineMinutes controls how long Owner/Jockey can submit a
   Protest after the Referee submits the preliminary (Unofficial) result.
   Business decision: shorten the default window from 120 minutes to 10
   minutes so races move to Official status faster.

   This patch only changes the DEFAULT applied to new rows. Existing races
   keep whatever ProtestDeadlineMinutes value they already have (their
   protest windows already opened/closed under the old value, so rewriting
   history here would be incorrect).

   Idempotent: safe to run more than once.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

DECLARE @constraintName SYSNAME;

SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Races')
  AND c.name = 'ProtestDeadlineMinutes';

IF @constraintName IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'ALTER TABLE dbo.Races DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
    EXEC sp_executesql @sql;
END
GO

ALTER TABLE dbo.Races
    ADD CONSTRAINT DF_Races_ProtestDeadlineMinutes DEFAULT (10) FOR ProtestDeadlineMinutes;
GO