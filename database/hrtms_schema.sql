-- =============================================================================
-- HRTMS - Horse Racing Tournament Management System
-- DB Schema: SQL Server 2022 - 3NF - Phase 1 Final
-- Project: SU26SWP03 | Version: 2.0 | Updated: 2026-06-27
-- 27 tables - PK/FK/CHECK/DEFAULT/UNIQUE/INDEX
-- =============================================================================

USE master;
GO

IF DB_ID('HRTMS') IS NOT NULL
BEGIN
    ALTER DATABASE HRTMS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE HRTMS;
END
GO

CREATE DATABASE HRTMS
    COLLATE Vietnamese_CI_AS;
GO

USE HRTMS;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =============================================================================
-- GROUP 1: USERS & PROFILE EXTENSIONS
-- =============================================================================

CREATE TABLE Users (
    UserId                   INT             IDENTITY(1,1) NOT NULL,
    Username                 VARCHAR(50)     NOT NULL,
    FullName                 NVARCHAR(100)   NOT NULL,
    Email                    VARCHAR(100)    NOT NULL,
    NormalizedEmail          VARCHAR(100)    NOT NULL,
    PhoneNumber              VARCHAR(20)     NULL,
    NormalizedPhone          VARCHAR(20)     NULL,
    DateOfBirth              DATE            NULL,
    IdentityNumberEncrypted  VARBINARY(512)  NULL,
    IdentityHash             VARBINARY(32)   NULL,
    PasswordHash             VARCHAR(255)    NOT NULL,
    [Role]                   VARCHAR(20)     NOT NULL,
    [Status]                 VARCHAR(20)     NOT NULL DEFAULT 'Active',
    FailedLoginAttempts      INT             NOT NULL DEFAULT 0,
    LockoutEnd               DATETIME2       NULL,
    CreatedAt                DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt                DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Username UNIQUE (Username),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT UQ_Users_NormalizedEmail UNIQUE (NormalizedEmail),
    CONSTRAINT CHK_Users_Role CHECK ([Role] IN ('Admin','Owner','Jockey','Referee','Doctor','Spectator')),
    CONSTRAINT CHK_Users_Status CHECK ([Status] IN ('Active','Pending','Suspended','Rejected')),
    CONSTRAINT CHK_Users_ProfessionalIdentity CHECK (
        [Role] IN ('Admin','Spectator')
        OR (PhoneNumber IS NOT NULL AND DateOfBirth IS NOT NULL AND IdentityNumberEncrypted IS NOT NULL AND IdentityHash IS NOT NULL)
    )
);
GO

-- AutoEligible is not used for account onboarding.
-- Users.Status and professional profile Status stay in the Pending/Active/Suspended/Rejected lifecycle.

CREATE TABLE JockeyProfiles (
    JockeyId             INT             NOT NULL,
    LicenseCertificate   VARCHAR(100)    NOT NULL,
    ExperienceYears      INT             NOT NULL,
    SelfDeclaredWeight   DECIMAL(5,2)    NOT NULL,
    BloodType            VARCHAR(5)      NULL,
    HealthStatus         VARCHAR(20)     NULL DEFAULT 'Good',
    [Status]             VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    RejectionReason      NVARCHAR(500)   NULL,
    CreatedAt            DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt            DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_JockeyProfiles PRIMARY KEY (JockeyId),
    CONSTRAINT FK_JockeyProfiles_Users FOREIGN KEY (JockeyId) REFERENCES Users(UserId),
    CONSTRAINT UQ_JockeyProfiles_License UNIQUE (LicenseCertificate),
    CONSTRAINT CHK_JockeyProfiles_ExpYrs CHECK (ExperienceYears >= 0),
    CONSTRAINT CHK_JockeyProfiles_Weight CHECK (SelfDeclaredWeight > 0),
    CONSTRAINT CHK_JockeyProfiles_Health CHECK (HealthStatus IS NULL OR HealthStatus IN ('Good','Fair','Under Treatment')),
    CONSTRAINT CHK_JockeyProfiles_Status CHECK ([Status] IN ('Pending','Active','Suspended','Rejected'))
);
GO

CREATE TABLE OwnerProfiles (
    OwnerId       INT        NOT NULL,
    CreatedAt     DATETIME2  NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt     DATETIME2  NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_OwnerProfiles PRIMARY KEY (OwnerId),
    CONSTRAINT FK_OwnerProfiles_Users FOREIGN KEY (OwnerId) REFERENCES Users(UserId)
);
GO

CREATE TABLE RefereeProfiles (
    RefereeId           INT             NOT NULL,
    CertificationLevel  VARCHAR(50)     NOT NULL,
    [Status]            VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    RejectionReason     NVARCHAR(500)   NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RefereeProfiles PRIMARY KEY (RefereeId),
    CONSTRAINT FK_RefereeProfiles_Users FOREIGN KEY (RefereeId) REFERENCES Users(UserId),
    CONSTRAINT CHK_RefereeProfiles_Status CHECK ([Status] IN ('Pending','Active','Suspended','Rejected'))
);
GO

CREATE TABLE DoctorProfiles (
    DoctorId              INT             NOT NULL,
    MedicalLicenseNumber  VARCHAR(50)     NOT NULL,
    [Status]              VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    RejectionReason       NVARCHAR(500)   NULL,
    CreatedAt             DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt             DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_DoctorProfiles PRIMARY KEY (DoctorId),
    CONSTRAINT FK_DoctorProfiles_Users FOREIGN KEY (DoctorId) REFERENCES Users(UserId),
    CONSTRAINT UQ_DoctorProfiles_License UNIQUE (MedicalLicenseNumber),
    CONSTRAINT CHK_DoctorProfiles_Status CHECK ([Status] IN ('Pending','Active','Suspended','Rejected'))
);
GO

