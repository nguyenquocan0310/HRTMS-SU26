USE HRTMS;
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'ClinicalStatus'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD ClinicalStatus VARCHAR(20) NULL;

    PRINT 'P004: ClinicalStatus added.';
END
ELSE
BEGIN
    PRINT 'P004: ClinicalStatus already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CHK_RaceEntries_ClinicalStatus'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD CONSTRAINT CHK_RaceEntries_ClinicalStatus
    CHECK (
        ClinicalStatus IS NULL
        OR ClinicalStatus IN ('Fit', 'Unfit')
    );

    PRINT 'P004: CHK_RaceEntries_ClinicalStatus added.';
END
ELSE
BEGIN
    PRINT 'P004: CHK_RaceEntries_ClinicalStatus already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'ClinicalCheckedByDoctorId'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD ClinicalCheckedByDoctorId INT NULL;

    PRINT 'P004: ClinicalCheckedByDoctorId added.';
END
ELSE
BEGIN
    PRINT 'P004: ClinicalCheckedByDoctorId already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_RaceEntries_ClinicalDoctor'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD CONSTRAINT FK_RaceEntries_ClinicalDoctor
    FOREIGN KEY (ClinicalCheckedByDoctorId)
    REFERENCES DoctorProfiles(DoctorId);

    PRINT 'P004: FK_RaceEntries_ClinicalDoctor added.';
END
ELSE
BEGIN
    PRINT 'P004: FK_RaceEntries_ClinicalDoctor already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'ClinicalCheckedAt'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD ClinicalCheckedAt DATETIME2 NULL;

    PRINT 'P004: ClinicalCheckedAt added.';
END
ELSE
BEGIN
    PRINT 'P004: ClinicalCheckedAt already exists.';
END
GO

SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'RaceEntries'
  AND COLUMN_NAME IN (
      'ClinicalStatus',
      'ClinicalCheckedByDoctorId',
      'ClinicalCheckedAt',
      'UnfitReason'
  );