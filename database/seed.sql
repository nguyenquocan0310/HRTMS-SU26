/*
  HRTMS seed data
  - Common password for all seeded accounts: password
  - BCrypt hash below is for the plain text password "password".
  - IDs use the 9000 range to avoid clashing with normal development data.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

SET NOCOUNT ON;

DECLARE @Now DATETIME2 = SYSUTCDATETIME();
DECLARE @PasswordHash NVARCHAR(255) = N'$2a$12$h5ACuyerc5Y4nYStAGnYlOJVNBMkbMzRfnHCMGQZuk0LApe0xrO5y';

BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId IN (9001, 9002, 9003, 9004, 9005, 9006))
    BEGIN
        SET IDENTITY_INSERT dbo.Users ON;

        INSERT INTO dbo.Users
            (UserId, Username, FullName, Email, NormalizedEmail, PhoneNumber, NormalizedPhone,
             DateOfBirth, IdentityNumberEncrypted, IdentityHash, PasswordHash, Role, Status,
             FailedLoginAttempts, LockoutEnd, CreatedAt, UpdatedAt)
        VALUES
            (9001, N'admin.seed', N'Quan tri Vien HRTMS', N'admin.hrtms.vn@gmail.com', N'ADMIN.HRTMS.VN@GMAIL.COM',
             N'0901234567', N'0901234567', '1990-01-01', 0x303031303930303030303031, HASHBYTES('SHA2_256', N'001090000001'), @PasswordHash,
             N'Admin', N'Active', 0, NULL, @Now, @Now),

            (9002, N'owner.seed', N'Nguyen Van Chuong', N'nguyenvanchuong.owner@gmail.com', N'NGUYENVANCHUONG.OWNER@GMAIL.COM',
             N'0912345678', N'0912345678', '1991-02-02', 0x303739303931303030303032, HASHBYTES('SHA2_256', N'079091000002'), @PasswordHash,
             N'Owner', N'Active', 0, NULL, @Now, @Now),

            (9003, N'jockey.seed', N'Tran Minh Khoa', N'tranminhkhoa.jockey@icloud.com', N'TRANMINHKHOA.JOCKEY@ICLOUD.COM',
             N'0934567890', N'0934567890', '1998-03-03', 0x303031303938303030303033, HASHBYTES('SHA2_256', N'001098000003'), @PasswordHash,
             N'Jockey', N'Active', 0, NULL, @Now, @Now),

            (9004, N'referee.seed', N'Le Quang Huy', N'lequanghuy.referee@gmail.com', N'LEQUANGHUY.REFEREE@GMAIL.COM',
             N'0967890123', N'0967890123', '1988-04-04', 0x303031303838303030303034, HASHBYTES('SHA2_256', N'001088000004'), @PasswordHash,
             N'Referee', N'Active', 0, NULL, @Now, @Now),

            (9005, N'doctor.seed', N'Pham Thu Ha', N'phamthuha.doctor@icloud.com', N'PHAMTHUHA.DOCTOR@ICLOUD.COM',
             N'0987654321', N'0987654321', '1985-05-05', 0x303031303835303030303035, HASHBYTES('SHA2_256', N'001085000005'), @PasswordHash,
             N'Doctor', N'Active', 0, NULL, @Now, @Now),

            (9006, N'spectator.seed', N'Do Anh Minh', N'doanhminh.spectator@gmail.com', N'DOANHMINH.SPECTATOR@GMAIL.COM',
             N'0978123456', N'0978123456', '2000-06-06', 0x303031303030303030303036, HASHBYTES('SHA2_256', N'001000000006'), @PasswordHash,
             N'Spectator', N'Active', 0, NULL, @Now, @Now);

        SET IDENTITY_INSERT dbo.Users OFF;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.OwnerProfiles WHERE OwnerId = 9002)
    BEGIN
        INSERT INTO dbo.OwnerProfiles (OwnerId, CreatedAt, UpdatedAt)
        VALUES (9002, @Now, @Now);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.JockeyProfiles WHERE JockeyId = 9003)
    BEGIN
        INSERT INTO dbo.JockeyProfiles
            (JockeyId, LicenseCertificate, ExperienceYears, SelfDeclaredWeight,
             BloodType, HealthStatus, Status, RejectionReason, CreatedAt, UpdatedAt)
        VALUES
            (9003, N'LIC-JOCKEY-SEED-001', 6, 54.50, N'O+', N'Good', N'Active', NULL, @Now, @Now);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.RefereeProfiles WHERE RefereeId = 9004)
    BEGIN
        INSERT INTO dbo.RefereeProfiles
            (RefereeId, CertificationLevel, Status, RejectionReason, CreatedAt, UpdatedAt)
        VALUES
            (9004, N'National', N'Active', NULL, @Now, @Now);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.DoctorProfiles WHERE DoctorId = 9005)
    BEGIN
        INSERT INTO dbo.DoctorProfiles
            (DoctorId, MedicalLicenseNumber, Status, RejectionReason, CreatedAt, UpdatedAt)
        VALUES
            (9005, N'MED-SEED-001', N'Active', NULL, @Now, @Now);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.SpectatorProfiles WHERE SpectatorId = 9006)
    BEGIN
        INSERT INTO dbo.SpectatorProfiles (SpectatorId, CreatedAt)
        VALUES (9006, @Now);
    END

    IF OBJECT_ID(N'dbo.Wallets', N'U') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Wallets WHERE WalletId = 9006 OR SpectatorId = 9006)
    BEGIN
        SET IDENTITY_INSERT dbo.Wallets ON;

        INSERT INTO dbo.Wallets (WalletId, SpectatorId, Balance, UpdatedAt)
        VALUES (9006, 9006, 1000, @Now);

        SET IDENTITY_INSERT dbo.Wallets OFF;
    END

    IF OBJECT_ID(N'dbo.VirtualPointsTransactions', N'U') IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.Wallets WHERE WalletId = 9006)
       AND NOT EXISTS (SELECT 1 FROM dbo.VirtualPointsTransactions WHERE TransactionId = 9001)
    BEGIN
        SET IDENTITY_INSERT dbo.VirtualPointsTransactions ON;

        INSERT INTO dbo.VirtualPointsTransactions
            (TransactionId, WalletId, Amount, Type, ReferenceType, ReferenceId, CreatedAt)
        VALUES
            (9001, 9006, 1000, N'SignUp Bonus', NULL, NULL, @Now);

        SET IDENTITY_INSERT dbo.VirtualPointsTransactions OFF;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Tournaments WHERE TournamentId = 9001)
    BEGIN
        SET IDENTITY_INSERT dbo.Tournaments ON;

        INSERT INTO dbo.Tournaments
            (TournamentId, Name, Description, StartDate, EndDate, MaxHorses, AllowedBreed,
             TrackType, RaceDistance, RaceCategory, MinJockeyExperienceYears, PurseAmount,
             EntryFeeAmount, PreRaceWeightThresholdKg, PostRaceWeightDiffThresholdKg,
             Status, CreatedAt, UpdatedAt, CreatedBy)
        VALUES
            (9001, N'Cup Dua Ngua Quoc Gia Viet Nam 2026',
             N'Giai dau mau duoc to chuc boi Lien doan Dua ngua Viet Nam tai Phu Tho.',
             '2026-07-10T08:00:00', '2026-07-12T18:00:00',
             12, N'Thoroughbred', N'Turf', 1600, N'Open', 2,
             50000000.00, 500000.00, 2.00, 1.00,
             N'Open Registration', @Now, @Now, 9001);

        SET IDENTITY_INSERT dbo.Tournaments OFF;
    END

    IF OBJECT_ID(N'dbo.PrizeDistributions', N'U') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.PrizeDistributions WHERE TournamentId = 9001)
    BEGIN
        INSERT INTO dbo.PrizeDistributions (TournamentId, Position, Percentage, CreatedAt, UpdatedAt)
        VALUES
            (9001, 1, 40.00, @Now, @Now),
            (9001, 2, 25.00, @Now, @Now),
            (9001, 3, 15.00, @Now, @Now),
            (9001, 4, 12.00, @Now, @Now),
            (9001, 5, 8.00, @Now, @Now);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Rounds WHERE RoundId IN (9001, 9002, 9003))
    BEGIN
        SET IDENTITY_INSERT dbo.Rounds ON;

        INSERT INTO dbo.Rounds
            (RoundId, TournamentId, Name, SequenceOrder, ScheduledDate, Status, UpdatedAt)
        VALUES
            (9001, 9001, N'Vong loai', 1, '2026-07-10', N'Upcoming', @Now),
            (9002, 9001, N'Ban ket', 2, '2026-07-11', N'Upcoming', @Now),
            (9003, 9001, N'Chung ket', 3, '2026-07-12', N'Upcoming', @Now);

        SET IDENTITY_INSERT dbo.Rounds OFF;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Races WHERE RaceId IN (9001, 9002, 9003, 9004, 9005, 9006))
    BEGIN
        SET IDENTITY_INSERT dbo.Races ON;

        INSERT INTO dbo.Races
            (RaceId, RoundId, RaceNumber, ScheduledTime, PurseAmount, TrackTypeOverride,
             RaceDistanceOverride, Status, IsPostPositionDrawn, IsPredictionGateClosed,
             ConfirmationCutoffHours, ProtestDeadlineMinutes, CreatedAt, UpdatedAt)
        VALUES
            (9001, 9001, 1, '2026-07-10T09:00:00',  8000000.00, NULL, NULL, N'Upcoming', 0, 0, 24, 30, @Now, @Now),
            (9002, 9001, 2, '2026-07-10T14:00:00',  8000000.00, NULL, NULL, N'Upcoming', 0, 0, 24, 30, @Now, @Now),
            (9003, 9002, 1, '2026-07-11T09:00:00', 12000000.00, NULL, 2000, N'Upcoming', 0, 0, 24, 30, @Now, @Now),
            (9004, 9002, 2, '2026-07-11T14:00:00', 12000000.00, N'Dirt', 2000, N'Upcoming', 0, 0, 24, 30, @Now, @Now),
            (9005, 9003, 1, '2026-07-12T10:00:00', 20000000.00, NULL, 2000, N'Upcoming', 0, 0, 24, 30, @Now, @Now),
            (9006, 9003, 2, '2026-07-12T15:00:00', 30000000.00, NULL, 2000, N'Upcoming', 0, 0, 24, 30, @Now, @Now);

        SET IDENTITY_INSERT dbo.Races OFF;
    END

    -- Roster: Owner + Jockey + Referee + Doctor đã Approved trong giải 9001
    IF NOT EXISTS (SELECT 1 FROM dbo.TournamentParticipants WHERE ParticipantId IN (9401, 9402, 9403, 9404))
    BEGIN
        SET IDENTITY_INSERT dbo.TournamentParticipants ON;

        INSERT INTO dbo.TournamentParticipants
            (ParticipantId, TournamentId, UserId, [Role], [Status], ScreeningStatus,
             ScreeningReason, RejectionReason, RegisteredAt, ApprovedBy, ApprovedAt)
        VALUES
            (9401, 9001, 9002, N'Owner',   N'Approved', N'AutoEligible', N'Owner active va dinh danh day du.', NULL, @Now, 9001, @Now),
            (9402, 9001, 9003, N'Jockey',  N'Approved', N'AutoEligible', N'Jockey du kinh nghiem toi thieu.', NULL, @Now, 9001, @Now),
            (9403, 9001, 9004, N'Referee', N'Approved', N'AutoEligible', N'Trong tai da active.', NULL, @Now, 9001, @Now),
            (9404, 9001, 9005, N'Doctor',  N'Approved', N'AutoEligible', N'Bac si da active.', NULL, @Now, 9001, @Now);

        SET IDENTITY_INSERT dbo.TournamentParticipants OFF;
    END

    -- Kho ngua (schema v3): ho so vinh vien cua Owner 9002, KHONG gan giai
    IF NOT EXISTS (SELECT 1 FROM dbo.Horses WHERE HorseId IN (9501, 9502))
    BEGIN
        SET IDENTITY_INSERT dbo.Horses ON;

        INSERT INTO dbo.Horses
            (HorseId, OwnerId, [Name], BirthYear, Gender, Color, Pedigree, Weight,
             IdentifyingMarks, Breed, VaccinationRecordRef, DopingTestDate, DopingTestResult,
             LegalConsentAccepted, [Status], ScreeningStatus, ScreeningReason, AdminApprovalStatus,
             RejectionReason, CreatedAt, UpdatedAt)
        VALUES
            (9501, 9002, N'Hong Linh', 2020, N'Male', N'Nau sam', N'Sire A x Dam A', 472.50,
             N'Vet trang nho o tran', N'Thoroughbred', N'VAC-HL-2026', '2026-06-20', N'Clean',
             1, N'Active', N'AutoEligible', NULL, N'Approved', NULL, @Now, @Now),
            (9502, 9002, N'Bach Ma Son', 2019, N'Gelding', N'Xam', N'Sire B x Dam B', 468.00,
             N'Chan sau trai co khoang trang', N'Thoroughbred', N'VAC-BMS-2026', '2026-06-20', N'Clean',
             1, N'Active', N'AutoEligible', NULL, N'Approved', NULL, @Now, @Now);

        SET IDENTITY_INSERT dbo.Horses OFF;
    END

    -- Enrollment (HorseTournamentEntries): day 2 con ngua vao giai 9001, screening theo giai
    IF OBJECT_ID(N'dbo.HorseTournamentEntries', N'U') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.HorseTournamentEntries WHERE EnrollmentId IN (9551, 9552))
    BEGIN
        SET IDENTITY_INSERT dbo.HorseTournamentEntries ON;

        INSERT INTO dbo.HorseTournamentEntries
            (EnrollmentId, HorseId, TournamentId, OwnerId, [Status],
             ScreeningStatus, ScreeningReason, AdminApprovalStatus, RejectionReason, CreatedAt, UpdatedAt)
        VALUES
            (9551, 9501, 9001, 9002, N'Enrolled', N'AutoEligible', N'Khop dieu kien giai.', N'Approved', NULL, @Now, @Now),
            (9552, 9502, 9001, 9002, N'Enrolled', N'AutoEligible', N'Khop dieu kien giai.', N'Approved', NULL, @Now, @Now);

        SET IDENTITY_INSERT dbo.HorseTournamentEntries OFF;
    END

    -- Pairings: ghep ngua da enroll voi Jockey 9003 trong giai 9001
    IF NOT EXISTS (SELECT 1 FROM dbo.Pairings WHERE PairingId IN (9601, 9602))
    BEGIN
        SET IDENTITY_INSERT dbo.Pairings ON;

        INSERT INTO dbo.Pairings
            (PairingId, TournamentId, HorseId, JockeyId, [Status], RequestMessage, ResponseReason, CreatedAt, UpdatedAt)
        VALUES
            (9601, 9001, 9501, 9003, N'Accepted', N'Moi tham gia race vong loai.', N'Da nhan loi.', @Now, @Now),
            (9602, 9001, 9502, 9003, N'Pending',  N'Moi du bi cho ban ket.', NULL, @Now, @Now);

        SET IDENTITY_INSERT dbo.Pairings OFF;
    END

    -- RaceEntry mau: pairing 9601 da Confirmed + Paid trong Race 9001
    IF NOT EXISTS (SELECT 1 FROM dbo.RaceEntries WHERE RaceEntryId = 9701)
    BEGIN
        SET IDENTITY_INSERT dbo.RaceEntries ON;

        INSERT INTO dbo.RaceEntries
            (RaceEntryId, RaceId, PairingId, PostPosition, [Status], PreRaceJockeyWeight,
             PreRaceWeightByDoctorId, HorseIdentityCheckStatus, HorseIdentityCheckedByDoctorId,
             HorseIdentityCheckedAt, ClinicalStatus, ClinicalCheckedByDoctorId, ClinicalCheckedAt,
             IndependenceCheckStatus, IndependenceCheckedByRefereeId, IndependenceCheckedAt,
             IndependenceViolationReason, EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
             CreatedAt, UpdatedAt)
        VALUES
            (9701, 9001, 9601, 1, N'Confirmed', 53.60, 9005, N'Matched', 9005, @Now,
             N'Fit', 9005, @Now, N'Passed', 9004, @Now, NULL, N'Paid', 9001, @Now, @Now, @Now);

        SET IDENTITY_INSERT dbo.RaceEntries OFF;
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.Users'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.Users OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Users.'; END CATCH;
    IF OBJECT_ID(N'dbo.Wallets', N'U') IS NOT NULL
        BEGIN TRY SET IDENTITY_INSERT dbo.Wallets OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Wallets.'; END CATCH;
    IF OBJECT_ID(N'dbo.VirtualPointsTransactions', N'U') IS NOT NULL
        BEGIN TRY SET IDENTITY_INSERT dbo.VirtualPointsTransactions OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for VirtualPointsTransactions.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.Tournaments'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.Tournaments OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Tournaments.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.Rounds'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.Rounds OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Rounds.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.Races'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.Races OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Races.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.TournamentParticipants'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.TournamentParticipants OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for TournamentParticipants.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.Horses'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.Horses OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Horses.'; END CATCH;
    IF OBJECT_ID(N'dbo.HorseTournamentEntries', N'U') IS NOT NULL
        BEGIN TRY SET IDENTITY_INSERT dbo.HorseTournamentEntries OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for HorseTournamentEntries.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.Pairings'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.Pairings OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for Pairings.'; END CATCH;
    IF OBJECTPROPERTY(OBJECT_ID(N'dbo.RaceEntries'), 'TableHasIdentity') = 1
        BEGIN TRY SET IDENTITY_INSERT dbo.RaceEntries OFF; END TRY BEGIN CATCH PRINT N'Identity cleanup skipped for RaceEntries.'; END CATCH;

    THROW;
END CATCH;








