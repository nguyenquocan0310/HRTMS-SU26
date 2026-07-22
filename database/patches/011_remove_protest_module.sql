/* =============================================================================
   Patch 011 — Remove the Protest module
   -----------------------------------------------------------------------------
   Removes data and schema that are no longer used after the backend Protest
   API/service/entity were removed:
     - dbo.Protests (and its foreign keys / constraints)
     - dbo.Races.ProtestDeadlineMinutes
     - dbo.RaceReports.ProtestWindowClosedAt

   WARNING: this permanently deletes all protest records. Take a backup before
   applying it if the historical data must be retained.
   ============================================================================= */

SET XACT_ABORT ON;
BEGIN TRANSACTION;

BEGIN TRY
    -- Keep the RaceReports immutability trigger valid before removing its column.
    IF OBJECT_ID(N'dbo.trg_RaceReports_Immutable', N'TR') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql N'
            CREATE OR ALTER TRIGGER dbo.trg_RaceReports_Immutable
            ON dbo.RaceReports
            INSTEAD OF UPDATE, DELETE
            AS
            BEGIN
                SET NOCOUNT ON;

                IF EXISTS (SELECT 1 FROM deleted WHERE IsLocked = 1)
                BEGIN
                    RAISERROR(''RaceReport is locked and cannot be updated or deleted.'', 16, 1);
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
                        LockedAt      = i.LockedAt
                    FROM dbo.RaceReports rr
                    INNER JOIN inserted i ON rr.RaceReportId = i.RaceReportId;
                END
                ELSE
                BEGIN
                    DELETE FROM dbo.RaceReports
                    WHERE RaceReportId IN (SELECT RaceReportId FROM deleted);
                END
            END;';
    END;

    IF OBJECT_ID(N'dbo.Protests', N'U') IS NOT NULL
        DROP TABLE dbo.Protests;

    IF COL_LENGTH(N'dbo.RaceReports', N'ProtestWindowClosedAt') IS NOT NULL
        ALTER TABLE dbo.RaceReports DROP COLUMN ProtestWindowClosedAt;

    IF COL_LENGTH(N'dbo.Races', N'ProtestDeadlineMinutes') IS NOT NULL
    BEGIN
        DECLARE @dropConstraints nvarchar(max) = N'';

        SELECT @dropConstraints = STRING_AGG(
            N'ALTER TABLE dbo.Races DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';',
            CHAR(10))
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.object_id = dc.parent_object_id
           AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Races')
          AND c.name = N'ProtestDeadlineMinutes';

        IF @dropConstraints <> N''
            EXEC sys.sp_executesql @dropConstraints;

        SET @dropConstraints = N'';
        SELECT @dropConstraints = STRING_AGG(
            N'ALTER TABLE dbo.Races DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';',
            CHAR(10))
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID(N'dbo.Races')
          AND cc.definition LIKE N'%ProtestDeadlineMinutes%';

        IF @dropConstraints <> N''
            EXEC sys.sp_executesql @dropConstraints;

        ALTER TABLE dbo.Races DROP COLUMN ProtestDeadlineMinutes;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
