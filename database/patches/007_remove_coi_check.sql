/* =============================================================================
   Patch 007 — Remove Conflict of Interest (COI) functionality
   -----------------------------------------------------------------------------
   This patch removes schema used only by family relationship declarations,
   referee/doctor COI checks, and jockey independence checks.

   Data impact:
     - All rows in FamilyRelationshipDeclarations are permanently deleted when
       the table is dropped.
     - Historical COI/independence statuses, timestamps, and reasons stored on
       assignments and race entries are permanently deleted with their columns.

   Idempotent: safe to run more than once.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Drop the COI declaration table after its foreign keys and indexes.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.FamilyRelationshipDeclarations', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE parent_object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'FK_FRD_Declarant')
        ALTER TABLE dbo.FamilyRelationshipDeclarations DROP CONSTRAINT FK_FRD_Declarant;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE parent_object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'FK_FRD_Related')
        ALTER TABLE dbo.FamilyRelationshipDeclarations DROP CONSTRAINT FK_FRD_Related;

    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'UQ_FRD_DeclarantRelated')
        DROP INDEX UQ_FRD_DeclarantRelated ON dbo.FamilyRelationshipDeclarations;

    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'IX_FRD_RelatedIdentityHash')
        DROP INDEX IX_FRD_RelatedIdentityHash ON dbo.FamilyRelationshipDeclarations;

    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'IX_FRD_RelatedEmail')
        DROP INDEX IX_FRD_RelatedEmail ON dbo.FamilyRelationshipDeclarations;

    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'IX_FRD_RelatedPhone')
        DROP INDEX IX_FRD_RelatedPhone ON dbo.FamilyRelationshipDeclarations;

    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.FamilyRelationshipDeclarations')
                 AND name = N'IX_FRD_NameDob')
        DROP INDEX IX_FRD_NameDob ON dbo.FamilyRelationshipDeclarations;

    DROP TABLE dbo.FamilyRelationshipDeclarations;
END;
GO

/* ---------------------------------------------------------------------------
   2) Remove jockey independence-check persistence from RaceEntries.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.RaceEntries', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.RaceEntries')
                 AND name = N'IX_RaceEntries_Independence')
        DROP INDEX IX_RaceEntries_Independence ON dbo.RaceEntries;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE parent_object_id = OBJECT_ID(N'dbo.RaceEntries')
                 AND name = N'FK_RaceEntries_IndependenceReferee')
        ALTER TABLE dbo.RaceEntries DROP CONSTRAINT FK_RaceEntries_IndependenceReferee;

    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID(N'dbo.RaceEntries')
                 AND name = N'CHK_RaceEntries_Independence')
        ALTER TABLE dbo.RaceEntries DROP CONSTRAINT CHK_RaceEntries_Independence;
END;
GO

IF COL_LENGTH(N'dbo.RaceEntries', N'IndependenceCheckStatus') IS NOT NULL
BEGIN
    DECLARE @RaceEntryDefault sysname;
    SELECT @RaceEntryDefault = dc.name
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.RaceEntries')
      AND c.name = N'IndependenceCheckStatus';

    IF @RaceEntryDefault IS NOT NULL
    BEGIN
        DECLARE @RaceEntryDropDefaultSql nvarchar(4000) =
            N'ALTER TABLE dbo.RaceEntries DROP CONSTRAINT ' + QUOTENAME(@RaceEntryDefault) + N';';
        EXEC sys.sp_executesql @RaceEntryDropDefaultSql;
    END;
END;
GO

IF COL_LENGTH(N'dbo.RaceEntries', N'IndependenceCheckedByRefereeId') IS NOT NULL
    ALTER TABLE dbo.RaceEntries DROP COLUMN IndependenceCheckedByRefereeId;
IF COL_LENGTH(N'dbo.RaceEntries', N'IndependenceCheckedAt') IS NOT NULL
    ALTER TABLE dbo.RaceEntries DROP COLUMN IndependenceCheckedAt;
IF COL_LENGTH(N'dbo.RaceEntries', N'IndependenceViolationReason') IS NOT NULL
    ALTER TABLE dbo.RaceEntries DROP COLUMN IndependenceViolationReason;
IF COL_LENGTH(N'dbo.RaceEntries', N'IndependenceCheckStatus') IS NOT NULL
    ALTER TABLE dbo.RaceEntries DROP COLUMN IndependenceCheckStatus;
GO

/* ---------------------------------------------------------------------------
   3) Remove COI persistence from RefereeAssignments.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.RefereeAssignments', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.RefereeAssignments')
                 AND name = N'IX_RefAssign_Coi')
        DROP INDEX IX_RefAssign_Coi ON dbo.RefereeAssignments;

    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID(N'dbo.RefereeAssignments')
                 AND name = N'CHK_RefAssign_Coi')
        ALTER TABLE dbo.RefereeAssignments DROP CONSTRAINT CHK_RefAssign_Coi;
END;
GO

IF COL_LENGTH(N'dbo.RefereeAssignments', N'CoiCheckStatus') IS NOT NULL
BEGIN
    DECLARE @RefereeAssignmentDefault sysname;
    SELECT @RefereeAssignmentDefault = dc.name
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.RefereeAssignments')
      AND c.name = N'CoiCheckStatus';

    IF @RefereeAssignmentDefault IS NOT NULL
    BEGIN
        DECLARE @RefereeAssignmentDropDefaultSql nvarchar(4000) =
            N'ALTER TABLE dbo.RefereeAssignments DROP CONSTRAINT ' + QUOTENAME(@RefereeAssignmentDefault) + N';';
        EXEC sys.sp_executesql @RefereeAssignmentDropDefaultSql;
    END;
END;
GO

IF COL_LENGTH(N'dbo.RefereeAssignments', N'CoiCheckedAt') IS NOT NULL
    ALTER TABLE dbo.RefereeAssignments DROP COLUMN CoiCheckedAt;
IF COL_LENGTH(N'dbo.RefereeAssignments', N'CoiViolationReason') IS NOT NULL
    ALTER TABLE dbo.RefereeAssignments DROP COLUMN CoiViolationReason;
IF COL_LENGTH(N'dbo.RefereeAssignments', N'CoiCheckStatus') IS NOT NULL
    ALTER TABLE dbo.RefereeAssignments DROP COLUMN CoiCheckStatus;
GO

/* ---------------------------------------------------------------------------
   4) Remove COI persistence from DoctorAssignments.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.DoctorAssignments', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.DoctorAssignments')
                 AND name = N'IX_DocAssign_Coi')
        DROP INDEX IX_DocAssign_Coi ON dbo.DoctorAssignments;

    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID(N'dbo.DoctorAssignments')
                 AND name = N'CHK_DocAssign_Coi')
        ALTER TABLE dbo.DoctorAssignments DROP CONSTRAINT CHK_DocAssign_Coi;
END;
GO

IF COL_LENGTH(N'dbo.DoctorAssignments', N'CoiCheckStatus') IS NOT NULL
BEGIN
    DECLARE @DoctorAssignmentDefault sysname;
    SELECT @DoctorAssignmentDefault = dc.name
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.DoctorAssignments')
      AND c.name = N'CoiCheckStatus';

    IF @DoctorAssignmentDefault IS NOT NULL
    BEGIN
        DECLARE @DoctorAssignmentDropDefaultSql nvarchar(4000) =
            N'ALTER TABLE dbo.DoctorAssignments DROP CONSTRAINT ' + QUOTENAME(@DoctorAssignmentDefault) + N';';
        EXEC sys.sp_executesql @DoctorAssignmentDropDefaultSql;
    END;
END;
GO

IF COL_LENGTH(N'dbo.DoctorAssignments', N'CoiCheckedAt') IS NOT NULL
    ALTER TABLE dbo.DoctorAssignments DROP COLUMN CoiCheckedAt;
IF COL_LENGTH(N'dbo.DoctorAssignments', N'CoiViolationReason') IS NOT NULL
    ALTER TABLE dbo.DoctorAssignments DROP COLUMN CoiViolationReason;
IF COL_LENGTH(N'dbo.DoctorAssignments', N'CoiCheckStatus') IS NOT NULL
    ALTER TABLE dbo.DoctorAssignments DROP COLUMN CoiCheckStatus;
GO

PRINT 'Patch 007 applied: COI declarations, checks, statuses, and reasons removed.';
GO
