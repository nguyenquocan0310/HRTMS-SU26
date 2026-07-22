-- =============================================================================
-- HRTMS_schema_snapshot.sql — SNAPSHOT THAM KHẢO CHO DATABASE HRTMS
-- =============================================================================
-- FILE TÁI TẠO SCHEMA: chạy file này = XÓA SẠCH toàn bộ bảng (kể cả dữ liệu,
-- kể cả bảng Hangfire) trong database HRTMS rồi tạo mới schema từ đầu.
-- Snapshot không chứa DROP/CREATE/ALTER DATABASE. HRTMS là database dùng chung;
-- mọi thay đổi schema thực tế phải đi qua source schema/patch ngoài thư mục demo.
--
-- Nguồn gộp (CHỈ ĐỌC, không sửa nguồn):
--   • Schema gốc : D:\study\SUMMER2026\SWP391\HRTMS-SU26\database\hrtms_schema.sql
--                  (26 bảng, Version 2.0, cập nhật 2026-06-27)
--   • Patches    : D:\study\SUMMER2026\SWP391\HRTMS-SU26\database\patches\
--
-- Danh sách patch đã gộp — ÁP DỤNG THEO ĐÚNG THỨ TỰ SỐ FILE:
--   001_horse_stable_decoupling  : tách Horses khỏi giải, thêm HorseTournamentEntries,
--                                  đổi FK Pairings -> enrollment. (Có INSERT backfill —
--                                  no-op trên DB mới rỗng.)
--   002_tournament_progression   : Tournaments.AdvancementRule/AdvancementCount +
--                                  RaceEntries.AdvancementStatus/Rank/Reason + index.
--   003_upload_file_table        : bảng Certificates; gỡ UNIQUE trên cột license text.
--   004_live_race_simulation     : Races.ActualStartTime (Module H live race).
--   005_row_version_concurrency  : Races.RowVersion + RaceEntries.RowVersion (ROWVERSION).
--   006_system_user_seed         : role 'System' + seed user hệ thống `system`
--                                  (⚠️ patch chứa SEED — user `system` được tạo tự động,
--                                  PasswordHash='LOGIN_DISABLED', không đăng nhập được).
--   007_remove_coi_check.sql     : đã fold vào bản cuối; không tạo bảng/field/index
--                                  đã bị loại bỏ trong schema demo.
--   008_ticket_code_plaintext.sql: đã fold — TicketRewardCodes dùng Code VARCHAR(20)
--                                  plaintext + UQ_TicketRewardCodes_Code (bỏ CodeHash).
--   008_120_to_10_minutes.sql    : đã fold — Races.ProtestDeadlineMinutes DEFAULT 120 -> 10
--                                  (đặt tên constraint DF_Races_ProtestDeadlineMinutes).
--                                  ⚠️ Trùng số 008 với patch ticket — hai file khác nhau,
--                                  không phụ thuộc nhau nên thứ tự áp dụng tuỳ ý.
--   009_ref_can_close_early.sql  : đã fold — RaceReports.ProtestWindowClosedAt + trigger
--                                  trg_RaceReports_Immutable thêm cột này vào whitelist.
--   010_audit_action_nvarchar.sql: đã fold — AuditLogs.Action VARCHAR(50) -> NVARCHAR(100).
--   011_venue.sql                : bảng Venues (TrackType/TrackLengthMeters/LaneCount 2..24/
--                                  IsActive) + Tournaments.VenueId (NULL, FK, index).
--                                  DDL đã fold; ⚠️ patch chứa SEED — 4 sân đua VN
--                                  (Phú Thọ / Đại Nam / Thiên Mã Madagui active,
--                                  Sóc Sơn inactive) giữ ở section Patch 011 cuối file.
--                                  Backfill "giải cũ -> Phú Thọ" là no-op trên DB rỗng.
--   012_entry_fee_payment.sql    : bảng EntryFeePayments + UQ_EFP_ActivePerPairing
--                                  (filtered unique: PendingVerification/Verified) +
--                                  IX_EFP_Status + Tournaments.PaymentDeadline/
--                                  RefundDeadline. Đã fold cả 2 CHECK mở rộng:
--                                  Pairings.Status += 'PendingVerification',
--                                  RaceEntries.Status += 'Scratched'.
--                                  Backfill payment là no-op trên DB rỗng.
--   013_round_waitlist.sql       : bảng RoundWaitlist (RoundId, PairingId, Position,
--                                  CreatedAt) + unique (RoundId,PairingId) và
--                                  (RoundId,Position). Đã fold; không có seed.
--
-- Thời điểm cập nhật : 2026-07-22
-- Cách tạo           : schema gốc + patch 001→013 theo thứ tự; thay đổi xóa của
--                      patch 007 (bỏ COI) và 008 (008_ticket_code_plaintext.sql —
--                      TicketRewardCodes.Code plaintext thay CodeHash) được fold
--                      trực tiếp vào DDL cuối.
--
-- ĐIỂM CẦN KIỂM TRA THỦ CÔNG (chi tiết: schema/schema-merge-report.md):
--   1. Patch 006 thay CHK_Users_Role + CHK_Users_ProfessionalIdentity bằng DROP/ADD
--      — bản cuối là bản của patch 006 (có role 'System').
--   2. Patch 001 DROP cột/FK/INDEX của schema gốc rồi tạo bảng mới — hợp lệ vì mọi
--      patch đều idempotent (IF EXISTS / IF NOT EXISTS).
--   3. Patch 001 (backfill), 006 (system user) và 011 (4 sân đua) chứa INSERT —
--      seed nằm trong patch.
--   4. Không có bảng/cột/constraint/index trùng tên giữa các patch.
--   5. Patch 012 KHÔNG dùng DROP/ADD CHECK như file patch gốc: trong snapshot thì
--      CHK_Pairings_Status và CHK_RaceEntries_Status được viết thẳng ở CREATE TABLE
--      với tập giá trị đã mở rộng (có 'PendingVerification' / 'Scratched').
-- =============================================================================