CREATE TABLE SpectatorProfiles (
    SpectatorId  INT        NOT NULL,
    CreatedAt    DATETIME2  NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_SpectatorProfiles PRIMARY KEY (SpectatorId),
    CONSTRAINT FK_SpectatorProfiles_Users FOREIGN KEY (SpectatorId) REFERENCES Users(UserId)
);
GO

CREATE TABLE FamilyRelationshipDeclarations (
    DeclarationId            INT             IDENTITY(1,1) NOT NULL,
    DeclarantUserId          INT             NOT NULL,
    RelatedPersonName        NVARCHAR(100)   NOT NULL,
    RelatedUserId            INT             NULL,
    RelationType             VARCHAR(20)     NOT NULL,
    IndustryRole             VARCHAR(20)     NULL,
    RelatedIdentityHash      VARBINARY(32)   NULL,
    RelatedEmailNormalized   VARCHAR(100)    NULL,
    RelatedPhoneNormalized   VARCHAR(20)     NULL,
    RelatedDateOfBirth       DATE            NULL,
    MatchConfidence          VARCHAR(20)     NOT NULL DEFAULT 'Unresolved',
    Notes                    NVARCHAR(255)   NULL,
    DeclaredAt               DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_FRD PRIMARY KEY (DeclarationId),
    CONSTRAINT FK_FRD_Declarant FOREIGN KEY (DeclarantUserId) REFERENCES Users(UserId) ON DELETE NO ACTION,
    CONSTRAINT FK_FRD_Related FOREIGN KEY (RelatedUserId) REFERENCES Users(UserId) ON DELETE NO ACTION,
    CONSTRAINT CHK_FRD_RelationType CHECK (RelationType IN ('Spouse','Parent','Child','Sibling')),
    CONSTRAINT CHK_FRD_IndustryRole CHECK (IndustryRole IS NULL OR IndustryRole IN ('Owner','Jockey','Referee','Doctor','Spectator','Unknown')),
    CONSTRAINT CHK_FRD_MatchConfidence CHECK (MatchConfidence IN ('Unresolved','Low','Medium','High','Exact'))
);
GO

CREATE UNIQUE INDEX UQ_FRD_DeclarantRelated
    ON FamilyRelationshipDeclarations (DeclarantUserId, RelatedUserId)
    WHERE RelatedUserId IS NOT NULL;
GO

-- =============================================================================
-- GROUP 2: TOURNAMENT STRUCTURE
-- =============================================================================

CREATE TABLE Tournaments (
    TournamentId                   INT             IDENTITY(1,1) NOT NULL,
    [Name]                         NVARCHAR(150)   NOT NULL,
    [Description]                  NVARCHAR(MAX)   NULL,
    StartDate                      DATETIME2       NOT NULL,
    EndDate                        DATETIME2       NOT NULL,
    MaxHorses                      INT             NOT NULL,
    AllowedBreed                   VARCHAR(30)     NOT NULL,
    TrackType                      VARCHAR(20)     NOT NULL,
    RaceDistance                   INT             NOT NULL,
    RaceCategory                   VARCHAR(20)     NOT NULL,
    MinJockeyExperienceYears       INT             NOT NULL DEFAULT 0,
    PurseAmount                    DECIMAL(18,2)   NOT NULL,
    EntryFeeAmount                 DECIMAL(10,2)   NOT NULL DEFAULT 0,
    PreRaceWeightThresholdKg       DECIMAL(4,2)    NOT NULL DEFAULT 2.00,
    PostRaceWeightDiffThresholdKg  DECIMAL(4,2)    NOT NULL DEFAULT 1.00,
    [Status]                       VARCHAR(30)     NOT NULL DEFAULT 'Draft',
    CreatedAt                      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt                      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy                      INT             NULL,

    CONSTRAINT PK_Tournaments PRIMARY KEY (TournamentId),
    CONSTRAINT FK_Tournaments_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserId),
    CONSTRAINT CHK_Tournaments_EndDate CHECK (EndDate > StartDate),
    CONSTRAINT CHK_Tournaments_MaxHorses CHECK (MaxHorses > 0),
    CONSTRAINT CHK_Tournaments_Breed CHECK (AllowedBreed IN ('Thoroughbred','Arabian','Quarter Horse','Mixed')),
    CONSTRAINT CHK_Tournaments_TrackType CHECK (TrackType IN ('Turf','Dirt','Synthetic')),
    CONSTRAINT CHK_Tournaments_Distance CHECK (RaceDistance > 1200 AND RaceDistance < 2400),
    CONSTRAINT CHK_Tournaments_Category CHECK (RaceCategory IN ('Open','Classic','Maiden')),
    CONSTRAINT CHK_Tournaments_MinExp CHECK (MinJockeyExperienceYears >= 0),
    CONSTRAINT CHK_Tournaments_Purse CHECK (PurseAmount >= 0),
    CONSTRAINT CHK_Tournaments_Fee CHECK (EntryFeeAmount >= 0),
    CONSTRAINT CHK_Tournaments_PreWgt CHECK (PreRaceWeightThresholdKg > 0),
    CONSTRAINT CHK_Tournaments_PostWgt CHECK (PostRaceWeightDiffThresholdKg > 0),
    CONSTRAINT CHK_Tournaments_Status CHECK ([Status] IN ('Draft','Open Registration','Closed Registration','Completed','Cancelled'))
);
GO

