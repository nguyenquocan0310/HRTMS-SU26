-- =============================================================================
-- HRTMS — Horse Racing Tournament Management System
-- DB Schema: SQL Server 2022 · 3NF · Phase 1
-- Dự án: SU26SWP03 | Phiên bản: 1.0 | Ngày: 28/05/2026
-- 25 bảng · PK/FK/CHECK/DEFAULT/UNIQUE đầy đủ
-- =============================================================================
USE master;
GO

IF DB_ID('HRTMS') IS NOT NULL DROP DATABASE HRTMS;
GO
CREATE DATABASE HRTMS
    COLLATE Vietnamese_CI_AS;
GO
USE HRTMS;
GO

-- =============================================================================
-- NHÓM 1: USERS & PROFILE EXTENSIONS (Module A)
-- =============================================================================

CREATE TABLE Users (
    UserId                INT             IDENTITY(1,1)   NOT NULL,
    Username              VARCHAR(50)                     NOT NULL,
    FullName              NVARCHAR(100)                   NOT NULL,
    Email                 VARCHAR(100)                    NOT NULL,
    PasswordHash          VARCHAR(255)                    NOT NULL,   -- BCrypt salt 12
    Role                  VARCHAR(20)                     NOT NULL,
    [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Active',
    FailedLoginAttempts   INT                             NOT NULL    DEFAULT 0,
    LockoutEnd            DATETIME2                       NULL,
    CreatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    UpdatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Username UNIQUE (Username),
    CONSTRAINT UQ_Users_Email    UNIQUE (Email),
    CONSTRAINT CHK_Users_Role    CHECK (Role    IN ('Admin','Owner','Jockey','Referee','Doctor','Spectator')),
    CONSTRAINT CHK_Users_Status  CHECK ([Status] IN ('Active','Pending','Suspended'))
);
GO

-- 1-1 extension: Jockey
CREATE TABLE JockeyProfiles (
    JockeyId              INT             NOT NULL,
    LicenseCertificate    VARCHAR(100)    NOT NULL,
    ExperienceYears       INT             NOT NULL,
    SelfDeclaredWeight    DECIMAL(5,2)    NOT NULL,           -- [EC-39] baseline cân nặng
    BloodType             VARCHAR(5)      NULL,
    HealthStatus          VARCHAR(20)     NULL                DEFAULT 'Good',
    [Status]              VARCHAR(20)     NOT NULL            DEFAULT 'Pending',
    RejectionReason       NVARCHAR(500)   NULL,
    CreatedAt             DATETIME2       NOT NULL,
    UpdatedAt             DATETIME2       NOT NULL            DEFAULT GETUTCDATE(),

    CONSTRAINT PK_JockeyProfiles          PRIMARY KEY (JockeyId),
    CONSTRAINT FK_JockeyProfiles_Users    FOREIGN KEY (JockeyId)          REFERENCES Users(UserId),
    CONSTRAINT UQ_JockeyProfiles_License  UNIQUE (LicenseCertificate),
    CONSTRAINT CHK_JockeyProfiles_ExpYrs  CHECK (ExperienceYears >= 0),
    CONSTRAINT CHK_JockeyProfiles_Weight  CHECK (SelfDeclaredWeight > 0),
    CONSTRAINT CHK_JockeyProfiles_Health  CHECK (HealthStatus IN ('Good','Fair','Under Treatment')),
    CONSTRAINT CHK_JockeyProfiles_Status  CHECK ([Status] IN ('Pending','Active','Suspended','Rejected'))
);
GO

-- 1-1 extension: Owner
CREATE TABLE OwnerProfiles (
    OwnerId               INT             NOT NULL,
    PhoneNumber           VARCHAR(15)     NOT NULL,
    IdentityNumber        VARCHAR(20)     NOT NULL,           -- mã hóa app layer (NĐ 13/2023)
    CreatedAt             DATETIME2       NOT NULL,
    UpdatedAt             DATETIME2       NOT NULL            DEFAULT GETUTCDATE(),

    CONSTRAINT PK_OwnerProfiles           PRIMARY KEY (OwnerId),
    CONSTRAINT FK_OwnerProfiles_Users     FOREIGN KEY (OwnerId)           REFERENCES Users(UserId),
    CONSTRAINT UQ_OwnerProfiles_IdNum     UNIQUE (IdentityNumber)
);
GO

-- 1-1 extension: Referee
CREATE TABLE RefereeProfiles (
    RefereeId             INT             NOT NULL,
    CertificationLevel    VARCHAR(50)     NOT NULL,
    [Status]              VARCHAR(20)     NOT NULL            DEFAULT 'Pending',
    RejectionReason       NVARCHAR(500)   NULL,
    CreatedAt             DATETIME2       NOT NULL,
    UpdatedAt             DATETIME2       NOT NULL            DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RefereeProfiles         PRIMARY KEY (RefereeId),
    CONSTRAINT FK_RefereeProfiles_Users   FOREIGN KEY (RefereeId)         REFERENCES Users(UserId),
    CONSTRAINT CHK_RefereeProfiles_Status CHECK ([Status] IN ('Pending','Active','Suspended'))
);
GO

-- 1-1 extension: Doctor
CREATE TABLE DoctorProfiles (
    DoctorId              INT             NOT NULL,
    MedicalLicenseNumber  VARCHAR(50)     NOT NULL,
    [Status]              VARCHAR(20)     NOT NULL            DEFAULT 'Pending',
    RejectionReason       NVARCHAR(500)   NULL,
    CreatedAt             DATETIME2       NOT NULL,
    UpdatedAt             DATETIME2       NOT NULL            DEFAULT GETUTCDATE(),

    CONSTRAINT PK_DoctorProfiles          PRIMARY KEY (DoctorId),
    CONSTRAINT FK_DoctorProfiles_Users    FOREIGN KEY (DoctorId)          REFERENCES Users(UserId),
    CONSTRAINT UQ_DoctorProfiles_License  UNIQUE (MedicalLicenseNumber),
    CONSTRAINT CHK_DoctorProfiles_Status  CHECK ([Status] IN ('Pending','Active','Suspended'))
);
GO

-- 1-1 extension: Spectator
CREATE TABLE SpectatorProfiles (
    SpectatorId           INT             NOT NULL,
    CreatedAt             DATETIME2       NOT NULL,

    CONSTRAINT PK_SpectatorProfiles       PRIMARY KEY (SpectatorId),
    CONSTRAINT FK_SpectatorProfiles_Users FOREIGN KEY (SpectatorId)       REFERENCES Users(UserId)
);
GO

-- Khai báo quan hệ gia đình — dùng chung Jockey / Referee / Doctor (Module F, G; [EC-38])
CREATE TABLE FamilyRelationshipDeclarations (
    DeclarationId         INT             IDENTITY(1,1)   NOT NULL,
    DeclarantUserId       INT             NOT NULL,
    RelatedPersonName     NVARCHAR(100)   NOT NULL,
    RelatedUserId         INT             NULL,
    RelationType          VARCHAR(20)     NOT NULL,
    IndustryRole          VARCHAR(20)     NULL,
    Notes                 NVARCHAR(255)   NULL,
    DeclaredAt            DATETIME2       NOT NULL        DEFAULT GETUTCDATE(),

    CONSTRAINT PK_FRD                   PRIMARY KEY (DeclarationId),
    -- [EC-11 FIX] NO ACTION: dữ liệu COI/Independence không tự xóa theo User
    CONSTRAINT FK_FRD_Declarant         FOREIGN KEY (DeclarantUserId)     REFERENCES Users(UserId) ON DELETE NO ACTION,
    CONSTRAINT FK_FRD_Related           FOREIGN KEY (RelatedUserId)       REFERENCES Users(UserId) ON DELETE NO ACTION,
    CONSTRAINT CHK_FRD_RelationType     CHECK (RelationType IN ('Spouse','Parent','Child','Sibling'))
);
-- Chống khai báo trùng khi RelatedUserId IS NOT NULL
CREATE UNIQUE INDEX UQ_FRD_DeclarantRelated
    ON FamilyRelationshipDeclarations (DeclarantUserId, RelatedUserId)
    WHERE RelatedUserId IS NOT NULL;
GO

-- =============================================================================
-- NHÓM 2: TOURNAMENT STRUCTURE (Module B)
-- =============================================================================

CREATE TABLE Tournaments (
    TournamentId                    INT             IDENTITY(1,1)   NOT NULL,
    [Name]                          NVARCHAR(150)                   NOT NULL,
    [Description]                   NVARCHAR(MAX)                   NULL,
    StartDate                       DATETIME2                       NOT NULL,
    EndDate                         DATETIME2                       NOT NULL,
    MaxHorses                       INT                             NOT NULL,   -- [EC-46] per-Race
    AllowedBreed                    VARCHAR(30)                     NOT NULL,
    TrackType                       VARCHAR(20)                     NOT NULL,
    RaceDistance                    INT                             NOT NULL,
    RaceCategory                    VARCHAR(20)                     NOT NULL,
    MinJockeyExperienceYears        INT                             NOT NULL    DEFAULT 0,
    PurseAmount                     DECIMAL(18,2)                   NOT NULL,
    EntryFeeAmount                  DECIMAL(10,2)                   NOT NULL    DEFAULT 0,
    PreRaceWeightThresholdKg        DECIMAL(4,2)                    NOT NULL    DEFAULT 2.00,   -- [EC-39]
    PostRaceWeightDiffThresholdKg   DECIMAL(4,2)                    NOT NULL    DEFAULT 1.00,   -- [EC-39]
    [Status]                        VARCHAR(30)                     NOT NULL    DEFAULT 'Draft',
    CreatedAt                       DATETIME2                       NOT NULL,
    UpdatedAt                       DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy                       INT                             NULL,

    CONSTRAINT PK_Tournaments               PRIMARY KEY (TournamentId),
    CONSTRAINT FK_Tournaments_CreatedBy     FOREIGN KEY (CreatedBy)             REFERENCES Users(UserId),
    CONSTRAINT CHK_Tournaments_EndDate      CHECK (EndDate > StartDate),
    CONSTRAINT CHK_Tournaments_MaxHorses    CHECK (MaxHorses > 0),
    CONSTRAINT CHK_Tournaments_Breed        CHECK (AllowedBreed IN ('Thoroughbred','Arabian','Quarter Horse','Mixed')),
    CONSTRAINT CHK_Tournaments_TrackType    CHECK (TrackType IN ('Turf','Dirt','Synthetic')),
    CONSTRAINT CHK_Tournaments_Distance     CHECK (RaceDistance IN (1200,1600,2000,2400)),
    CONSTRAINT CHK_Tournaments_Category     CHECK (RaceCategory IN ('Open','Classic','Maiden')),
    CONSTRAINT CHK_Tournaments_MinExp       CHECK (MinJockeyExperienceYears >= 0),
    CONSTRAINT CHK_Tournaments_Purse        CHECK (PurseAmount >= 0),
    CONSTRAINT CHK_Tournaments_Fee          CHECK (EntryFeeAmount >= 0),
    CONSTRAINT CHK_Tournaments_PreWgt       CHECK (PreRaceWeightThresholdKg > 0),
    CONSTRAINT CHK_Tournaments_PostWgt      CHECK (PostRaceWeightDiffThresholdKg > 0),
    CONSTRAINT CHK_Tournaments_Status       CHECK ([Status] IN (
                                                'Draft','Open Registration','Closed Registration',
                                                'Pre-Race','In-Progress','Completed'))
);
GO

-- Cấu hình tỷ lệ chia Purse (MỚI — EC-33, Module K)
CREATE TABLE PrizeDistributions (
    PrizeDistributionId   INT             IDENTITY(1,1)   NOT NULL,
    TournamentId          INT                             NOT NULL,
    [Position]            INT                             NOT NULL,
    Percentage            DECIMAL(5,2)                    NOT NULL,
    CreatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    UpdatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_PrizeDistributions        PRIMARY KEY (PrizeDistributionId),
    CONSTRAINT FK_PrizeDist_Tournament      FOREIGN KEY (TournamentId)          REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
    CONSTRAINT UQ_PrizeDist_TourPos         UNIQUE (TournamentId, [Position]),
    CONSTRAINT CHK_PrizeDist_Position       CHECK ([Position] BETWEEN 1 AND 5),
    CONSTRAINT CHK_PrizeDist_Percentage     CHECK (Percentage >= 0 AND Percentage <= 100)
);
GO

-- Vòng đấu
CREATE TABLE Rounds (
    RoundId               INT             IDENTITY(1,1)   NOT NULL,
    TournamentId          INT                             NOT NULL,
    [Name]                NVARCHAR(100)                   NOT NULL,
    SequenceOrder         INT                             NOT NULL,
    ScheduledDate         DATETIME2                       NOT NULL,
    [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Upcoming',
    UpdatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Rounds                    PRIMARY KEY (RoundId),
    CONSTRAINT FK_Rounds_Tournament         FOREIGN KEY (TournamentId)          REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
    CONSTRAINT UQ_Rounds_TourSeq            UNIQUE (TournamentId, SequenceOrder),
    CONSTRAINT CHK_Rounds_SeqOrder          CHECK (SequenceOrder > 0),
    CONSTRAINT CHK_Rounds_Status            CHECK ([Status] IN ('Upcoming','In-Progress','Completed','Cancelled'))
);
GO

-- Cuộc đua
CREATE TABLE Races (
    RaceId                    INT             IDENTITY(1,1)   NOT NULL,
    RoundId                   INT                             NOT NULL,
    RaceNumber                INT                             NOT NULL,
    ScheduledTime             DATETIME2                       NOT NULL,   -- [EC-35, EC-48]
    PurseAmount               DECIMAL(18,2)                   NOT NULL,   -- [EC-34]
    TrackTypeOverride         VARCHAR(20)                     NULL,       -- [EC-48]
    RaceDistanceOverride      INT                             NULL,       -- [EC-48]
    [Status]                  VARCHAR(20)                     NOT NULL    DEFAULT 'Upcoming',
    IsPostPositionDrawn       BIT                             NOT NULL    DEFAULT 0,
    IsPredictionGateClosed    BIT                             NOT NULL    DEFAULT 0,
    ConfirmationCutoffHours   INT                             NOT NULL    DEFAULT 24,
    ProtestDeadlineMinutes    INT                             NOT NULL    DEFAULT 120, -- [EC-27]
    CreatedAt                 DATETIME2                       NOT NULL,
    UpdatedAt                 DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Races                     PRIMARY KEY (RaceId),
    CONSTRAINT FK_Races_Round               FOREIGN KEY (RoundId)               REFERENCES Rounds(RoundId) ON DELETE CASCADE,
    CONSTRAINT UQ_Races_RoundNumber         UNIQUE (RoundId, RaceNumber),
    CONSTRAINT CHK_Races_RaceNumber         CHECK (RaceNumber > 0),
    CONSTRAINT CHK_Races_Purse              CHECK (PurseAmount >= 0),
    CONSTRAINT CHK_Races_TrackOverride      CHECK (TrackTypeOverride IS NULL OR TrackTypeOverride IN ('Turf','Dirt','Synthetic')),
    CONSTRAINT CHK_Races_DistOverride       CHECK (RaceDistanceOverride IS NULL OR RaceDistanceOverride IN (1200,1600,2000,2400)),
    CONSTRAINT CHK_Races_Status             CHECK ([Status] IN ('Upcoming','Live','Unofficial','Official','Cancelled')),
    CONSTRAINT CHK_Races_CutoffHrs         CHECK (ConfirmationCutoffHours > 0),
    CONSTRAINT CHK_Races_ProtestMins        CHECK (ProtestDeadlineMinutes > 0)
);
GO

-- =============================================================================
-- NHÓM 3: HORSE & PAIRING (Module C, D)
-- =============================================================================

CREATE TABLE Horses (
    HorseId               INT             IDENTITY(1,1)   NOT NULL,
    OwnerId               INT                             NOT NULL,
    [Name]                NVARCHAR(100)                   NOT NULL,
    BirthYear             INT                             NOT NULL,
    Gender                VARCHAR(10)                     NOT NULL,
    Color                 NVARCHAR(50)                    NOT NULL,
    Pedigree              NVARCHAR(255)                   NULL,
    Weight                DECIMAL(6,2)                    NOT NULL,
    IdentifyingMarks      NVARCHAR(255)                   NOT NULL,
    Breed                 VARCHAR(30)                     NOT NULL,
    VaccinationRecordRef  VARCHAR(100)                    NOT NULL,
    DopingTestDate        DATE                            NOT NULL,
    DopingTestResult      VARCHAR(20)                     NOT NULL    DEFAULT 'Pending',
    [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Declared',
    AdminApprovalStatus   VARCHAR(20)                     NOT NULL    DEFAULT 'Pending',
    RejectionReason       NVARCHAR(500)                   NULL,
    CreatedAt             DATETIME2                       NOT NULL,
    UpdatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Horses                    PRIMARY KEY (HorseId),
    CONSTRAINT FK_Horses_Owner              FOREIGN KEY (OwnerId)               REFERENCES OwnerProfiles(OwnerId),
    CONSTRAINT CHK_Horses_BirthYear         CHECK (BirthYear <= YEAR(GETDATE())),
    CONSTRAINT CHK_Horses_Gender            CHECK (Gender IN ('Male','Female','Gelding')),
    CONSTRAINT CHK_Horses_Weight            CHECK (Weight > 0),
    CONSTRAINT CHK_Horses_Breed             CHECK (Breed IN ('Thoroughbred','Arabian','Quarter Horse','Mixed')),
    CONSTRAINT CHK_Horses_DopingResult      CHECK (DopingTestResult IN ('Clean','Pending','Failed')),
    CONSTRAINT CHK_Horses_Status            CHECK ([Status] IN ('Declared','Active','Retired')),
    CONSTRAINT CHK_Horses_ApprovalStatus    CHECK (AdminApprovalStatus IN ('Pending','Approved','Rejected'))
);
GO

-- Ghép cặp Horse–Jockey (Module D)
CREATE TABLE Pairings (
    PairingId             INT             IDENTITY(1,1)   NOT NULL,
    HorseId               INT                             NOT NULL,
    JockeyId              INT                             NOT NULL,
    [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Pending',
    RequestMessage        NVARCHAR(255)                   NULL,
    ResponseReason        NVARCHAR(255)                   NULL,
    CreatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    UpdatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Pairings                  PRIMARY KEY (PairingId),
    CONSTRAINT FK_Pairings_Horse            FOREIGN KEY (HorseId)               REFERENCES Horses(HorseId),
    CONSTRAINT FK_Pairings_Jockey           FOREIGN KEY (JockeyId)              REFERENCES JockeyProfiles(JockeyId),
    CONSTRAINT CHK_Pairings_Status          CHECK ([Status] IN ('Pending','Accepted','Declined'))
);
GO

-- =============================================================================
-- NHÓM 4: RACE ENTRIES — Junction N-N Races × Pairings (Module E, G, H, J)
-- =============================================================================

CREATE TABLE RaceEntries (
    RaceEntryId               INT             IDENTITY(1,1)   NOT NULL,
    RaceId                    INT                             NOT NULL,
    PairingId                 INT                             NOT NULL,
    PostPosition              INT                             NULL,       -- [EC-06]
    [Status]                  VARCHAR(30)                     NOT NULL    DEFAULT 'Pending',
    PreRaceJockeyWeight       DECIMAL(5,2)                    NULL,       -- Doctor ghi (Node 4.1-MD)
    PreRaceWeightByDoctorId   INT                             NULL,
    PostRaceJockeyWeight      DECIMAL(5,2)                    NULL,       -- Doctor ghi (Node 5.1-WO) [EC-42]
    PostRaceWeightByDoctorId  INT                             NULL,
    FinishPosition            INT                             NULL,       -- dead-heat OK [EC-02/EC-14]
    FinishTime                DECIMAL(8,3)                    NULL,       -- giây (vd: 95.240)
    PointsAwarded             INT                             NULL,       -- Leaderboard Module L
    EarningsAwarded           DECIMAL(18,2)                   NULL,       -- Purse phân bổ Module K
    EntryFeeStatus            VARCHAR(20)                     NOT NULL    DEFAULT 'Unpaid',  -- [EC-32]
    EntryFeeConfirmedBy       INT                             NULL,
    EntryFeeConfirmedAt       DATETIME2                       NULL,
    IsWithdrawn               BIT                             NOT NULL    DEFAULT 0,
    WithdrawalReason          NVARCHAR(255)                   NULL,
    UnfitReason               NVARCHAR(255)                   NULL,
    PostRaceWeightFlagged     BIT                             NOT NULL    DEFAULT 0,
    CreatedAt                 DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    UpdatedAt                 DATETIME2                       NOT NULL,

    CONSTRAINT PK_RaceEntries                   PRIMARY KEY (RaceEntryId),
    -- [EC-12 FIX] NO ACTION: cấm xóa Race còn RaceEntry
    CONSTRAINT FK_RaceEntries_Race              FOREIGN KEY (RaceId)                REFERENCES Races(RaceId)             ON DELETE NO ACTION,
    CONSTRAINT FK_RaceEntries_Pairing           FOREIGN KEY (PairingId)             REFERENCES Pairings(PairingId),
    CONSTRAINT FK_RaceEntries_PreDoctor         FOREIGN KEY (PreRaceWeightByDoctorId)  REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_PostDoctor        FOREIGN KEY (PostRaceWeightByDoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_FeeConfirmedBy    FOREIGN KEY (EntryFeeConfirmedBy)   REFERENCES Users(UserId),
    CONSTRAINT UQ_RaceEntries_RacePairing       UNIQUE (RaceId, PairingId),
    CONSTRAINT CHK_RaceEntries_PostPos          CHECK (PostPosition IS NULL OR PostPosition > 0),
    CONSTRAINT CHK_RaceEntries_Status           CHECK ([Status] IN ('Pending','Confirmed','Cancelled','Disqualified')),
    CONSTRAINT CHK_RaceEntries_FinishPos        CHECK (FinishPosition IS NULL OR FinishPosition > 0),
    CONSTRAINT CHK_RaceEntries_FeeStatus        CHECK (EntryFeeStatus IN ('Unpaid','Paid','Refund Pending','Refunded'))
);
-- [EC-06] Filtered UNIQUE: chống hai ngựa cùng cổng xuất phát, bỏ qua Withdrawn (PostPosition NULL)
CREATE UNIQUE INDEX UQ_RaceEntries_PostPosition
    ON RaceEntries (RaceId, PostPosition)
    WHERE PostPosition IS NOT NULL;
GO

-- =============================================================================
-- NHÓM 5: REFEREE & DOCTOR ASSIGNMENTS (Module F, G; [EC-38])
-- =============================================================================

-- Junction N-N Races × RefereeProfiles
CREATE TABLE RefereeAssignments (
    RaceId                INT             NOT NULL,
    RefereeId             INT             NOT NULL,
    [Role]                VARCHAR(30)     NOT NULL,
    AssignedAt            DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RefereeAssignments            PRIMARY KEY (RaceId, RefereeId),
    CONSTRAINT FK_RefAssign_Race                FOREIGN KEY (RaceId)    REFERENCES Races(RaceId)            ON DELETE CASCADE,
    CONSTRAINT FK_RefAssign_Referee             FOREIGN KEY (RefereeId) REFERENCES RefereeProfiles(RefereeId),
    CONSTRAINT CHK_RefAssign_Role               CHECK ([Role] IN ('Lead Referee','Assistant Referee'))
);
-- [EC-45] Mỗi Race tối đa 1 Lead Referee
CREATE UNIQUE INDEX UQ_RefereeAssignments_LeadReferee
    ON RefereeAssignments (RaceId)
    WHERE [Role] = 'Lead Referee';
GO

-- Junction N-N Races × DoctorProfiles (MỚI — EC-38)
CREATE TABLE DoctorAssignments (
    RaceId                INT             NOT NULL,
    DoctorId              INT             NOT NULL,
    AssignedAt            DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CertifiedAt           DATETIME2       NULL,       -- Doctor COI Check pass timestamp

    CONSTRAINT PK_DoctorAssignments             PRIMARY KEY (RaceId, DoctorId),
    CONSTRAINT FK_DocAssign_Race                FOREIGN KEY (RaceId)    REFERENCES Races(RaceId)            ON DELETE CASCADE,
    CONSTRAINT FK_DocAssign_Doctor              FOREIGN KEY (DoctorId)  REFERENCES DoctorProfiles(DoctorId)
);
GO

-- =============================================================================
-- NHÓM 6: RACE REPORTS, VIOLATIONS & PROTESTS (Module H, I)
-- =============================================================================

-- Biên bản thi đấu — khóa bất biến khi Declare Official [EC-19]
CREATE TABLE RaceReports (
    RaceReportId          INT             IDENTITY(1,1)   NOT NULL,
    RaceId                INT                             NOT NULL,
    LeadRefereeId         INT                             NOT NULL,
    Notes                 NVARCHAR(MAX)                   NULL,
    IsLocked              BIT                             NOT NULL    DEFAULT 0,
    SubmittedAt           DATETIME2                       NOT NULL,
    LockedAt              DATETIME2                       NULL,       -- NOT NULL khi IsLocked=1

    CONSTRAINT PK_RaceReports                   PRIMARY KEY (RaceReportId),
    -- [EC-12 FIX] NO ACTION: biên bản không cascade xóa theo Race
    CONSTRAINT FK_RaceReports_Race              FOREIGN KEY (RaceId)        REFERENCES Races(RaceId)            ON DELETE NO ACTION,
    CONSTRAINT FK_RaceReports_LeadReferee       FOREIGN KEY (LeadRefereeId) REFERENCES RefereeProfiles(RefereeId),
    CONSTRAINT UQ_RaceReports_Race              UNIQUE (RaceId)             -- 1 Race → 1 RaceReport
);
GO

-- Vi phạm (Module H)
CREATE TABLE Violations (
    ViolationId           INT             IDENTITY(1,1)   NOT NULL,
    RaceReportId          INT                             NOT NULL,
    RaceEntryId           INT                             NOT NULL,
    ViolationCode         VARCHAR(15)                     NOT NULL,
    Penalty               VARCHAR(20)                     NOT NULL,
    PlaceBehindEntryId    INT                             NULL,       -- NOT NULL khi Penalty='PlaceBehind'
    [Description]         NVARCHAR(255)                   NOT NULL,
    LoggedAt              DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Violations                    PRIMARY KEY (ViolationId),
    CONSTRAINT FK_Violations_RaceReport         FOREIGN KEY (RaceReportId)      REFERENCES RaceReports(RaceReportId) ON DELETE CASCADE,
    CONSTRAINT FK_Violations_RaceEntry          FOREIGN KEY (RaceEntryId)       REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT FK_Violations_PlaceBehind        FOREIGN KEY (PlaceBehindEntryId) REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT CHK_Violations_Penalty           CHECK (Penalty IN ('Disqualified','PlaceBehind','Warning','Scratch'))
);
GO

-- Khiếu nại (Module I)
CREATE TABLE Protests (
    ProtestId             INT             IDENTITY(1,1)   NOT NULL,
    RaceId                INT                             NOT NULL,
    SubmittedByUserId     INT                             NOT NULL,   -- [EC-43]
    AccusedRaceEntryId    INT                             NOT NULL,   -- [EC-44]
    ViolationId           INT                             NULL,
    [Description]         NVARCHAR(500)                   NOT NULL,
    [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Pending',
    RefereeDecision       NVARCHAR(500)                   NULL,
    PenaltyApplied        VARCHAR(20)                     NULL,
    SubmittedAt           DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    ResolvedAt            DATETIME2                       NULL,       -- NOT NULL khi Approved/Rejected

    CONSTRAINT PK_Protests                      PRIMARY KEY (ProtestId),
    CONSTRAINT FK_Protests_Race                 FOREIGN KEY (RaceId)                REFERENCES Races(RaceId),
    CONSTRAINT FK_Protests_SubmittedBy          FOREIGN KEY (SubmittedByUserId)     REFERENCES Users(UserId),
    CONSTRAINT FK_Protests_AccusedEntry         FOREIGN KEY (AccusedRaceEntryId)    REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT FK_Protests_Violation            FOREIGN KEY (ViolationId)           REFERENCES Violations(ViolationId),
    CONSTRAINT CHK_Protests_Status              CHECK ([Status] IN ('Pending','Approved','Rejected')),
    CONSTRAINT CHK_Protests_Penalty             CHECK (PenaltyApplied IS NULL OR PenaltyApplied IN ('Disqualified','PlaceBehind','Warning','Scratch'))
);
GO

-- =============================================================================
-- NHÓM 7: WALLET & VIRTUAL POINTS (Module N)
-- =============================================================================

-- Ví điểm ảo của Spectator
CREATE TABLE Wallets (
    WalletId              INT             IDENTITY(1,1)   NOT NULL,
    SpectatorId           INT                             NOT NULL,
    Balance               INT                             NOT NULL    DEFAULT 0,  -- [EC-47] cached ledger
    UpdatedAt             DATETIME2                       NOT NULL,

    CONSTRAINT PK_Wallets                       PRIMARY KEY (WalletId),
    -- [EC-11 FIX] NO ACTION: ví không bị xóa theo Spectator
    CONSTRAINT FK_Wallets_Spectator             FOREIGN KEY (SpectatorId)   REFERENCES SpectatorProfiles(SpectatorId) ON DELETE NO ACTION,
    CONSTRAINT UQ_Wallets_Spectator             UNIQUE (SpectatorId),       -- 1 Spectator → 1 Wallet
    CONSTRAINT CHK_Wallets_Balance              CHECK (Balance >= 0)
);
GO

-- Sổ cái giao dịch điểm ảo (Ledger — append-only audit ≥7 năm)
CREATE TABLE VirtualPointsTransactions (
    TransactionId         INT             IDENTITY(1,1)   NOT NULL,
    WalletId              INT                             NOT NULL,
    Amount                INT                             NOT NULL,   -- dương: nhận; âm: đặt cược
    [Type]                VARCHAR(30)                     NOT NULL,
    ReferenceId           VARCHAR(50)                     NULL,
    CreatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_VPT                           PRIMARY KEY (TransactionId),
    -- [EC-11 FIX] NO ACTION: sổ cái bất khả xâm phạm
    CONSTRAINT FK_VPT_Wallet                    FOREIGN KEY (WalletId)  REFERENCES Wallets(WalletId) ON DELETE NO ACTION,
    CONSTRAINT CHK_VPT_Type                     CHECK ([Type] IN ('SignUp Bonus','Prediction Win Reward','Prediction Refund','Prediction Placed'))
);
GO

-- =============================================================================
-- NHÓM 8: PREDICTIONS (Module M)
-- =============================================================================

CREATE TABLE Predictions (
    PredictionId          INT             IDENTITY(1,1)   NOT NULL,
    SpectatorId           INT                             NOT NULL,
    RaceId                INT                             NOT NULL,
    RaceEntryId           INT                             NOT NULL,
    PredictionType        VARCHAR(10)                     NOT NULL,   -- chỉ 'Win' Phase 1 (BR-10)
    PointsPlaced          INT                             NOT NULL,
    [Status]              VARCHAR(20)                     NOT NULL    DEFAULT 'Pending',
    PointsAwarded         INT                             NULL,
    CreatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Predictions                   PRIMARY KEY (PredictionId),
    CONSTRAINT FK_Predictions_Spectator         FOREIGN KEY (SpectatorId)   REFERENCES SpectatorProfiles(SpectatorId),
    -- [EC-12 FIX] NO ACTION: dự đoán (đã trừ điểm) không cascade xóa theo Race
    CONSTRAINT FK_Predictions_Race              FOREIGN KEY (RaceId)        REFERENCES Races(RaceId)            ON DELETE NO ACTION,
    CONSTRAINT FK_Predictions_RaceEntry         FOREIGN KEY (RaceEntryId)   REFERENCES RaceEntries(RaceEntryId),
    CONSTRAINT UQ_Predictions_SpectatorEntry    UNIQUE (SpectatorId, RaceEntryId, PredictionType),
    CONSTRAINT CHK_Predictions_Type             CHECK (PredictionType = 'Win'),
    CONSTRAINT CHK_Predictions_PointsPlaced     CHECK (PointsPlaced > 0),
    CONSTRAINT CHK_Predictions_Status           CHECK ([Status] IN ('Pending','Won','Lost','Refunded'))
);
GO

-- =============================================================================
-- NHÓM 9: PURSE PAYOUTS (Module K)
-- =============================================================================

CREATE TABLE PursePayouts (
    PursePayoutId         INT             IDENTITY(1,1)   NOT NULL,
    RaceEntryId           INT                             NOT NULL,
    RecipientUserId       INT                             NOT NULL,
    [Role]                VARCHAR(20)                     NOT NULL,
    CalculatedAmount      DECIMAL(18,2)                   NOT NULL,
    PayoutStatus          VARCHAR(20)                     NOT NULL    DEFAULT 'Unpaid',
    PaidAt                DATETIME2                       NULL,       -- NOT NULL khi Paid
    UpdatedByAdminId      INT                             NULL,
    UpdatedAt             DATETIME2                       NOT NULL,

    CONSTRAINT PK_PursePayouts                  PRIMARY KEY (PursePayoutId),
    CONSTRAINT FK_PursePayouts_RaceEntry        FOREIGN KEY (RaceEntryId)       REFERENCES RaceEntries(RaceEntryId) ON DELETE CASCADE,
    CONSTRAINT FK_PursePayouts_Recipient        FOREIGN KEY (RecipientUserId)   REFERENCES Users(UserId),
    CONSTRAINT FK_PursePayouts_Admin            FOREIGN KEY (UpdatedByAdminId)  REFERENCES Users(UserId),
    CONSTRAINT CHK_PursePayouts_Role            CHECK ([Role] IN ('Owner','Jockey')),
    CONSTRAINT CHK_PursePayouts_Amount          CHECK (CalculatedAmount > 0),
    CONSTRAINT CHK_PursePayouts_Status          CHECK (PayoutStatus IN ('Unpaid','Paid'))
);
GO

-- =============================================================================
-- NHÓM 10: AUDIT LOGS & NOTIFICATIONS (Module O, Q)
-- =============================================================================

-- Nhật ký kiểm toán bất biến — append-only, lưu ≥7 năm [EC-19]
CREATE TABLE AuditLogs (
    AuditLogId            INT             IDENTITY(1,1)   NOT NULL,
    ActorId               INT                             NOT NULL,
    [Action]              VARCHAR(50)                     NOT NULL,
    EntityName            VARCHAR(50)                     NOT NULL,
    EntityId              VARCHAR(50)                     NOT NULL,
    OldValue              NVARCHAR(MAX)                   NULL,   -- JSON
    NewValue              NVARCHAR(MAX)                   NULL,   -- JSON
    IpAddress             VARCHAR(45)                     NULL,
    UserAgent             VARCHAR(500)                    NULL,
    CreatedAt             DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),

    CONSTRAINT PK_AuditLogs         PRIMARY KEY (AuditLogId),
    CONSTRAINT FK_AuditLogs_Actor   FOREIGN KEY (ActorId) REFERENCES Users(UserId)
);
GO

-- Thông báo In-app & Email (Module O)
CREATE TABLE Notifications (
    NotificationId        INT             IDENTITY(1,1)   NOT NULL,
    RecipientId           INT                             NOT NULL,
    Title                 NVARCHAR(150)                   NOT NULL,
    [Message]             NVARCHAR(MAX)                   NOT NULL,
    [Type]                VARCHAR(20)                     NOT NULL,
    IsRead                BIT                             NOT NULL    DEFAULT 0,
    RelatedEntityType     VARCHAR(50)                     NULL,
    RelatedEntityId       INT                             NULL,
    SentAt                DATETIME2                       NOT NULL    DEFAULT GETUTCDATE(),
    ReadAt                DATETIME2                       NULL,       -- NOT NULL khi IsRead=1

    CONSTRAINT PK_Notifications                 PRIMARY KEY (NotificationId),
    -- [EC-11 FIX] NO ACTION: lịch sử thông báo không bị xóa theo User
    CONSTRAINT FK_Notifications_Recipient       FOREIGN KEY (RecipientId) REFERENCES Users(UserId) ON DELETE NO ACTION,
    CONSTRAINT CHK_Notifications_Type           CHECK ([Type] IN ('In-app','Email','Both'))
);
GO

-- =============================================================================
-- TRIGGERS BẤT BIẾN (EC-19)
-- =============================================================================

-- Trigger: RaceReports bất biến khi IsLocked = 1
CREATE OR ALTER TRIGGER trg_RaceReports_Immutable
ON RaceReports
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM deleted d
        WHERE d.IsLocked = 1
    )
    BEGIN
        RAISERROR('RaceReport đã khóa (IsLocked=1): không thể sửa hoặc xóa.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    -- Cho phép UPDATE khi IsLocked = 0
    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        UPDATE rr
        SET
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

-- =============================================================================
-- INDEXES HIỆU NĂNG
-- =============================================================================

-- Users
CREATE INDEX IX_Users_Role       ON Users (Role);
CREATE INDEX IX_Users_Status     ON Users ([Status]);

-- Horses
CREATE INDEX IX_Horses_Owner     ON Horses (OwnerId);
CREATE INDEX IX_Horses_Approval  ON Horses (AdminApprovalStatus);

-- Races
CREATE INDEX IX_Races_Status     ON Races ([Status]);
CREATE INDEX IX_Races_Round      ON Races (RoundId);

-- RaceEntries
CREATE INDEX IX_RaceEntries_Race     ON RaceEntries (RaceId);
CREATE INDEX IX_RaceEntries_Pairing  ON RaceEntries (PairingId);
CREATE INDEX IX_RaceEntries_Status   ON RaceEntries ([Status]);

-- Predictions
CREATE INDEX IX_Predictions_Race         ON Predictions (RaceId);
CREATE INDEX IX_Predictions_Spectator    ON Predictions (SpectatorId);

-- Notifications
CREATE INDEX IX_Notifications_Recipient  ON Notifications (RecipientId);
CREATE INDEX IX_Notifications_IsRead     ON Notifications (IsRead);

-- AuditLogs
CREATE INDEX IX_AuditLogs_Actor      ON AuditLogs (ActorId);
CREATE INDEX IX_AuditLogs_Entity     ON AuditLogs (EntityName, EntityId);
CREATE INDEX IX_AuditLogs_CreatedAt  ON AuditLogs (CreatedAt);

-- VirtualPointsTransactions
CREATE INDEX IX_VPT_Wallet       ON VirtualPointsTransactions (WalletId);

GO

-- =============================================================================
-- SUMMARY
-- 25 bảng · SQL Server 2022 · 3NF
-- Users, JockeyProfiles, OwnerProfiles, RefereeProfiles, DoctorProfiles,
-- SpectatorProfiles, FamilyRelationshipDeclarations,
-- Tournaments, PrizeDistributions, Rounds, Races,
-- Horses, Pairings, RaceEntries,
-- RefereeAssignments, DoctorAssignments,
-- RaceReports, Violations, Protests,
-- Wallets, VirtualPointsTransactions, Predictions,
-- PursePayouts, AuditLogs, Notifications
-- =============================================================================