-- #############################################################################
-- ## PHẦN A — SCHEMA GỐC (snapshot tham khảo, target HRTMS)
-- #############################################################################
-- =============================================================================
-- HRTMS - Horse Racing Tournament Management System
-- DB Schema: SQL Server 2022 - 3NF - Phase 1 Final
-- Project: SU26SWP03 | Version: 2.0 | Updated: 2026-06-27
-- 26 bảng nền; 31 bảng sau khi hợp nhất patches 001-013 (thêm HorseTournamentEntries,
-- Certificates, Venues, EntryFeePayments, RoundWaitlist) - PK/FK/CHECK/DEFAULT/UNIQUE/INDEX
-- =============================================================================

-- Không có database lifecycle trong snapshot. Runner demo không thực thi file này.

-- =============================================================================
-- CHỐT AN TOÀN KHI LỠ BẤM EXECUTE TRONG SSMS:
--   • Sai database đích, hoặc schema đã tồn tại (bảng Users có sẵn)
--     -> báo lỗi + BẬT NOEXEC: mọi batch phía dưới chỉ được parse, KHÔNG thực thi
--        (không còn loạt lỗi Msg 2714 "already an object named ...").
--   • Chỉ khi database HRTMS hoàn toàn trống schema, file mới thực sự chạy.
-- =============================================================================
IF DB_NAME() <> N'HRTMS'
BEGIN
    RAISERROR(N'DỪNG: snapshot chỉ dành cho database HRTMS. Phần dưới bị bỏ qua (NOEXEC).', 16, 1);
    SET NOEXEC ON;
END
GO
-- =============================================================================
-- XÓA SẠCH SCHEMA CŨ (chủ đích): chạy file này nghĩa là tạo mới schema HRTMS.
-- Drop toàn bộ FOREIGN KEY rồi drop toàn bộ bảng user (gồm cả Hangfire — BE sẽ
-- tự tạo lại khi khởi động). Không đụng tới cấp DATABASE (không drop/tạo lại DB).
-- ⚠️ Mọi dữ liệu hiện có trong HRTMS sẽ mất — chỉ chạy khi thật sự muốn làm lại.
-- =============================================================================
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
             + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk JOIN sys.tables t ON t.object_id = fk.parent_object_id;
EXEC sp_executesql @sql;

SET @sql = N'';
SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
FROM sys.tables;
EXEC sp_executesql @sql;
PRINT N'Đã xóa toàn bộ bảng cũ trong HRTMS — bắt đầu tạo schema mới.';
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

-- =============================================================================
-- GROUP 2: TOURNAMENT STRUCTURE
-- =============================================================================

-- Sân đua vật lý (patch 011). LaneCount = số cổng xuất phát, là trần cứng cho
-- sức chứa mỗi cuộc đua: Tournament.MaxHorses <= Venue.LaneCount (enforce ở service).
CREATE TABLE Venues (
    VenueId            INT             IDENTITY(1,1) NOT NULL,
    [Name]             NVARCHAR(200)   NOT NULL,
    [Address]          NVARCHAR(500)   NULL,
    City               NVARCHAR(100)   NULL,
    TrackType          VARCHAR(20)     NOT NULL,
    TrackLengthMeters  INT             NOT NULL,
    LaneCount          INT             NOT NULL,
    IsActive           BIT             NOT NULL DEFAULT 1,
    CreatedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_Venues PRIMARY KEY (VenueId),
    CONSTRAINT CHK_Venues_TrackType CHECK (TrackType IN ('Dirt','Turf','Synthetic')),
    CONSTRAINT CHK_Venues_TrackLength CHECK (TrackLengthMeters > 0),
    CONSTRAINT CHK_Venues_LaneCount CHECK (LaneCount BETWEEN 2 AND 24)
);
GO

CREATE UNIQUE INDEX UQ_Venues_Name ON Venues ([Name]);
GO

CREATE INDEX IX_Venues_IsActive ON Venues (IsActive);
GO

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
    -- patch 011: NULL ở DB để không phá giải cũ; service bắt buộc cho giải mới.
    VenueId                        INT             NULL,
    -- patch 012: hạn nộp lệ phí / hạn hoàn phí. NULL = không áp hạn.
    PaymentDeadline                DATETIME2       NULL,
    RefundDeadline                 DATETIME2       NULL,
    CreatedAt                      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt                      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy                      INT             NULL,

    CONSTRAINT PK_Tournaments PRIMARY KEY (TournamentId),
    CONSTRAINT FK_Tournaments_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserId),
    CONSTRAINT FK_Tournaments_Venue FOREIGN KEY (VenueId) REFERENCES Venues(VenueId),
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

CREATE INDEX IX_Tournaments_VenueId ON Tournaments (VenueId) WHERE VenueId IS NOT NULL;
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
    ProtestDeadlineMinutes   INT            NOT NULL
        CONSTRAINT DF_Races_ProtestDeadlineMinutes DEFAULT (10),   -- patch 008: 120 -> 10 phút
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
    -- patch 012: PendingVerification = Owner đã nộp lệ phí, chờ Admin đối chiếu.
    CONSTRAINT CHK_Pairings_Status CHECK ([Status] IN ('Pending','Accepted','PendingVerification','Confirmed','Declined','Cancelled'))
);
GO