CREATE TABLE TournamentParticipants (
    ParticipantId    INT             IDENTITY(1,1) NOT NULL,
    TournamentId     INT             NOT NULL,
    UserId           INT             NOT NULL,
    [Role]           VARCHAR(20)     NOT NULL,
    [Status]         VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    ScreeningStatus  VARCHAR(20)     NOT NULL DEFAULT 'NotScreened',
    ScreeningReason  NVARCHAR(500)   NULL,
    RejectionReason  NVARCHAR(500)   NULL,
    RegisteredAt     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    ApprovedBy       INT             NULL,
    ApprovedAt       DATETIME2       NULL,

    CONSTRAINT PK_TournamentParticipants PRIMARY KEY (ParticipantId),
    CONSTRAINT FK_TP_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
    CONSTRAINT FK_TP_User FOREIGN KEY (UserId) REFERENCES Users(UserId),
    CONSTRAINT FK_TP_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId),
    CONSTRAINT UQ_TP_TourUser UNIQUE (TournamentId, UserId),
    CONSTRAINT CHK_TP_Role CHECK ([Role] IN ('Owner','Jockey','Referee','Doctor')),
    CONSTRAINT CHK_TP_Status CHECK ([Status] IN ('Pending','Approved','Rejected','ManualReview')),
    CONSTRAINT CHK_TP_ScreeningStatus CHECK (ScreeningStatus IN ('NotScreened','AutoEligible','ManualReview','AutoRejected'))
);
GO

-- AutoEligible is a tournament roster screening result only.
-- Owner roster may be system-approved immediately; Jockey/Referee/Doctor still require Admin approval.

CREATE TABLE PrizeDistributions (
    PrizeDistributionId  INT            IDENTITY(1,1) NOT NULL,
    TournamentId         INT            NOT NULL,
    [Position]           INT            NOT NULL,
    Percentage           DECIMAL(5,2)   NOT NULL,
    CreatedAt            DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt            DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_PrizeDistributions PRIMARY KEY (PrizeDistributionId),
    CONSTRAINT FK_PrizeDist_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
    CONSTRAINT UQ_PrizeDist_TourPos UNIQUE (TournamentId, [Position]),
    CONSTRAINT CHK_PrizeDist_Position CHECK ([Position] BETWEEN 1 AND 5),
    CONSTRAINT CHK_PrizeDist_Percentage CHECK (Percentage >= 0 AND Percentage <= 100)
);
GO

CREATE TABLE Rounds (
    RoundId        INT            IDENTITY(1,1) NOT NULL,
    TournamentId   INT            NOT NULL,
    [Name]         NVARCHAR(100)  NOT NULL,
    SequenceOrder  INT            NOT NULL,
    ScheduledDate  DATETIME2      NOT NULL,
    [Status]       VARCHAR(20)    NOT NULL DEFAULT 'Upcoming',
    UpdatedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Rounds PRIMARY KEY (RoundId),
    CONSTRAINT FK_Rounds_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
    CONSTRAINT UQ_Rounds_TourSeq UNIQUE (TournamentId, SequenceOrder),
    CONSTRAINT CHK_Rounds_SeqOrder CHECK (SequenceOrder > 0),
    CONSTRAINT CHK_Rounds_Status CHECK ([Status] IN ('Upcoming','In-Progress','Completed','Cancelled'))
);
GO

CREATE TABLE Races (
    RaceId                   INT            IDENTITY(1,1) NOT NULL,
    RoundId                  INT            NOT NULL,
    RaceNumber               INT            NOT NULL,
    ScheduledTime            DATETIME2      NOT NULL,
    PurseAmount              DECIMAL(18,2)  NOT NULL,
    TrackTypeOverride        VARCHAR(20)    NULL,
    RaceDistanceOverride     INT            NULL,
    [Status]                 VARCHAR(20)    NOT NULL DEFAULT 'Upcoming',
    IsPostPositionDrawn      BIT            NOT NULL DEFAULT 0,
    IsPredictionGateClosed   BIT            NOT NULL DEFAULT 0,
    ConfirmationCutoffHours  INT            NOT NULL DEFAULT 24,
    ProtestDeadlineMinutes   INT            NOT NULL DEFAULT 120,
    CreatedAt                DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt                DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Races PRIMARY KEY (RaceId),
    CONSTRAINT FK_Races_Round FOREIGN KEY (RoundId) REFERENCES Rounds(RoundId) ON DELETE CASCADE,
    CONSTRAINT UQ_Races_RoundNumber UNIQUE (RoundId, RaceNumber),
    CONSTRAINT CHK_Races_RaceNumber CHECK (RaceNumber > 0),
    CONSTRAINT CHK_Races_Purse CHECK (PurseAmount >= 0),
    CONSTRAINT CHK_Races_TrackOverride CHECK (TrackTypeOverride IS NULL OR TrackTypeOverride IN ('Turf','Dirt','Synthetic')),
    CONSTRAINT CHK_Races_DistOverride CHECK (RaceDistanceOverride IS NULL OR (RaceDistanceOverride > 1200 AND RaceDistanceOverride < 2400)),
    CONSTRAINT CHK_Races_Status CHECK ([Status] IN ('Upcoming','Pre-Race','Live','Unofficial','Official','Cancelled')),
    CONSTRAINT CHK_Races_CutoffHrs CHECK (ConfirmationCutoffHours > 0),
    CONSTRAINT CHK_Races_ProtestMins CHECK (ProtestDeadlineMinutes > 0)
);
GO

-- =============================================================================
-- GROUP 3: HORSE, PAIRING & REGISTRATION
-- =============================================================================

