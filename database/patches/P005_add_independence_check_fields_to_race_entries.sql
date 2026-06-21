USE HRTMS;
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'IndependenceCheckStatus'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD IndependenceCheckStatus VARCHAR(20) NULL;

    PRINT 'P005: IndependenceCheckStatus added.';
END
ELSE
BEGIN
    PRINT 'P005: IndependenceCheckStatus already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CHK_RaceEntries_IndependenceCheckStatus'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD CONSTRAINT CHK_RaceEntries_IndependenceCheckStatus
    CHECK (
        IndependenceCheckStatus IS NULL
        OR IndependenceCheckStatus IN ('Passed', 'Failed')
    );

    PRINT 'P005: CHK_RaceEntries_IndependenceCheckStatus added.';
END
ELSE
BEGIN
    PRINT 'P005: CHK_RaceEntries_IndependenceCheckStatus already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'IndependenceCheckedByRefereeId'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD IndependenceCheckedByRefereeId INT NULL;

    PRINT 'P005: IndependenceCheckedByRefereeId added.';
END
ELSE
BEGIN
    PRINT 'P005: IndependenceCheckedByRefereeId already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_RaceEntries_IndependenceReferee'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD CONSTRAINT FK_RaceEntries_IndependenceReferee
    FOREIGN KEY (IndependenceCheckedByRefereeId)
    REFERENCES RefereeProfiles(RefereeId);

    PRINT 'P005: FK_RaceEntries_IndependenceReferee added.';
END
ELSE
BEGIN
    PRINT 'P005: FK_RaceEntries_IndependenceReferee already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'IndependenceCheckedAt'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD IndependenceCheckedAt DATETIME2 NULL;

    PRINT 'P005: IndependenceCheckedAt added.';
END
ELSE
BEGIN
    PRINT 'P005: IndependenceCheckedAt already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'IndependenceViolationReason'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD IndependenceViolationReason NVARCHAR(500) NULL;

    PRINT 'P005: IndependenceViolationReason added.';
END
ELSE
BEGIN
    PRINT 'P005: IndependenceViolationReason already exists.';
END
GO