-- Danh sách chờ theo vòng (patch 013). Lưu phần dư khi pool đủ điều kiện vượt
-- tổng sức chứa của vòng = min(MaxHorses, Venue.LaneCount) * số race.
-- KHÁC AlsoEligible: AlsoEligible là entry ĐÃ đua vòng trước; RoundWaitlist là
-- pairing chưa được phân vào race nào (cần thiết cho vòng 1, nơi chưa có entry).
CREATE TABLE RoundWaitlist (
    WaitlistId  INT         IDENTITY(1,1) NOT NULL,
    RoundId     INT         NOT NULL,
    PairingId   INT         NOT NULL,
    [Position]  INT         NOT NULL,
    CreatedAt   DATETIME2   NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RoundWaitlist PRIMARY KEY (WaitlistId),
    CONSTRAINT FK_RoundWaitlist_Round FOREIGN KEY (RoundId) REFERENCES Rounds(RoundId),
    CONSTRAINT FK_RoundWaitlist_Pairing FOREIGN KEY (PairingId) REFERENCES Pairings(PairingId),
    CONSTRAINT CHK_RoundWaitlist_Position CHECK ([Position] > 0)
);
GO

CREATE UNIQUE INDEX UQ_RoundWaitlist_RoundPairing ON RoundWaitlist (RoundId, PairingId);
GO

CREATE UNIQUE INDEX UQ_RoundWaitlist_RoundPosition ON RoundWaitlist (RoundId, [Position]);
GO

-- Nộp & đối chiếu lệ phí (patch 012). Pairing chỉ Confirmed khi payment Verified.
CREATE TABLE EntryFeePayments (
    PaymentId       INT             IDENTITY(1,1) NOT NULL,
    PairingId       INT             NOT NULL,
    Amount          DECIMAL(12,2)   NOT NULL,
    Method          VARCHAR(10)     NOT NULL,
    ReceiptNo       NVARCHAR(50)    NULL,
    TransferRef     NVARCHAR(100)   NULL,
    ProofFileName   NVARCHAR(255)   NULL,
    ProofFilePath   VARCHAR(500)    NULL,
    [Status]        VARCHAR(20)     NOT NULL DEFAULT 'PendingVerification',
    SubmittedAt     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    VerifiedBy      INT             NULL,
    VerifiedAt      DATETIME2       NULL,
    RejectReason    NVARCHAR(500)   NULL,

    CONSTRAINT PK_EntryFeePayments PRIMARY KEY (PaymentId),
    CONSTRAINT FK_EFP_Pairing FOREIGN KEY (PairingId) REFERENCES Pairings(PairingId),
    CONSTRAINT FK_EFP_VerifiedBy FOREIGN KEY (VerifiedBy) REFERENCES Users(UserId),
    CONSTRAINT CHK_EFP_Amount CHECK (Amount >= 0),
    CONSTRAINT CHK_EFP_Method CHECK (Method IN ('Cash','Transfer')),
    CONSTRAINT CHK_EFP_Status CHECK ([Status] IN
        ('PendingVerification','Verified','Rejected','RefundPending','Refunded'))
);
GO

-- Một payment đang hiệu lực cho mỗi Pairing; Rejected/Refunded không tính nên
-- Owner nộp lại được sau khi bị từ chối.
CREATE UNIQUE INDEX UQ_EFP_ActivePerPairing
    ON EntryFeePayments (PairingId)
    WHERE [Status] IN ('PendingVerification','Verified');
GO

CREATE INDEX IX_EFP_Status ON EntryFeePayments ([Status], SubmittedAt);
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
    CONSTRAINT FK_RaceEntries_PostDoctor FOREIGN KEY (PostRaceWeightByDoctorId) REFERENCES DoctorProfiles(DoctorId),
    CONSTRAINT FK_RaceEntries_FeeConfirmedBy FOREIGN KEY (EntryFeeConfirmedBy) REFERENCES Users(UserId),
    CONSTRAINT UQ_RaceEntries_RacePairing UNIQUE (RaceId, PairingId),
    CONSTRAINT CHK_RaceEntries_PostPos CHECK (PostPosition IS NULL OR PostPosition > 0),
    -- patch 012: Scratched = rút SAU bốc thăm (giữ cổng trống, không bốc lại);
    -- Cancelled = rút TRƯỚC bốc thăm (giải phóng cổng).
    CONSTRAINT CHK_RaceEntries_Status CHECK ([Status] IN ('Pending','Confirmed','Cancelled','Scratched','Disqualified')),
    CONSTRAINT CHK_RaceEntries_HorseIdentity CHECK (HorseIdentityCheckStatus IS NULL OR HorseIdentityCheckStatus IN ('Matched','Mismatch')),
    CONSTRAINT CHK_RaceEntries_Clinical CHECK (ClinicalStatus IS NULL OR ClinicalStatus IN ('Fit','Unfit')),
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
    AssignedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_RefereeAssignments PRIMARY KEY (RaceId, RefereeId),
    CONSTRAINT FK_RefAssign_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE CASCADE,
    CONSTRAINT FK_RefAssign_Referee FOREIGN KEY (RefereeId) REFERENCES RefereeProfiles(RefereeId),
    CONSTRAINT CHK_RefAssign_Role CHECK ([Role] IN ('Lead Referee','Assistant Referee'))
);
GO