CREATE TABLE Horses (
    HorseId                INT             IDENTITY(1,1) NOT NULL,
    OwnerId                INT             NOT NULL,
    TournamentId           INT             NOT NULL,
    [Name]                 NVARCHAR(100)   NOT NULL,
    BirthYear              INT             NOT NULL,
    Gender                 VARCHAR(10)     NOT NULL,
    Color                  NVARCHAR(50)    NOT NULL,
    Pedigree               NVARCHAR(255)   NULL,
    Weight                 DECIMAL(6,2)    NOT NULL,
    IdentifyingMarks       NVARCHAR(255)   NOT NULL,
    Breed                  VARCHAR(30)     NOT NULL,
    VaccinationRecordRef   VARCHAR(100)    NOT NULL,
    DopingTestDate         DATE            NULL,
    DopingTestResult       VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    LegalConsentAccepted   BIT             NOT NULL DEFAULT 0,
    [Status]               VARCHAR(20)     NOT NULL DEFAULT 'Declared',
    ScreeningStatus        VARCHAR(20)     NOT NULL DEFAULT 'NotScreened',
    ScreeningReason        NVARCHAR(500)   NULL,
    AdminApprovalStatus    VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    RejectionReason        NVARCHAR(500)   NULL,
    CreatedAt              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Horses PRIMARY KEY (HorseId),
    CONSTRAINT FK_Horses_Owner FOREIGN KEY (OwnerId) REFERENCES OwnerProfiles(OwnerId),
    CONSTRAINT FK_Horses_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId),
    CONSTRAINT FK_Horses_OwnerRoster FOREIGN KEY (TournamentId, OwnerId) REFERENCES TournamentParticipants(TournamentId, UserId),
    CONSTRAINT UQ_Horses_TournamentHorse UNIQUE (TournamentId, HorseId),
    CONSTRAINT CHK_Horses_BirthYear CHECK (BirthYear BETWEEN 1800 AND 2100),
    CONSTRAINT CHK_Horses_Gender CHECK (Gender IN ('Male','Female','Gelding')),
    CONSTRAINT CHK_Horses_Weight CHECK (Weight > 0),
    CONSTRAINT CHK_Horses_Breed CHECK (Breed IN ('Thoroughbred','Arabian','Quarter Horse','Mixed')),
    CONSTRAINT CHK_Horses_DopingResult CHECK (DopingTestResult IN ('Clean','Pending','Failed')),
    CONSTRAINT CHK_Horses_Status CHECK ([Status] IN ('Declared','Active','Retired')),
    CONSTRAINT CHK_Horses_ScreeningStatus CHECK (ScreeningStatus IN ('NotScreened','AutoEligible','ManualReview','AutoRejected')),
    CONSTRAINT CHK_Horses_ApprovalStatus CHECK (AdminApprovalStatus IN ('Pending','AutoEligible','ManualReview','Approved','Rejected','AutoRejected'))
);
GO

CREATE TABLE Pairings (
    PairingId       INT             IDENTITY(1,1) NOT NULL,
    TournamentId    INT             NOT NULL,
    HorseId         INT             NOT NULL,
    JockeyId        INT             NOT NULL,
    [Status]        VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    RequestMessage  NVARCHAR(255)   NULL,
    ResponseReason  NVARCHAR(255)   NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Pairings PRIMARY KEY (PairingId),
    CONSTRAINT FK_Pairings_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId),
    CONSTRAINT FK_Pairings_Horse FOREIGN KEY (HorseId) REFERENCES Horses(HorseId),
    CONSTRAINT FK_Pairings_Jockey FOREIGN KEY (JockeyId) REFERENCES JockeyProfiles(JockeyId),
    CONSTRAINT FK_Pairings_HorseTournament FOREIGN KEY (TournamentId, HorseId) REFERENCES Horses(TournamentId, HorseId),
    CONSTRAINT FK_Pairings_JockeyRoster FOREIGN KEY (TournamentId, JockeyId) REFERENCES TournamentParticipants(TournamentId, UserId),
    CONSTRAINT CHK_Pairings_Status CHECK ([Status] IN ('Pending','Accepted','Declined','Confirmed','Cancelled'))
);
GO

