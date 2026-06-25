USE HRTMS;
GO

-- Them cot HorseIdentityStatus neu chua co
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'HorseIdentityStatus'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD HorseIdentityStatus VARCHAR(20) NULL;

    PRINT 'P003: HorseIdentityStatus added.';
END
ELSE
BEGIN
    PRINT 'P003: HorseIdentityStatus already exists.';
END
GO

-- Them constraint sau khi cot chac chan da ton tai
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CHK_RaceEntries_HorseIdentityStatus'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD CONSTRAINT CHK_RaceEntries_HorseIdentityStatus
    CHECK (
        HorseIdentityStatus IS NULL
        OR HorseIdentityStatus IN ('Matched', 'Mismatch')
    );

    PRINT 'P003: CHK_RaceEntries_HorseIdentityStatus added.';
END
ELSE
BEGIN
    PRINT 'P003: CHK_RaceEntries_HorseIdentityStatus already exists.';
END
GO

-- Them FK cho HorseIdentityCheckedByDoctorId neu chua co
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_RaceEntries_HorseIdentityDoctor'
)
AND EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RaceEntries'
      AND COLUMN_NAME = 'HorseIdentityCheckedByDoctorId'
)
BEGIN
    ALTER TABLE RaceEntries
    ADD CONSTRAINT FK_RaceEntries_HorseIdentityDoctor
    FOREIGN KEY (HorseIdentityCheckedByDoctorId)
    REFERENCES DoctorProfiles(DoctorId);

    PRINT 'P003: FK_RaceEntries_HorseIdentityDoctor added.';
END
ELSE
BEGIN
    PRINT 'P003: FK_RaceEntries_HorseIdentityDoctor already exists or column missing.';
END
GO