CREATE UNIQUE INDEX UQ_RefereeAssignments_LeadReferee
    ON RefereeAssignments (RaceId)
    WHERE [Role] = 'Lead Referee';
GO

CREATE TABLE DoctorAssignments (
    RaceId              INT             NOT NULL,
    DoctorId            INT             NOT NULL,
    AssignedAt          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    CertifiedAt         DATETIME2       NULL,

    CONSTRAINT PK_DoctorAssignments PRIMARY KEY (RaceId, DoctorId),
    CONSTRAINT FK_DocAssign_Race FOREIGN KEY (RaceId) REFERENCES Races(RaceId) ON DELETE CASCADE,
    CONSTRAINT FK_DocAssign_Doctor FOREIGN KEY (DoctorId) REFERENCES DoctorProfiles(DoctorId)
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
    ProtestWindowClosedAt DATETIME2 NULL,   -- patch 009: Referee đóng sớm cửa sổ khiếu nại

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
    Code                 VARCHAR(20)    NOT NULL,   -- patch 008: plaintext thay CodeHash
    PointAmount          INT            NOT NULL,
    [Status]             VARCHAR(20)    NOT NULL DEFAULT 'Active',
    ExpiresAt            DATETIME2      NOT NULL,
    RedeemedBySpectatorId INT           NULL,
    RedeemedAt           DATETIME2      NULL,
    CreatedAt            DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT PK_TicketRewardCodes PRIMARY KEY (TicketRewardCodeId),
    CONSTRAINT UQ_TicketRewardCodes_Code UNIQUE (Code),
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
    [Action]    NVARCHAR(100)  NOT NULL,   -- patch 010: VARCHAR(50) -> NVARCHAR(100) cho mô tả tiếng Việt
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
            LockedAt      = i.LockedAt,
            ProtestWindowClosedAt = i.ProtestWindowClosedAt   -- patch 009: nếu thiếu, update bị bỏ âm thầm
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
-- 26 base tables - SQL Server 2022 - 3NF
-- Users, JockeyProfiles, OwnerProfiles, RefereeProfiles, DoctorProfiles,
-- SpectatorProfiles,
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


-- #############################################################################
-- ## PATCH 001_horse_stable_decoupling (nguyên văn)
-- #############################################################################
-- Target snapshot: HRTMS (không đổi database context).
GO

/* =============================================================================
   Patch 001 — Module C: Tách "Kho ngựa" (Horse Stable) khỏi Giải đấu
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Horses trở thành hồ sơ vĩnh viễn của Owner (bỏ TournamentId).
     • Thêm bảng HorseTournamentEntries = 1 enrollment / (Horse, Tournament),
       mang screening + AdminApproval THEO TỪNG GIẢI (duyệt lại mỗi giải).
     • Pairings đổi composite-FK (TournamentId, HorseId) → trỏ vào enrollment.

   Ghi chú phạm vi:
     • CHỈ bỏ Horses.TournamentId. GIỮ NGUYÊN 4 cột ScreeningStatus /
       ScreeningReason / AdminApprovalStatus / RejectionReason trên Horses
       (baseline profile-level) để các module khác (Pairing/RaceEntry) vẫn
       biên dịch & chạy mà không phải sửa.

   Idempotent: chạy lại nhiều lần đều an toàn (dùng IF EXISTS / IF NOT EXISTS).
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Gỡ các ràng buộc/khóa neo trên Horses(TournamentId, HorseId)
      (phải gỡ FK của Pairings trước vì nó tham chiếu UQ của Horses)
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Pairings_HorseTournament')
    ALTER TABLE Pairings DROP CONSTRAINT FK_Pairings_HorseTournament;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Horses_OwnerRoster')
    ALTER TABLE Horses DROP CONSTRAINT FK_Horses_OwnerRoster;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Horses_Tournament')
    ALTER TABLE Horses DROP CONSTRAINT FK_Horses_Tournament;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Horses_TournamentHorse')
    ALTER TABLE Horses DROP CONSTRAINT UQ_Horses_TournamentHorse;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Horses_Tournament' AND object_id = OBJECT_ID('Horses'))
    DROP INDEX IX_Horses_Tournament ON Horses;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Horses_TournamentApproval' AND object_id = OBJECT_ID('Horses'))
    DROP INDEX IX_Horses_TournamentApproval ON Horses;
GO

/* ---------------------------------------------------------------------------
   2) Bỏ cột Horses.TournamentId (root cause: ép đăng ký lại mỗi giải)
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'TournamentId' AND Object_ID = OBJECT_ID('Horses'))
    ALTER TABLE Horses DROP COLUMN TournamentId;
GO

/* ---------------------------------------------------------------------------
   3) Bảng enrollment mới: HorseTournamentEntries
      1 dòng / (Horse, Tournament); mang screening + AdminApproval theo giải.
      OwnerId denormalized (= Horse.OwnerId) để neo composite-FK roster-check.
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HorseTournamentEntries')
BEGIN
    CREATE TABLE HorseTournamentEntries (
        EnrollmentId        INT             IDENTITY(1,1) NOT NULL,
        HorseId             INT             NOT NULL,
        TournamentId        INT             NOT NULL,
        OwnerId             INT             NOT NULL,            -- = Horse.OwnerId (neo roster-FK)
        [Status]            VARCHAR(20)     NOT NULL DEFAULT 'Enrolled',
        ScreeningStatus     VARCHAR(20)     NOT NULL DEFAULT 'NotScreened',
        ScreeningReason     NVARCHAR(500)   NULL,
        AdminApprovalStatus VARCHAR(20)     NOT NULL DEFAULT 'Pending',
        RejectionReason     NVARCHAR(500)   NULL,
        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT PK_HTE PRIMARY KEY (EnrollmentId),
        CONSTRAINT FK_HTE_Horse FOREIGN KEY (HorseId) REFERENCES Horses(HorseId),
        CONSTRAINT FK_HTE_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(TournamentId) ON DELETE CASCADE,
        CONSTRAINT FK_HTE_OwnerRoster FOREIGN KEY (TournamentId, OwnerId)
            REFERENCES TournamentParticipants(TournamentId, UserId),
        CONSTRAINT UQ_HTE_HorseTournament UNIQUE (HorseId, TournamentId),   -- 1 enrollment / giải
        CONSTRAINT UQ_HTE_TournamentHorse UNIQUE (TournamentId, HorseId),   -- neo cho Pairings FK
        CONSTRAINT CHK_HTE_Status CHECK ([Status] IN ('Enrolled','Withdrawn')),
        CONSTRAINT CHK_HTE_Screening CHECK (ScreeningStatus IN ('NotScreened','AutoEligible','ManualReview','AutoRejected')),
        CONSTRAINT CHK_HTE_Approval CHECK (AdminApprovalStatus IN ('Pending','Approved','Rejected'))
    );

    CREATE INDEX IX_HTE_Horse ON HorseTournamentEntries (HorseId);
    CREATE INDEX IX_HTE_TournamentApproval ON HorseTournamentEntries (TournamentId, AdminApprovalStatus);
END
GO

/* ---------------------------------------------------------------------------
   3b) Backfill enrollment từ dữ liệu Pairings hiện có
       → mỗi (TournamentId, HorseId) đang được dùng trong Pairings phải có
         enrollment tương ứng, nếu không bước (4) add FK sẽ FAIL (Msg 547).
       Pre-existing pairing = ngựa đã hợp lệ trong giải → set Approved/AutoEligible.
       Idempotent: chỉ chèn dòng còn thiếu (NOT EXISTS).
   --------------------------------------------------------------------------- */
INSERT INTO HorseTournamentEntries
    (HorseId, TournamentId, OwnerId, [Status], ScreeningStatus, AdminApprovalStatus, CreatedAt, UpdatedAt)
SELECT DISTINCT p.HorseId, p.TournamentId, h.OwnerId, 'Enrolled', 'AutoEligible', 'Approved',
       GETUTCDATE(), GETUTCDATE()
FROM Pairings p
JOIN Horses h ON h.HorseId = p.HorseId
WHERE NOT EXISTS (
    SELECT 1 FROM HorseTournamentEntries e
    WHERE e.HorseId = p.HorseId AND e.TournamentId = p.TournamentId
);
GO

/* ---------------------------------------------------------------------------
   4) Pairings: composite-FK (TournamentId, HorseId) trỏ vào enrollment
      → đảm bảo ngựa của pairing đã enroll vào đúng giải (DB-level guarantee).
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Pairings_HorseTournament')
    ALTER TABLE Pairings
        ADD CONSTRAINT FK_Pairings_HorseTournament
        FOREIGN KEY (TournamentId, HorseId)
        REFERENCES HorseTournamentEntries(TournamentId, HorseId);
GO


-- #############################################################################
-- ## PATCH 002_tournament_progression (nguyên văn)
-- #############################################################################
-- Target snapshot: HRTMS (không đổi database context).
GO

/* =============================================================================
   Patch 002 — Module B/E: Tournament/Round/Race Progression
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Tournaments.AdvancementRule  — rule chọn ngựa đi tiếp, cấu hình per giải:
         'TopPerRace'    (MVP/default): mỗi race lấy Top N theo FinishPosition.
         'EarningsBased' : xếp theo EarningsAwarded (purse thực kiếm được) —
                           hệ thống KHÔNG có điểm số, chỉ có tiền thưởng.
         'Hybrid'        : Top N mỗi race trước, slot còn lại theo earnings.
     • Tournaments.AdvancementCount — N của TopPerRace (default 5, khớp cấu trúc
       PrizeDistributions Top1–Top5).
     • RaceEntries.AdvancementStatus — kết quả progression sau khi race Official:
         'Qualified'    : đủ điều kiện allocate vào round kế tiếp.
         'AlsoEligible' : dự bị — dead heat tại ranh qualify hoặc overflow;
                          Admin quyết định khi allocate (draw/manual).
         'Eliminated'   : bị loại, KHÔNG được allocate round sau.
         NULL           : chưa tính (race chưa Official / entry Cancelled /
                          round chung kết không có advancement).
     • RaceEntries.AdvancementRank   — thứ hạng dùng để xét đi tiếp (MVP =
       FinishPosition trong race).
     • RaceEntries.AdvancementReason — lý do/evidence (dead heat, disqualified,
       admin draw...) phục vụ audit.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Tournaments: AdvancementRule + AdvancementCount
   --------------------------------------------------------------------------- */
IF COL_LENGTH('Tournaments', 'AdvancementRule') IS NULL
    ALTER TABLE Tournaments ADD AdvancementRule VARCHAR(20) NOT NULL
        CONSTRAINT DF_Tournaments_AdvRule DEFAULT 'TopPerRace';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Tournaments_AdvRule')
    ALTER TABLE Tournaments ADD CONSTRAINT CHK_Tournaments_AdvRule
        CHECK (AdvancementRule IN ('TopPerRace','EarningsBased','Hybrid'));
GO

IF COL_LENGTH('Tournaments', 'AdvancementCount') IS NULL
    ALTER TABLE Tournaments ADD AdvancementCount INT NOT NULL
        CONSTRAINT DF_Tournaments_AdvCount DEFAULT 5;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Tournaments_AdvCount')
    ALTER TABLE Tournaments ADD CONSTRAINT CHK_Tournaments_AdvCount
        CHECK (AdvancementCount > 0);
GO

/* ---------------------------------------------------------------------------
   2) RaceEntries: AdvancementStatus / AdvancementRank / AdvancementReason
   --------------------------------------------------------------------------- */
IF COL_LENGTH('RaceEntries', 'AdvancementStatus') IS NULL
    ALTER TABLE RaceEntries ADD AdvancementStatus VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_RaceEntries_AdvStatus')
    ALTER TABLE RaceEntries ADD CONSTRAINT CHK_RaceEntries_AdvStatus
        CHECK (AdvancementStatus IS NULL OR AdvancementStatus IN ('Qualified','AlsoEligible','Eliminated'));
GO

IF COL_LENGTH('RaceEntries', 'AdvancementRank') IS NULL
    ALTER TABLE RaceEntries ADD AdvancementRank INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_RaceEntries_AdvRank')
    ALTER TABLE RaceEntries ADD CONSTRAINT CHK_RaceEntries_AdvRank
        CHECK (AdvancementRank IS NULL OR AdvancementRank > 0);
GO

IF COL_LENGTH('RaceEntries', 'AdvancementReason') IS NULL
    ALTER TABLE RaceEntries ADD AdvancementReason NVARCHAR(255) NULL;
GO

/* ---------------------------------------------------------------------------
   3) Index phục vụ picker/guard: lọc entry theo AdvancementStatus
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RaceEntries_AdvStatus')
    CREATE INDEX IX_RaceEntries_AdvStatus ON RaceEntries (AdvancementStatus)
        WHERE AdvancementStatus IS NOT NULL;
GO


-- #############################################################################
-- ## PATCH 003_upload_file_table (nguyên văn)
-- #############################################################################
-- Target snapshot: HRTMS (không đổi database context).
GO

/* =============================================================================
   Patch 003 — Module ACC: Upload file chứng chỉ thay cho nhập tên chứng chỉ
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Thêm bảng Certificates để lưu file chứng chỉ/bằng cấp do người dùng
       upload khi đăng ký các role cần thẩm định chuyên môn:
         - Jockey  : thay cho việc chỉ gõ tên "LicenseCertificate"
         - Referee : minh chứng cho "CertificationLevel"
         - Doctor  : minh chứng cho "MedicalLicenseNumber"
     • Mỗi User giữ đúng 1 bản ghi Certificate hiện hành (UNIQUE UserId).
       Nếu user bị Admin reject và upload lại, file cũ sẽ được ghi đè
       (xử lý ở tầng ứng dụng — service kiểm tra tồn tại rồi Update thay vì Insert).
     • Admin xem chứng chỉ qua endpoint GET /api/certificates/{id}/download
       (yêu cầu Authorize, không public trực tiếp file trên static hosting).
     • Cột LicenseCertificate/CertificationLevel/MedicalLicenseNumber trong
       các bảng *Profiles VẪN GIỮ NGUYÊN (lưu tên file gốc do người dùng upload,
       để tương thích ngược với các API/report hiện có) — chứng chỉ file thật
       sự nằm ở bảng Certificates.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Certificates')
BEGIN
    CREATE TABLE Certificates (
        CertificateId   INT IDENTITY(1,1) NOT NULL,
        UserId          INT NOT NULL,
        CertificateType VARCHAR(20) NOT NULL,
        FileName        NVARCHAR(255) NOT NULL,
        FilePath        VARCHAR(500) NOT NULL,
        ContentType     VARCHAR(100) NOT NULL,
        FileSizeBytes   BIGINT NOT NULL,
        UploadedAt      DATETIME2 NOT NULL CONSTRAINT DF_Certificates_UploadedAt DEFAULT (getutcdate()),

        CONSTRAINT PK_Certificates PRIMARY KEY (CertificateId),
        CONSTRAINT FK_Certificates_Users FOREIGN KEY (UserId)
            REFERENCES Users (UserId) ON DELETE CASCADE,
        CONSTRAINT CHK_Certificates_Type
            CHECK (CertificateType IN ('Jockey','Referee','Doctor'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Certificates_UserId')
    CREATE UNIQUE INDEX UQ_Certificates_UserId ON Certificates (UserId);
GO

/* ---------------------------------------------------------------------------
   Gỡ unique constraint cũ trên cột text chứng chỉ (LicenseCertificate /
   MedicalLicenseNumber): giờ các cột này chỉ lưu TÊN FILE GỐC do người dùng
   upload (không còn là số/tên chứng chỉ duy nhất do người dùng tự gõ),
   nên không còn ý nghĩa để ràng buộc UNIQUE. Định danh chứng chỉ thật sự
   nằm ở bảng Certificates (UNIQUE theo UserId).

   Lưu ý: 2 index này thực chất được sinh ra bởi UNIQUE CONSTRAINT (không phải
   CREATE UNIQUE INDEX thường), nên phải DROP CONSTRAINT chứ không DROP INDEX
   trực tiếp (SQL Server báo lỗi Msg 3723 nếu cố DROP INDEX).
   --------------------------------------------------------------------------- */
IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'UQ_JockeyProfiles_License' AND parent_object_id = OBJECT_ID('JockeyProfiles')
)
    ALTER TABLE JockeyProfiles DROP CONSTRAINT UQ_JockeyProfiles_License;