CREATE TABLE RaceEntries (
    RaceEntryId                       INT             IDENTITY(1,1) NOT NULL,
    RaceId                            INT             NOT NULL,
    PairingId                         INT             NOT NULL,
    PostPosition                      INT             NULL,
    [Status]                          VARCHAR(30)     NOT NULL DEFAULT 'Pending',
    PreRaceJockeyWeight               DECIMAL(5,2)    NULL,
    PreRaceWeightByDoctorId           INT             NULL,
    HorseIdentityCheckStatus          VARCHAR(20)     NULL,
    HorseIdentityCheckedByDoctorId    INT             NULL,
    HorseIdentityCheckedAt            DATETIME2       NULL,
    ClinicalStatus                    VARCHAR(20)     NULL,
    ClinicalCheckedByDoctorId         INT             NULL,
    ClinicalCheckedAt                 DATETIME2       NULL,
    IndependenceCheckStatus           VARCHAR(20)     NOT NULL DEFAULT 'NotChecked',
    IndependenceCheckedByRefereeId    INT             NULL,
    IndependenceCheckedAt             DATETIME2       NULL,
    IndependenceViolationReason       NVARCHAR(500)   NULL,
    PostRaceJockeyWeight              DECIMAL(5,2)    NULL,
    PostRaceWeightByDoctorId          INT             NULL,
    FinishPosition                    INT             NULL,
    FinishTime                        DECIMAL(8,3)    NULL,
    PointsAwarded                     INT             NULL,
    EarningsAwarded                   DECIMAL(18,2)   NULL,
    EntryFeeStatus                    VARCHAR(20)     NOT NULL DEFAULT 'Unpaid',
    EntryFeeConfirmedBy               INT             NULL,
    EntryFeeConfirmedAt               DATETIME2       NULL,
    IsWithdrawn                       BIT             NOT NULL DEFAULT 0,
    WithdrawalReason                  NVARCHAR(255)   NULL,
    UnfitReason                       NVARCHAR(255)   NULL,
    PostRaceWeightFlagged             BIT             NOT NULL DEFAULT 0,
    CreatedAt                         DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt                         DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RaceEntries PRIMARY KEY (RaceEntryId),
    CONSTRAINT FK_RaceEntries_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE NO ACTION,
    CONSTRAINT FK_RaceEntries_Pairing FOREIGN KEY (PairingId) REFERENCES Pairings(PairingId),
    CONSTRAINT FK_RaceEntries_PreDoctor FOREIGN KEY (PreRaceWeightByDoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_HorseIdentityDoctor FOREIGN KEY (HorseIdentityCheckedByDoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_ClinicalDoctor FOREIGN KEY (ClinicalCheckedByDoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_IndependenceReferee FOREIGN KEY (IndependenceCheckedByRefereeId) REFERENCES RefereeProfiles(RefereeId),
    CONSTRAINT FK_RaceEntries_PostDoctor FOREIGN KEY (PostRaceWeightByDoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_FeeConfirmedBy FOREIGN KEY (EntryFeeConfirmedBy) REFERENCES Users(UserId),
    CONSTRAINT UQ_RaceEntries_RacePairing UNIQUE (RaceId, PairingId),
    CONSTRAINT CHK_RaceEntries_PostPos CHECK (PostPosition IS NULL OR PostPosition > 0),
    CONSTRAINT CHK_RaceEntries_Status CHECK ([Status] IN ('Pending','Confirmed','Cancelled','Disqualified')),
    CONSTRAINT CHK_RaceEntries_HorseIdentity CHECK (HorseIdentityCheckStatus IS NULL OR HorseIdentityCheckStatus IN ('Matched','Mismatch')),
    CONSTRAINT CHK_RaceEntries_Clinical CHECK (ClinicalStatus IS NULL OR ClinicalStatus IN ('Fit','Unfit')),
    CONSTRAINT CHK_RaceEntries_Independence CHECK (IndependenceCheckStatus IN ('NotChecked','Passed','Failed','ManualReview')),
    CONSTRAINT CHK_RaceEntries_FinishPos CHECK (FinishPosition IS NULL OR FinishPosition > 0),
    CONSTRAINT CHK_RaceEntries_FeeStatus CHECK (EntryFeeStatus IN ('Unpaid','Paid','Refund Pending','Refunded'))
);
GO

CREATE UNIQUE INDEX UQ_RaceEntries_PostPosition
    ON RaceEntries (RaceId, PostPosition)
    WHERE PostPosition IS NOT NULL;
GO

-- =============================================================================
-- GROUP 4: SUPERVISION, REPORTS & DISPUTES
-- =============================================================================

CREATE TABLE RefereeAssignments (
    RaceId              INT             NOT NULL,
    RefereeId           INT             NOT NULL,
    [Role]              VARCHAR(30)     NOT NULL,
    CoiCheckStatus      VARCHAR(20)     NOT NULL DEFAULT 'NotChecked',
    CoiCheckedAt        DATETIME2       NULL,
    CoiViolationReason  NVARCHAR(500)   NULL,
    AssignedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RefereeAssignments PRIMARY KEY (RaceId, RefereeId),
    CONSTRAINT FK_RefAssign_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE CASCADE,
    CONSTRAINT FK_RefAssign_Referee FOREIGN KEY (RefereeId) REFERENCES RefereeProfiles(RefereeId),
    CONSTRAINT CHK_RefAssign_Role CHECK ([Role] IN ('Lead Referee','Assistant Referee')),
    CONSTRAINT CHK_RefAssign_Coi CHECK (CoiCheckStatus IN ('NotChecked','Passed','Failed','ManualReview'))
);
GO

CREATE UNIQUE INDEX UQ_RefereeAssignments_LeadReferee
    ON RefereeAssignments (RaceId)
    WHERE [Role] = 'Lead Referee';
GO

CREATE TABLE DoctorAssignments (
    RaceId              INT             NOT NULL,
    DoctorId            INT             NOT NULL,
    CoiCheckStatus      VARCHAR(20)     NOT NULL DEFAULT 'NotChecked',
    CoiCheckedAt        DATETIME2       NULL,
    CoiViolationReason  NVARCHAR(500)   NULL,
    AssignedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    CertifiedAt         DATETIME2       NULL,

    CONSTRAINT PK_DoctorAssignments PRIMARY KEY (RaceId, DoctorId),
    CONSTRAINT FK_DocAssign_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE CASCADE,
    CONSTRAINT FK_DocAssign_Doctor FOREIGN KEY (DoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT CHK_DocAssign_Coi CHECK (CoiCheckStatus IN ('NotChecked','Passed','Failed','ManualReview'))
);
GO

CREATE TABLE RaceReports (
    RaceReportId   INT            IDENTITY(1,1) NOT NULL,
    RaceId         INT            NOT NULL,
    LeadRefereeId  INT            NOT NULL,
    Notes          NVARCHAR(MAX)  NULL,
    IsLocked       BIT            NOT NULL DEFAULT 0,
    SubmittedAt    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    LockedAt       DATETIME2      NULL,

    CONSTRAINT PK_RaceReports PRIMARY KEY (RaceReportId),
    CONSTRAINT FK_RaceReports_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE NO ACTION,
    CONSTRAINT FK_RaceReports_LeadReferee FOREIGN KEY (LeadRefereeId) REFERENCES RefereeProfiles(RefereeId),
    CONSTRAINT UQ_RaceReports_Race UNIQUE (RaceId)
);
GO

CREATE TABLE Violations (
    ViolationId         INT             IDENTITY(1,1) NOT NULL,
    RaceReportId        INT             NOT NULL,
    RaceEntryId         INT             NOT NULL,
    ViolationCode       VARCHAR(15)     NOT NULL,
    Penalty             VARCHAR(20)     NOT NULL,
    PlaceBehindEntryId  INT             NULL,
    [Description]       NVARCHAR(255)   NOT NULL,
    LoggedAt            DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Violations PRIMARY KEY (ViolationId),
    CONSTRAINT FK_Violations_RaceReport FOREIGN KEY (RaceReportId) REFERENCES RaceReports(RaceReportId) ON DELETE CASCADE,
    CONSTRAINT FK_Violations_RaceEntry FOREIGN KEY (RaceEntryId) REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT FK_Violations_PlaceBehind FOREIGN KEY (PlaceBehindEntryId) REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT CHK_Violations_Penalty CHECK (Penalty IN ('Disqualified','PlaceBehind','Warning','Scratch'))
);
GO

CREATE TABLE Protests (
    ProtestId            INT             IDENTITY(1,1) NOT NULL,
    RaceId               INT             NOT NULL,
    SubmittedByUserId    INT             NOT NULL,
    AccusedRaceEntryId   INT             NOT NULL,
    ViolationId          INT             NULL,
    [Description]        NVARCHAR(500)   NOT NULL,
    [Status]             VARCHAR(20)     NOT NULL DEFAULT 'Pending',
    RefereeDecision      NVARCHAR(500)   NULL,
    PenaltyApplied       VARCHAR(20)     NULL,
    SubmittedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    ResolvedAt           DATETIME2       NULL,

    CONSTRAINT PK_Protests PRIMARY KEY (ProtestId),
    CONSTRAINT FK_Protests_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId),
    CONSTRAINT FK_Protests_SubmittedBy FOREIGN KEY (SubmittedByUserId) REFERENCES Users(UserId),
    CONSTRAINT FK_Protests_AccusedEntry FOREIGN KEY (AccusedRaceEntryId) REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT FK_Protests_Violation FOREIGN KEY (ViolationId) REFERENCES Violations(ViolationId),
    CONSTRAINT CHK_Protests_Status CHECK ([Status] IN ('Pending','Approved','Rejected')),
    CONSTRAINT CHK_Protests_Penalty CHECK (PenaltyApplied IS NULL OR PenaltyApplied IN ('Disqualified','PlaceBehind','Warning','Scratch'))
);
GO

-- =============================================================================
-- GROUP 5: PREDICTIONS & WALLETS
-- =============================================================================

CREATE TABLE Wallets (
    WalletId     INT        IDENTITY(1,1) NOT NULL,
    SpectatorId  INT        NOT NULL,
    Balance      INT        NOT NULL DEFAULT 0,
    UpdatedAt    DATETIME2  NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Wallets PRIMARY KEY (WalletId),
    CONSTRAINT FK_Wallets_Spectator FOREIGN KEY (SpectatorId) REFERENCES SpectatorProfiles(SpectatorId) ON DELETE NO ACTION,
    CONSTRAINT UQ_Wallets_Spectator UNIQUE (SpectatorId),
    CONSTRAINT CHK_Wallets_Balance CHECK (Balance >= 0)
);
GO

CREATE TABLE TicketRewardCodes (
    TicketRewardCodeId   INT            IDENTITY(1,1) NOT NULL,
    CodeHash             VARBINARY(32)   NOT NULL,
    PointAmount          INT            NOT NULL,
    [Status]             VARCHAR(20)    NOT NULL DEFAULT 'Active',
    ExpiresAt            DATETIME2      NOT NULL,
    RedeemedBySpectatorId INT           NULL,
    RedeemedAt           DATETIME2      NULL,
    CreatedAt            DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_TicketRewardCodes PRIMARY KEY (TicketRewardCodeId),
    CONSTRAINT UQ_TicketRewardCodes_CodeHash UNIQUE (CodeHash),
    CONSTRAINT FK_TicketRewardCodes_RedeemedBy FOREIGN KEY (RedeemedBySpectatorId) REFERENCES SpectatorProfiles(SpectatorId),
    CONSTRAINT CHK_TicketRewardCodes_PointAmount CHECK (PointAmount > 0),
    CONSTRAINT CHK_TicketRewardCodes_Status CHECK ([Status] IN ('Active','Redeemed','Expired','Disabled'))
);
GO

CREATE TABLE VirtualPointsTransactions (
    TransactionId  INT          IDENTITY(1,1) NOT NULL,
    WalletId       INT          NOT NULL,
    Amount         INT          NOT NULL,
    [Type]         VARCHAR(30)  NOT NULL,
    ReferenceType  VARCHAR(30)  NULL,
    ReferenceId    VARCHAR(50)  NULL,
    CreatedAt      DATETIME2    NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_VPT PRIMARY KEY (TransactionId),
    CONSTRAINT FK_VPT_Wallet FOREIGN KEY (WalletId) REFERENCES Wallets(WalletId) ON DELETE NO ACTION,
    CONSTRAINT CHK_VPT_Type CHECK ([Type] IN ('SignUp Bonus','Ticket Code Bonus','Prediction Win Reward','Prediction Refund','Prediction Placed')),
    CONSTRAINT CHK_VPT_ReferenceType CHECK (ReferenceType IS NULL OR ReferenceType IN ('Signup','TicketRewardCode','Prediction','RaceEntry','Adjustment'))
);
GO

CREATE TABLE Predictions (
    PredictionId    INT          IDENTITY(1,1) NOT NULL,
    SpectatorId     INT          NOT NULL,
    RaceId          INT          NOT NULL,
    RaceEntryId     INT          NOT NULL,
    PredictionType  VARCHAR(10)  NOT NULL,
    PointsPlaced    INT          NOT NULL,
    [Status]        VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    PointsAwarded   INT          NULL,
    CreatedAt       DATETIME2    NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Predictions PRIMARY KEY (PredictionId),
    CONSTRAINT FK_Predictions_Spectator FOREIGN KEY (SpectatorId) REFERENCES SpectatorProfiles(SpectatorId),
    CONSTRAINT FK_Predictions_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE NO ACTION,
    CONSTRAINT FK_Predictions_RaceEntry FOREIGN KEY (RaceEntryId) REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT UQ_Predictions_SpectatorEntry UNIQUE (SpectatorId, RaceEntryId, PredictionType),
    CONSTRAINT CHK_Predictions_Type CHECK (PredictionType = 'Win'),
    CONSTRAINT CHK_Predictions_PointsPlaced CHECK (PointsPlaced > 0),
    CONSTRAINT CHK_Predictions_Status CHECK ([Status] IN ('Pending','Won','Lost','Refunded'))
);
GO

-- =============================================================================
-- GROUP 6: PURSE, AUDIT & NOTIFICATIONS
-- =============================================================================

CREATE TABLE PursePayouts (
    PursePayoutId    INT            IDENTITY(1,1) NOT NULL,
    RaceEntryId      INT            NOT NULL,
    RecipientUserId  INT            NOT NULL,
    [Role]           VARCHAR(20)    NOT NULL,
    CalculatedAmount DECIMAL(18,2)  NOT NULL,
    PayoutStatus     VARCHAR(20)    NOT NULL DEFAULT 'Unpaid',
    PaidAt           DATETIME2      NULL,
    UpdatedByAdminId INT            NULL,
    UpdatedAt        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_PursePayouts PRIMARY KEY (PursePayoutId),
    CONSTRAINT FK_PursePayouts_RaceEntry FOREIGN KEY (RaceEntryId) REFERENCES RaceEntries(RaceEntryId) ON DELETE CASCADE,
    CONSTRAINT FK_PursePayouts_Recipient FOREIGN KEY (RecipientUserId) REFERENCES Users(UserId),
    CONSTRAINT FK_PursePayouts_Admin FOREIGN KEY (UpdatedByAdminId) REFERENCES Users(UserId),
    CONSTRAINT CHK_PursePayouts_Role CHECK ([Role] IN ('Owner','Jockey')),
    CONSTRAINT CHK_PursePayouts_Amount CHECK (CalculatedAmount > 0),
    CONSTRAINT CHK_PursePayouts_Status CHECK (PayoutStatus IN ('Unpaid','Paid'))
);
GO

CREATE TABLE AuditLogs (
    AuditLogId  INT            IDENTITY(1,1) NOT NULL,
    ActorId     INT            NOT NULL,
    [Action]    VARCHAR(50)    NOT NULL,
    EntityName  VARCHAR(50)    NOT NULL,
    EntityId    VARCHAR(50)    NOT NULL,
    OldValue    NVARCHAR(MAX)  NULL,
    NewValue    NVARCHAR(MAX)  NULL,
    IpAddress   VARCHAR(45)    NULL,
    UserAgent   VARCHAR(500)   NULL,
    CreatedAt   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_AuditLogs PRIMARY KEY (AuditLogId),
    CONSTRAINT FK_AuditLogs_Actor FOREIGN KEY (ActorId) REFERENCES Users(UserId)
);
GO

CREATE TABLE Notifications (
    NotificationId     INT            IDENTITY(1,1) NOT NULL,
    RecipientId        INT            NOT NULL,
    Title              NVARCHAR(150)  NOT NULL,
    [Message]          NVARCHAR(MAX)  NOT NULL,
    [Type]             VARCHAR(20)    NOT NULL,
    IsRead             BIT            NOT NULL DEFAULT 0,
    RelatedEntityType  VARCHAR(50)    NULL,
    RelatedEntityId    INT            NULL,
    SentAt             DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    ReadAt             DATETIME2      NULL,

    CONSTRAINT PK_Notifications PRIMARY KEY (NotificationId),
    CONSTRAINT FK_Notifications_Recipient FOREIGN KEY (RecipientId) REFERENCES Users(UserId) ON DELETE NO ACTION,
    CONSTRAINT CHK_Notifications_Type CHECK ([Type] IN ('In-app','Email','Both'))
);
GO

-- =============================================================================
-- IMMUTABILITY TRIGGERS
-- =============================================================================

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
            LockedAt      = i.LockedAt
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

-- AuditLogs append-only — REQ-F-SEC.6 / BR-20 (luu giu toi thieu 7 nam)
-- AuditLogs chi cho phep INSERT; moi UPDATE/DELETE bi chan cung o tang DB.
CREATE OR ALTER TRIGGER trg_AuditLogs_AppendOnly
ON AuditLogs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR('AuditLogs is append-only: UPDATE and DELETE are not allowed.', 16, 1);
    ROLLBACK TRANSACTION;
END;
GO

-- (Tuy chon) Cuong che bo sung bang quyen: chay SAU khi da tao app login/user rieng.
-- Bo comment va thay <app_role> bang principal that ma ung dung dung de ket noi DB.
-- DENY UPDATE, DELETE ON AuditLogs   TO <app_role>;
-- DENY UPDATE, DELETE ON RaceReports TO <app_role>;
-- GO

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IX_Users_Role ON Users ([Role]);
CREATE INDEX IX_Users_Status ON Users ([Status]);
CREATE INDEX IX_Users_IdentityHash ON Users (IdentityHash) WHERE IdentityHash IS NOT NULL;
CREATE INDEX IX_Users_NormalizedPhone ON Users (NormalizedPhone) WHERE NormalizedPhone IS NOT NULL;

CREATE INDEX IX_FRD_RelatedIdentityHash ON FamilyRelationshipDeclarations (RelatedIdentityHash) WHERE RelatedIdentityHash IS NOT NULL;
CREATE INDEX IX_FRD_RelatedEmail ON FamilyRelationshipDeclarations (RelatedEmailNormalized) WHERE RelatedEmailNormalized IS NOT NULL;
CREATE INDEX IX_FRD_RelatedPhone ON FamilyRelationshipDeclarations (RelatedPhoneNormalized) WHERE RelatedPhoneNormalized IS NOT NULL;
CREATE INDEX IX_FRD_NameDob ON FamilyRelationshipDeclarations (RelatedPersonName, RelatedDateOfBirth) WHERE RelatedDateOfBirth IS NOT NULL;

CREATE INDEX IX_Tournaments_Status ON Tournaments ([Status]);
CREATE INDEX IX_TP_Roster ON TournamentParticipants (TournamentId, [Role], [Status]);
CREATE INDEX IX_TP_User ON TournamentParticipants (UserId);
CREATE INDEX IX_TP_TournamentUserStatus ON TournamentParticipants (TournamentId, UserId, [Status]);
CREATE INDEX IX_PrizeDist_Tournament ON PrizeDistributions (TournamentId);
CREATE INDEX IX_Rounds_Tournament ON Rounds (TournamentId);
CREATE INDEX IX_Races_Status ON Races ([Status]);
CREATE INDEX IX_Races_Round ON Races (RoundId);

CREATE INDEX IX_Horses_Owner ON Horses (OwnerId);
CREATE INDEX IX_Horses_Tournament ON Horses (TournamentId);
CREATE INDEX IX_Horses_TournamentApproval ON Horses (TournamentId, AdminApprovalStatus);
CREATE INDEX IX_Pairings_Tournament ON Pairings (TournamentId);
CREATE INDEX IX_Pairings_Horse ON Pairings (HorseId);
CREATE INDEX IX_Pairings_Jockey ON Pairings (JockeyId);
CREATE INDEX IX_Pairings_TournamentStatus ON Pairings (TournamentId, [Status]);
CREATE INDEX IX_Pairings_TournamentHorse ON Pairings (TournamentId, HorseId);
CREATE INDEX IX_Pairings_TournamentJockey ON Pairings (TournamentId, JockeyId);
CREATE UNIQUE INDEX UQ_Pairings_ActiveHorseTournament
    ON Pairings (TournamentId, HorseId)
    WHERE [Status] IN ('Pending','Accepted','Confirmed');
CREATE INDEX IX_RaceEntries_Race ON RaceEntries (RaceId);
CREATE INDEX IX_RaceEntries_Pairing ON RaceEntries (PairingId);
CREATE INDEX IX_RaceEntries_Status ON RaceEntries ([Status]);
CREATE INDEX IX_RaceEntries_Independence ON RaceEntries (IndependenceCheckStatus);

CREATE INDEX IX_RefAssign_Coi ON RefereeAssignments (RaceId, CoiCheckStatus);
CREATE INDEX IX_DocAssign_Coi ON DoctorAssignments (RaceId, CoiCheckStatus);

CREATE INDEX IX_TicketRewardCodes_Status ON TicketRewardCodes ([Status], ExpiresAt);
CREATE INDEX IX_TicketRewardCodes_RedeemedBy ON TicketRewardCodes (RedeemedBySpectatorId) WHERE RedeemedBySpectatorId IS NOT NULL;
CREATE INDEX IX_VPT_Wallet ON VirtualPointsTransactions (WalletId);
CREATE INDEX IX_VPT_Type ON VirtualPointsTransactions ([Type]);
CREATE INDEX IX_Predictions_Race ON Predictions (RaceId);
CREATE INDEX IX_Predictions_Spectator ON Predictions (SpectatorId);

CREATE INDEX IX_Notifications_Recipient ON Notifications (RecipientId);
CREATE INDEX IX_Notifications_IsRead ON Notifications (IsRead);
CREATE INDEX IX_AuditLogs_Actor ON AuditLogs (ActorId);
CREATE INDEX IX_AuditLogs_Entity ON AuditLogs (EntityName, EntityId);
CREATE INDEX IX_AuditLogs_CreatedAt ON AuditLogs (CreatedAt);
GO

-- =============================================================================
-- SUMMARY
-- 27 tables - SQL Server 2022 - 3NF
-- Users, JockeyProfiles, OwnerProfiles, RefereeProfiles, DoctorProfiles,
-- SpectatorProfiles, FamilyRelationshipDeclarations,
-- Tournaments, TournamentParticipants, PrizeDistributions, Rounds, Races,
-- Horses, Pairings, RaceEntries,
-- RefereeAssignments, DoctorAssignments, RaceReports, Violations, Protests,
-- Wallets, TicketRewardCodes, VirtualPointsTransactions, Predictions,
-- PursePayouts, AuditLogs, Notifications
--
-- IMMUTABILITY (DB-enforced):
--   trg_RaceReports_Immutable  - chan UPDATE/DELETE bien ban da khoa (IsLocked=1)  [REQ-F-PRT.7]
--   trg_AuditLogs_AppendOnly   - chan moi UPDATE/DELETE tren AuditLogs (append-only) [REQ-F-SEC.6]
-- =============================================================================