GO

IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'UQ_DoctorProfiles_License' AND parent_object_id = OBJECT_ID('DoctorProfiles')
)
    ALTER TABLE DoctorProfiles DROP CONSTRAINT UQ_DoctorProfiles_License;
GO

/* Fallback: nếu ở môi trường nào đó 2 index này lại được tạo dưới dạng index
   thường (không phải constraint), DROP INDEX vẫn chạy được ở đây vì điều kiện
   IF EXISTS ở trên sẽ false và không đụng tới; xử lý case còn lại bằng cách
   kiểm tra tồn tại độc lập trong sys.indexes rồi drop qua index, bọc trong
   TRY/CATCH để không chặn cả patch nếu gặp lại lỗi 3723 ở môi trường khác. */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_JockeyProfiles_License')
BEGIN
    BEGIN TRY
        DROP INDEX UQ_JockeyProfiles_License ON JockeyProfiles;
    END TRY
    BEGIN CATCH
        PRINT 'Bỏ qua: UQ_JockeyProfiles_License đã được xử lý ở bước DROP CONSTRAINT phía trên hoặc không thể drop trực tiếp.';
    END CATCH
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DoctorProfiles_License')
BEGIN
    BEGIN TRY
        DROP INDEX UQ_DoctorProfiles_License ON DoctorProfiles;
    END TRY
    BEGIN CATCH
        PRINT 'Bỏ qua: UQ_DoctorProfiles_License đã được xử lý ở bước DROP CONSTRAINT phía trên hoặc không thể drop trực tiếp.';
    END CATCH
END
GO

-- #############################################################################
-- ## PATCH 004_live_race_simulation (nguyên văn)
-- #############################################################################
-- Target snapshot: HRTMS (không đổi database context).
GO

/* =============================================================================
   Patch 004 — Module H mở rộng: Live Race Simulation (UI-S07)
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Thêm cột Races.ActualStartTime — thời điểm Referee thực sự bấm "Start Race"
       (khác ScheduledTime là giờ dự kiến). FE dùng cột này để biết khi nào bắt
       đầu chạy animation random-walk (client-side, 100ms/tick).
     • Không thêm bảng mới: Violation trong lúc Live vẫn dùng lại bảng
       RaceReports/Violations sẵn có — Referee ghi nhận vi phạm trong lúc Live sẽ
       tạo (hoặc tái sử dụng) 1 RaceReport chưa khóa (IsLocked = 0) cho race đó.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Races') AND name = 'ActualStartTime'
)
    ALTER TABLE Races ADD ActualStartTime DATETIME2 NULL;
GO


-- #############################################################################
-- ## PATCH 005_row_version_concurrency (nguyên văn)
-- #############################################################################
-- Target snapshot: HRTMS (không đổi database context).
GO

/* =============================================================================
   Patch 005 — Module E: Optimistic concurrency cho Races / RaceEntries
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Races.RowVersion       — ROWVERSION, concurrency token do SQL Server sinh.
     • RaceEntries.RowVersion — ROWVERSION, concurrency token do SQL Server sinh.

   Lý do:
     Nhiều actor ghi đồng thời cùng 1 row (Doctor sửa weight trong lúc Referee
     confirm starting list; 2 Admin cùng thao tác 1 entry) hiện là last-write-wins
     âm thầm. EF Core map cột này bằng IsRowVersion() (HRTMSDbContext) — request
     ghi đè dữ liệu đã đổi sẽ nhận DbUpdateConcurrencyException → API trả
     409 CONCURRENCY_CONFLICT (ExceptionMiddleware).

   Ghi chú:
     • Các path dùng ExecuteUpdateAsync (withdraw, trừ ví...) bypass change
       tracker — không đi qua RowVersion, đã tự bảo vệ bằng UPDATE có điều kiện.
     • ROWVERSION do DB quản lý hoàn toàn: không cần backfill, không cần default.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Races.RowVersion
   --------------------------------------------------------------------------- */
IF COL_LENGTH('Races', 'RowVersion') IS NULL
    ALTER TABLE Races ADD RowVersion ROWVERSION NOT NULL;
GO

/* ---------------------------------------------------------------------------
   2) RaceEntries.RowVersion
   --------------------------------------------------------------------------- */
IF COL_LENGTH('RaceEntries', 'RowVersion') IS NULL
    ALTER TABLE RaceEntries ADD RowVersion ROWVERSION NOT NULL;
GO

PRINT 'Patch 005 applied: Races.RowVersion + RaceEntries.RowVersion (optimistic concurrency).';
GO


-- #############################################################################
-- ## PATCH 006_system_user_seed (nguyên văn)
-- #############################################################################
-- Target snapshot: HRTMS (không đổi database context).
GO

/* =============================================================================
   Patch 006 — Module E/Q: System user chuẩn cho job tự động
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Mở rộng CHK_Users_Role: thêm role 'System'.
     • Mở rộng CHK_Users_ProfessionalIdentity: miễn trừ 'System' (như Admin/
       Spectator — không yêu cầu Phone/DOB/Identity).
     • Seed 1 user hệ thống cố định (Username = 'system') làm actor cho các job
       tự động (AutoCancelOverdueAsync) — AuditLog.ActorId là FK NOT NULL tới
       Users nên job cần user thật, không được "mượn" tài khoản Admin.

   Bảo mật:
     • PasswordHash = 'LOGIN_DISABLED' — KHÔNG phải BCrypt hash hợp lệ, không thể
       verify thành công. AuthService còn chặn cứng Role = 'System' trước bước
       verify mật khẩu (defense in depth).

   Idempotent: chạy lại nhiều lần đều an toàn (check tồn tại trước khi đổi/insert).
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) CHK_Users_Role: thêm 'System' vào danh sách role hợp lệ
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CHK_Users_Role'
             AND definition NOT LIKE '%System%')
BEGIN
    ALTER TABLE Users DROP CONSTRAINT CHK_Users_Role;
    ALTER TABLE Users ADD CONSTRAINT CHK_Users_Role
        CHECK ([Role] IN ('Admin','Owner','Jockey','Referee','Doctor','Spectator','System'));
END
GO

/* ---------------------------------------------------------------------------
   2) CHK_Users_ProfessionalIdentity: miễn trừ 'System' khỏi yêu cầu định danh
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CHK_Users_ProfessionalIdentity'
             AND definition NOT LIKE '%System%')
BEGIN
    ALTER TABLE Users DROP CONSTRAINT CHK_Users_ProfessionalIdentity;
    ALTER TABLE Users ADD CONSTRAINT CHK_Users_ProfessionalIdentity CHECK (
        [Role] IN ('Admin','Spectator','System')
        OR (PhoneNumber IS NOT NULL AND DateOfBirth IS NOT NULL AND IdentityNumberEncrypted IS NOT NULL AND IdentityHash IS NOT NULL)
    );
END
GO

/* ---------------------------------------------------------------------------
   3) Seed system user (idempotent theo Username UNIQUE)
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'system')
BEGIN
    INSERT INTO Users (Username, FullName, Email, NormalizedEmail, PasswordHash, [Role], [Status])
    VALUES (
        'system',
        N'HRTMS System',
        'system@hrtms.local',
        'SYSTEM@HRTMS.LOCAL',
        'LOGIN_DISABLED',          -- không phải BCrypt hash — không thể đăng nhập
        'System',
        'Active'
    );
END
GO

PRINT 'Patch 006 applied: role System + seed system user (actor cho job tự động).';
GO

/* =============================================================================
   Patch 011 — Module B/E: Venues (sân đua)
   -----------------------------------------------------------------------------
   DDL (bảng Venues, Tournaments.VenueId + FK + index) đã FOLD vào phần CREATE
   TABLE phía trên. Phần còn lại dưới đây là SEED — theo đúng convention của
   patch 001/006: seed nằm trong patch nên phải có mặt trong snapshot.

   Backfill "giải cũ -> sân Phú Thọ" của patch gốc là NO-OP trên DB mới rỗng
   (chưa có Tournaments) nên không lặp lại ở đây.
   ============================================================================= */

MERGE Venues AS target
USING (VALUES
    (N'Trường đua Phú Thọ',          N'Số 2 Lê Đại Hành, Phường 15, Quận 11', N'TP. Hồ Chí Minh', 'Dirt', 1800, 12, 1),
    (N'Trường đua Đại Nam',          N'Khu du lịch Đại Nam, Hiệp An',         N'Bình Dương',      'Dirt', 1500, 10, 1),
    (N'Trường đua Thiên Mã Madagui', N'Khu du lịch Madagui, Đạ Huoai',        N'Lâm Đồng',        'Turf', 1200,  6, 1),
    (N'Trường đua Sóc Sơn',          N'Xã Tân Minh, Huyện Sóc Sơn',           N'Hà Nội',          'Turf', 2000, 14, 0)
) AS source ([Name],[Address],City,TrackType,TrackLengthMeters,LaneCount,IsActive)
    ON target.[Name] = source.[Name]
WHEN NOT MATCHED BY TARGET THEN
    INSERT ([Name],[Address],City,TrackType,TrackLengthMeters,LaneCount,IsActive)
    VALUES (source.[Name],source.[Address],source.City,source.TrackType,
            source.TrackLengthMeters,source.LaneCount,source.IsActive);
GO

PRINT 'Patch 011 applied: bảng Venues + Tournaments.VenueId + seed 4 sân đua VN.';
GO

/* =============================================================================
   Patch 012 — Module E/N: Entry Fee Payment
   -----------------------------------------------------------------------------
   DDL đã FOLD vào phần CREATE TABLE phía trên:
     • bảng EntryFeePayments + UQ_EFP_ActivePerPairing + IX_EFP_Status
     • Tournaments.PaymentDeadline / RefundDeadline
     • CHK_Pairings_Status   += 'PendingVerification'
     • CHK_RaceEntries_Status += 'Scratched'

   Backfill "payment Verified cho pairing đã Confirmed" của patch gốc là NO-OP
   trên DB mới rỗng (chưa có Pairings) nên không lặp lại ở đây — seed thật nằm
   trong database/seed.sql.
   ============================================================================= */

PRINT 'Patch 012 applied: bảng EntryFeePayments + deadline lệ phí + status PendingVerification/Scratched.';
GO

/* =============================================================================
   Patch 013 — Module E: RoundWaitlist (danh sách chờ theo vòng)
   -----------------------------------------------------------------------------
   DDL đã FOLD vào phần CREATE TABLE phía trên (bảng RoundWaitlist +
   UQ_RoundWaitlist_RoundPairing + UQ_RoundWaitlist_RoundPosition).
   Patch không chứa seed.
   ============================================================================= */

PRINT 'Patch 013 applied: bảng RoundWaitlist (danh sách chờ vòng đấu).';
GO

PRINT N'HOÀN TẤT: schema HRTMS được tạo mới (schema gốc + patch 001-013).';
GO

SET NOEXEC OFF;
GO
