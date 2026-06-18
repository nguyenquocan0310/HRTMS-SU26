-- =============================================================================
-- HRTMS — hrtms_seed.sql
-- Dữ liệu mẫu (Demo Seed) — SQL Server 2022
-- Version  : 1.0 | Ngày: 2026-06-16
-- Dự án    : SU26SWP03
-- =============================================================================
--
-- HƯỚNG DẪN SỬ DỤNG:
--   Bước 1: Chạy hrtms_schema.sql trước để tạo database và toàn bộ tables.
--   Bước 2: Chạy file này để nạp dữ liệu demo.
--   Bước 3: File này IDEMPOTENT — có thể chạy lại nhiều lần mà
--           KHÔNG tạo bản ghi trùng lặp (dùng IF NOT EXISTS / COUNT).
--
-- GIẢI QUYẾT XUNG ĐỘT NHIỀU MÁY:
--   • Mỗi dev cài SQL Server riêng trên máy local → không xung đột.
--   • File dùng Username / Email duy nhất nên chạy lại hoàn toàn an toàn.
--   • Nếu dùng shared dev-DB: chỉ để 1 người (DB admin) chạy file này.
--
-- MẬT KHẨU DEMO:
--   Tất cả tài khoản: Admin@123
--   Hash BCrypt cost=12: $2b$12$oFG8MH2PjVbGqYRdpmVcjexJMBSRqKXcmyswa1qMJ8sfpouC1e6OK
--   ⚠️  CHỈ DÙNG CHO LOCAL/DEV — đổi hash trước khi lên staging/prod.
--
-- DỮ LIỆU DEMO BAO GỒM:
--   Người dùng    : 13 (1 Admin, 2 Owner, 4 Jockey, 2 Referee, 1 Doctor, 3 Spectator)
--   Profile ext.  : 13 tương ứng
--   Ngựa          : 5  (4 Approved + 1 Pending — demo luồng phê duyệt)
--   Ghép cặp      : 5  (4 Accepted + 1 Pending)
--   Giải đấu      : 1  (Completed, 3 Round → 3 Race → kết quả → payout)
--   Điểm ảo       : 3 Wallet, 8 giao dịch, 3 Prediction
-- =============================================================================

USE HRTMS;
GO

-- =============================================================================
-- ⚠️  TOÀN BỘ SEED NẰM TRONG 1 BATCH (không dùng GO giữa các INSERT)
--      để các biến DECLARE hoạt động xuyên suốt.
-- =============================================================================

DECLARE @Pw VARCHAR(255) = '$2b$12$oFG8MH2PjVbGqYRdpmVcjexJMBSRqKXcmyswa1qMJ8sfpouC1e6OK';
-- BCrypt(cost=12) của 'Admin@123' — dùng chung cho mọi tài khoản demo

-- =============================================================================
-- BLOCK 1: USERS — 13 tài khoản đại diện đủ 6 vai trò
-- =============================================================================

-- ── 1.1  Admin ───────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'admin')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('admin', N'Quản Trị Viên', 'admin@hrtms.com', @Pw, 'Admin', 'Active', 0, GETUTCDATE(), GETUTCDATE());

-- ── 1.2  Owner ───────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'owner_nguyen')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('owner_nguyen', N'Nguyễn Văn Phú', 'nguyen.phu@hrtms.com', @Pw, 'Owner', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'owner_tran')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('owner_tran', N'Trần Thị Mai', 'tran.mai@hrtms.com', @Pw, 'Owner', 'Active', 0, GETUTCDATE(), GETUTCDATE());

-- ── 1.3  Jockey (ExperienceYears ≥ 2 để đủ điều kiện Tournament) ─────────────
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'jockey_minh')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('jockey_minh', N'Lê Văn Minh', 'le.minh@hrtms.com', @Pw, 'Jockey', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'jockey_duc')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('jockey_duc', N'Phạm Đức Huy', 'pham.huy@hrtms.com', @Pw, 'Jockey', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'jockey_son')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('jockey_son', N'Hoàng Văn Sơn', 'hoang.son@hrtms.com', @Pw, 'Jockey', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'jockey_linh')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('jockey_linh', N'Vũ Thị Linh', 'vu.linh@hrtms.com', @Pw, 'Jockey', 'Active', 0, GETUTCDATE(), GETUTCDATE());

-- ── 1.4  Referee ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'referee_long')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('referee_long', N'Trần Quốc Long', 'tran.long@hrtms.com', @Pw, 'Referee', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'referee_hai')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('referee_hai', N'Nguyễn Thị Hải', 'nguyen.hai@hrtms.com', @Pw, 'Referee', 'Active', 0, GETUTCDATE(), GETUTCDATE());

-- ── 1.5  Doctor ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'doctor_thanh')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('doctor_thanh', N'Lê Thanh Tùng', 'le.tung@hrtms.com', @Pw, 'Doctor', 'Active', 0, GETUTCDATE(), GETUTCDATE());

-- ── 1.6  Spectator ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'spectator_an')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('spectator_an', N'Nguyễn Thị An', 'nguyen.an@gmail.com', @Pw, 'Spectator', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'spectator_binh')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('spectator_binh', N'Trần Văn Bình', 'tran.binh@gmail.com', @Pw, 'Spectator', 'Active', 0, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'spectator_chi')
    INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, [Status], FailedLoginAttempts, CreatedAt, UpdatedAt)
    VALUES ('spectator_chi', N'Lê Thị Chi', 'le.chi@gmail.com', @Pw, 'Spectator', 'Active', 0, GETUTCDATE(), GETUTCDATE());

-- Lấy UserId của tất cả tài khoản vừa tạo để dùng làm FK ở các block sau
DECLARE @AdminId       INT = (SELECT UserId FROM Users WHERE Username = 'admin');
DECLARE @OwnerNguyenId INT = (SELECT UserId FROM Users WHERE Username = 'owner_nguyen');
DECLARE @OwnerTranId   INT = (SELECT UserId FROM Users WHERE Username = 'owner_tran');
DECLARE @JockeyMinhId  INT = (SELECT UserId FROM Users WHERE Username = 'jockey_minh');
DECLARE @JockeyDucId   INT = (SELECT UserId FROM Users WHERE Username = 'jockey_duc');
DECLARE @JockeySonId   INT = (SELECT UserId FROM Users WHERE Username = 'jockey_son');
DECLARE @JockeyLinhId  INT = (SELECT UserId FROM Users WHERE Username = 'jockey_linh');
DECLARE @RefLongId     INT = (SELECT UserId FROM Users WHERE Username = 'referee_long');
DECLARE @RefHaiId      INT = (SELECT UserId FROM Users WHERE Username = 'referee_hai');
DECLARE @DoctorThanhId INT = (SELECT UserId FROM Users WHERE Username = 'doctor_thanh');
DECLARE @SpectAnId     INT = (SELECT UserId FROM Users WHERE Username = 'spectator_an');
DECLARE @SpectBinhId   INT = (SELECT UserId FROM Users WHERE Username = 'spectator_binh');
DECLARE @SpectChiId    INT = (SELECT UserId FROM Users WHERE Username = 'spectator_chi');

-- =============================================================================
-- BLOCK 2: PROFILE EXTENSIONS
-- Mỗi User chỉ có đúng 1 profile tương ứng với Role của họ.
-- =============================================================================

-- ── 2.1  OwnerProfiles ───────────────────────────────────────────────────────
-- IdentityNumber lưu dưới dạng placeholder — app layer sẽ mã hóa theo NĐ 13/2023
IF NOT EXISTS (SELECT 1 FROM OwnerProfiles WHERE OwnerId = @OwnerNguyenId)
    INSERT INTO OwnerProfiles (OwnerId, PhoneNumber, IdentityNumber, CreatedAt, UpdatedAt)
    VALUES (@OwnerNguyenId, '0901234567', 'ENC_NVP_079201012345', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM OwnerProfiles WHERE OwnerId = @OwnerTranId)
    INSERT INTO OwnerProfiles (OwnerId, PhoneNumber, IdentityNumber, CreatedAt, UpdatedAt)
    VALUES (@OwnerTranId, '0912345678', 'ENC_TTM_079201098765', GETUTCDATE(), GETUTCDATE());

-- ── 2.2  JockeyProfiles ──────────────────────────────────────────────────────
-- SelfDeclaredWeight: cân nặng (kg) jockey tự khai — Doctor xác nhận trước đua [EC-39]
IF NOT EXISTS (SELECT 1 FROM JockeyProfiles WHERE JockeyId = @JockeyMinhId)
    INSERT INTO JockeyProfiles (JockeyId, LicenseCertificate, ExperienceYears, SelfDeclaredWeight, BloodType, HealthStatus, [Status], CreatedAt, UpdatedAt)
    VALUES (@JockeyMinhId, 'JKY-2021-0001', 5, 54.50, 'O+',  'Good', 'Active', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM JockeyProfiles WHERE JockeyId = @JockeyDucId)
    INSERT INTO JockeyProfiles (JockeyId, LicenseCertificate, ExperienceYears, SelfDeclaredWeight, BloodType, HealthStatus, [Status], CreatedAt, UpdatedAt)
    VALUES (@JockeyDucId,  'JKY-2023-0002', 3, 56.00, 'A+',  'Good', 'Active', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM JockeyProfiles WHERE JockeyId = @JockeySonId)
    INSERT INTO JockeyProfiles (JockeyId, LicenseCertificate, ExperienceYears, SelfDeclaredWeight, BloodType, HealthStatus, [Status], CreatedAt, UpdatedAt)
    VALUES (@JockeySonId,  'JKY-2019-0003', 7, 55.20, 'B+',  'Good', 'Active', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM JockeyProfiles WHERE JockeyId = @JockeyLinhId)
    INSERT INTO JockeyProfiles (JockeyId, LicenseCertificate, ExperienceYears, SelfDeclaredWeight, BloodType, HealthStatus, [Status], CreatedAt, UpdatedAt)
    VALUES (@JockeyLinhId, 'JKY-2022-0004', 4, 52.80, 'AB+', 'Good', 'Active', GETUTCDATE(), GETUTCDATE());

-- ── 2.3  RefereeProfiles ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM RefereeProfiles WHERE RefereeId = @RefLongId)
    INSERT INTO RefereeProfiles (RefereeId, CertificationLevel, [Status], CreatedAt, UpdatedAt)
    VALUES (@RefLongId, 'National Level A', 'Active', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM RefereeProfiles WHERE RefereeId = @RefHaiId)
    INSERT INTO RefereeProfiles (RefereeId, CertificationLevel, [Status], CreatedAt, UpdatedAt)
    VALUES (@RefHaiId,  'Regional Level B', 'Active', GETUTCDATE(), GETUTCDATE());

-- ── 2.4  DoctorProfiles ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM DoctorProfiles WHERE DoctorId = @DoctorThanhId)
    INSERT INTO DoctorProfiles (DoctorId, MedicalLicenseNumber, [Status], CreatedAt, UpdatedAt)
    VALUES (@DoctorThanhId, 'MED-2020-BCA-007', 'Active', GETUTCDATE(), GETUTCDATE());

-- ── 2.5  SpectatorProfiles ───────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM SpectatorProfiles WHERE SpectatorId = @SpectAnId)
    INSERT INTO SpectatorProfiles (SpectatorId, CreatedAt) VALUES (@SpectAnId,   GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM SpectatorProfiles WHERE SpectatorId = @SpectBinhId)
    INSERT INTO SpectatorProfiles (SpectatorId, CreatedAt) VALUES (@SpectBinhId, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM SpectatorProfiles WHERE SpectatorId = @SpectChiId)
    INSERT INTO SpectatorProfiles (SpectatorId, CreatedAt) VALUES (@SpectChiId,  GETUTCDATE());

-- =============================================================================
-- BLOCK 3: TOURNAMENT & PRIZE DISTRIBUTIONS
-- 1 giải đấu hoàn chỉnh để demo toàn bộ luồng hệ thống từ đầu đến cuối.
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM Tournaments WHERE [Name] = N'Giải Đua Ngựa Mùa Hè SU26')
    INSERT INTO Tournaments (
        [Name], [Description],
        StartDate, EndDate,
        MaxHorses, AllowedBreed, TrackType, RaceDistance, RaceCategory,
        MinJockeyExperienceYears,
        PurseAmount, EntryFeeAmount,
        PreRaceWeightThresholdKg, PostRaceWeightDiffThresholdKg,
        [Status], CreatedAt, UpdatedAt, CreatedBy
    )
    VALUES (
        N'Giải Đua Ngựa Mùa Hè SU26',
        N'Giải demo đầy đủ luồng: đăng ký → ghép cặp → thi đấu → kết quả → trao thưởng.',
        '2026-06-01 07:00:00', '2026-06-30 18:00:00',
        8,                  -- tối đa 8 ngựa / race
        'Thoroughbred',     -- chỉ ngựa Thoroughbred
        'Turf',             -- đường đua cỏ
        1600,               -- cự ly 1600m
        'Open',
        2,                  -- jockey cần ≥ 2 năm kinh nghiệm [EC-46]
        50000000.00,        -- tổng giải thưởng: 50 triệu VND
        500000.00,          -- phí đăng ký mỗi cặp: 500k [EC-32]
        2.00,               -- ngưỡng cân trước đua [EC-39]
        1.00,               -- ngưỡng chênh lệch cân sau đua [EC-39]
        'Completed', GETUTCDATE(), GETUTCDATE(), @AdminId
    );

DECLARE @TourId INT = (SELECT TournamentId FROM Tournaments WHERE [Name] = N'Giải Đua Ngựa Mùa Hè SU26');

-- Tỷ lệ chia giải thưởng theo vị trí (tổng = 100%)
-- Chỉ insert nếu chưa có để tránh vi phạm UQ_PrizeDist_TourPos
IF NOT EXISTS (SELECT 1 FROM PrizeDistributions WHERE TournamentId = @TourId AND [Position] = 1)
BEGIN
    INSERT INTO PrizeDistributions (TournamentId, [Position], Percentage)
    VALUES
        (@TourId, 1, 50.00),  -- Hạng 1: 25,000,000 VND
        (@TourId, 2, 25.00),  -- Hạng 2: 12,500,000 VND
        (@TourId, 3, 15.00),  -- Hạng 3:  7,500,000 VND
        (@TourId, 4,  7.00),  -- Hạng 4:  3,500,000 VND
        (@TourId, 5,  3.00);  -- Hạng 5:  1,500,000 VND
END;

-- =============================================================================
-- BLOCK 4: ROUNDS — 3 vòng đấu tuần tự (SequenceOrder không trùng nhau)
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM Rounds WHERE TournamentId = @TourId AND SequenceOrder = 1)
    INSERT INTO Rounds (TournamentId, [Name], SequenceOrder, ScheduledDate, [Status], UpdatedAt)
    VALUES (@TourId, N'Vòng Loại', 1, '2026-06-10 08:00:00', 'Completed', GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Rounds WHERE TournamentId = @TourId AND SequenceOrder = 2)
    INSERT INTO Rounds (TournamentId, [Name], SequenceOrder, ScheduledDate, [Status], UpdatedAt)
    VALUES (@TourId, N'Bán Kết',   2, '2026-06-15 08:00:00', 'Completed', GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Rounds WHERE TournamentId = @TourId AND SequenceOrder = 3)
    INSERT INTO Rounds (TournamentId, [Name], SequenceOrder, ScheduledDate, [Status], UpdatedAt)
    VALUES (@TourId, N'Chung Kết', 3, '2026-06-20 08:00:00', 'Completed', GETUTCDATE());

DECLARE @Round1Id INT = (SELECT RoundId FROM Rounds WHERE TournamentId = @TourId AND SequenceOrder = 1);
DECLARE @Round2Id INT = (SELECT RoundId FROM Rounds WHERE TournamentId = @TourId AND SequenceOrder = 2);
DECLARE @Round3Id INT = (SELECT RoundId FROM Rounds WHERE TournamentId = @TourId AND SequenceOrder = 3);

-- =============================================================================
-- BLOCK 5: RACES — 1 cuộc đua mỗi vòng, giải thưởng tăng dần
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM Races WHERE RoundId = @Round1Id AND RaceNumber = 1)
    INSERT INTO Races (
        RoundId, RaceNumber, ScheduledTime, PurseAmount,
        [Status], IsPostPositionDrawn, IsPredictionGateClosed,
        ConfirmationCutoffHours, ProtestDeadlineMinutes, CreatedAt, UpdatedAt
    )
    VALUES (@Round1Id, 1, '2026-06-10 09:00:00', 10000000.00,
            'Official', 1, 1, 24, 120, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Races WHERE RoundId = @Round2Id AND RaceNumber = 1)
    INSERT INTO Races (
        RoundId, RaceNumber, ScheduledTime, PurseAmount,
        [Status], IsPostPositionDrawn, IsPredictionGateClosed,
        ConfirmationCutoffHours, ProtestDeadlineMinutes, CreatedAt, UpdatedAt
    )
    VALUES (@Round2Id, 1, '2026-06-15 09:00:00', 15000000.00,
            'Official', 1, 1, 24, 120, GETUTCDATE(), GETUTCDATE());

-- Chung Kết: IsPredictionGateClosed=1 (đã đóng cổng dự đoán trước giờ đua)
IF NOT EXISTS (SELECT 1 FROM Races WHERE RoundId = @Round3Id AND RaceNumber = 1)
    INSERT INTO Races (
        RoundId, RaceNumber, ScheduledTime, PurseAmount,
        [Status], IsPostPositionDrawn, IsPredictionGateClosed,
        ConfirmationCutoffHours, ProtestDeadlineMinutes, CreatedAt, UpdatedAt
    )
    VALUES (@Round3Id, 1, '2026-06-20 09:00:00', 25000000.00,
            'Official', 1, 1, 24, 120, GETUTCDATE(), GETUTCDATE());

DECLARE @Race1Id INT = (SELECT RaceId FROM Races WHERE RoundId = @Round1Id AND RaceNumber = 1);
DECLARE @Race2Id INT = (SELECT RaceId FROM Races WHERE RoundId = @Round2Id AND RaceNumber = 1);
DECLARE @Race3Id INT = (SELECT RaceId FROM Races WHERE RoundId = @Round3Id AND RaceNumber = 1);

-- =============================================================================
-- BLOCK 6: HORSES — 5 con ngựa
--   4 con đã Approved (tham dự được giải)
--   1 con Pending     (demo luồng Admin phê duyệt — Module C)
-- DopingTestDate phải ≤ TODAY theo CHK_Horses_BirthYear (dùng ngày cố định)
-- =============================================================================

-- Ngựa 1: Thần Phong — ngựa chủ lực của owner_nguyen, vô địch Chung Kết
IF NOT EXISTS (SELECT 1 FROM Horses WHERE [Name] = N'Thần Phong' AND OwnerId = @OwnerNguyenId)
    INSERT INTO Horses (
        OwnerId, [Name], BirthYear, Gender, Color, Pedigree, Weight,
        IdentifyingMarks, Breed, VaccinationRecordRef,
        DopingTestDate, DopingTestResult, [Status], AdminApprovalStatus, CreatedAt, UpdatedAt
    )
    VALUES (
        @OwnerNguyenId, N'Thần Phong', 2019, 'Male', N'Nâu vàng',
        N'Storm Cat × Northern Dancer', 450.00,
        N'Đốm trắng trán, chân phải sau có sọc trắng',
        'Thoroughbred', 'VAC-2026-NP-001',
        '2026-05-20', 'Clean', 'Active', 'Approved', GETUTCDATE(), GETUTCDATE()
    );

-- Ngựa 2: Sấm Trắng — ngựa thứ 2 của owner_nguyen, về hạng 3 Chung Kết
IF NOT EXISTS (SELECT 1 FROM Horses WHERE [Name] = N'Sấm Trắng' AND OwnerId = @OwnerNguyenId)
    INSERT INTO Horses (
        OwnerId, [Name], BirthYear, Gender, Color, Pedigree, Weight,
        IdentifyingMarks, Breed, VaccinationRecordRef,
        DopingTestDate, DopingTestResult, [Status], AdminApprovalStatus, CreatedAt, UpdatedAt
    )
    VALUES (
        @OwnerNguyenId, N'Sấm Trắng', 2020, 'Male', N'Xám bạc',
        N'Galileo × Sadler''s Wells', 470.00,
        N'Lông trắng ở mũi, bờm xám đặc trưng',
        'Thoroughbred', 'VAC-2026-NP-002',
        '2026-05-20', 'Clean', 'Active', 'Approved', GETUTCDATE(), GETUTCDATE()
    );

-- Ngựa 3: Hỏa Long — bị cảnh cáo vi phạm ở Vòng Loại, không vào Bán Kết
IF NOT EXISTS (SELECT 1 FROM Horses WHERE [Name] = N'Hỏa Long' AND OwnerId = @OwnerNguyenId)
    INSERT INTO Horses (
        OwnerId, [Name], BirthYear, Gender, Color, Pedigree, Weight,
        IdentifyingMarks, Breed, VaccinationRecordRef,
        DopingTestDate, DopingTestResult, [Status], AdminApprovalStatus, CreatedAt, UpdatedAt
    )
    VALUES (
        @OwnerNguyenId, N'Hỏa Long', 2018, 'Gelding', N'Nâu đỏ',
        N'Frankel × Pivotal', 460.00,
        N'Sẹo nhỏ vai trái, vòng trắng chân trước phải',
        'Thoroughbred', 'VAC-2026-NP-003',
        '2026-05-20', 'Clean', 'Active', 'Approved', GETUTCDATE(), GETUTCDATE()
    );

-- Ngựa 4: Bão Đêm — ngựa của owner_tran, về hạng 2 Chung Kết
IF NOT EXISTS (SELECT 1 FROM Horses WHERE [Name] = N'Bão Đêm' AND OwnerId = @OwnerTranId)
    INSERT INTO Horses (
        OwnerId, [Name], BirthYear, Gender, Color, Pedigree, Weight,
        IdentifyingMarks, Breed, VaccinationRecordRef,
        DopingTestDate, DopingTestResult, [Status], AdminApprovalStatus, CreatedAt, UpdatedAt
    )
    VALUES (
        @OwnerTranId, N'Bão Đêm', 2021, 'Female', N'Đen tuyền',
        N'Dubawi × Danehill', 440.00,
        N'Vệt trắng dọc sống mũi, tai phải hơi cúp',
        'Thoroughbred', 'VAC-2026-TM-001',
        '2026-05-20', 'Clean', 'Active', 'Approved', GETUTCDATE(), GETUTCDATE()
    );

-- Ngựa 5: Kim Cương — đang chờ duyệt (demo luồng Admin approve ngựa)
IF NOT EXISTS (SELECT 1 FROM Horses WHERE [Name] = N'Kim Cương' AND OwnerId = @OwnerTranId)
    INSERT INTO Horses (
        OwnerId, [Name], BirthYear, Gender, Color, Pedigree, Weight,
        IdentifyingMarks, Breed, VaccinationRecordRef,
        DopingTestDate, DopingTestResult, [Status], AdminApprovalStatus, CreatedAt, UpdatedAt
    )
    VALUES (
        @OwnerTranId, N'Kim Cương', 2022, 'Male', N'Hung đỏ',
        N'Sea The Stars × Montjeu', 455.00,
        N'Lông xoáy trán, đuôi có sợi trắng',
        'Thoroughbred', 'VAC-2026-TM-002',
        '2026-05-25', 'Pending', 'Declared', 'Pending', GETUTCDATE(), GETUTCDATE()
    );

-- Lấy HorseId để dùng cho Pairings
DECLARE @HorseThanPhongId INT = (SELECT HorseId FROM Horses WHERE [Name] = N'Thần Phong' AND OwnerId = @OwnerNguyenId);
DECLARE @HorseSamTrangId  INT = (SELECT HorseId FROM Horses WHERE [Name] = N'Sấm Trắng'  AND OwnerId = @OwnerNguyenId);
DECLARE @HorseHoaLongId   INT = (SELECT HorseId FROM Horses WHERE [Name] = N'Hỏa Long'   AND OwnerId = @OwnerNguyenId);
DECLARE @HorseBaoDemId    INT = (SELECT HorseId FROM Horses WHERE [Name] = N'Bão Đêm'    AND OwnerId = @OwnerTranId);
DECLARE @HorseKimCuongId  INT = (SELECT HorseId FROM Horses WHERE [Name] = N'Kim Cương'  AND OwnerId = @OwnerTranId);

-- =============================================================================
-- BLOCK 7: PAIRINGS — Ghép cặp Horse–Jockey (Module D)
-- 4 Accepted → tham dự Race; 1 Pending → demo luồng jockey chấp nhận lời mời
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM Pairings WHERE HorseId = @HorseThanPhongId AND JockeyId = @JockeyMinhId)
    INSERT INTO Pairings (HorseId, JockeyId, [Status], RequestMessage, CreatedAt, UpdatedAt)
    VALUES (@HorseThanPhongId, @JockeyMinhId, 'Accepted',
            N'Mời jockey Lê Văn Minh đồng hành cùng Thần Phong mùa giải SU26.',
            GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Pairings WHERE HorseId = @HorseSamTrangId AND JockeyId = @JockeyDucId)
    INSERT INTO Pairings (HorseId, JockeyId, [Status], RequestMessage, CreatedAt, UpdatedAt)
    VALUES (@HorseSamTrangId, @JockeyDucId, 'Accepted',
            N'Phạm Đức Huy ghép cặp với Sấm Trắng cho mùa giải 2026.',
            GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Pairings WHERE HorseId = @HorseHoaLongId AND JockeyId = @JockeySonId)
    INSERT INTO Pairings (HorseId, JockeyId, [Status], RequestMessage, CreatedAt, UpdatedAt)
    VALUES (@HorseHoaLongId, @JockeySonId, 'Accepted',
            N'Hoàng Văn Sơn & Hỏa Long — bộ đôi đã hợp tác từ 2024.',
            GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Pairings WHERE HorseId = @HorseBaoDemId AND JockeyId = @JockeyLinhId)
    INSERT INTO Pairings (HorseId, JockeyId, [Status], RequestMessage, CreatedAt, UpdatedAt)
    VALUES (@HorseBaoDemId, @JockeyLinhId, 'Accepted',
            N'Vũ Thị Linh đăng ký cùng Bão Đêm — lần đầu tham dự giải lớn.',
            GETUTCDATE(), GETUTCDATE());

-- Pending: Kim Cương chưa được Admin duyệt → Jockey cũng chưa cần confirm
IF NOT EXISTS (SELECT 1 FROM Pairings WHERE HorseId = @HorseKimCuongId AND JockeyId = @JockeyDucId)
    INSERT INTO Pairings (HorseId, JockeyId, [Status], RequestMessage, CreatedAt, UpdatedAt)
    VALUES (@HorseKimCuongId, @JockeyDucId, 'Pending',
            N'Phạm Đức Huy đề nghị ghép cặp với Kim Cương (chờ Admin phê duyệt ngựa).',
            GETUTCDATE(), GETUTCDATE());

-- Lấy PairingId của 4 cặp Accepted (dùng cho RaceEntries)
DECLARE @PairThanPhongMinhId INT = (SELECT PairingId FROM Pairings WHERE HorseId = @HorseThanPhongId AND JockeyId = @JockeyMinhId);
DECLARE @PairSamTrangDucId   INT = (SELECT PairingId FROM Pairings WHERE HorseId = @HorseSamTrangId  AND JockeyId = @JockeyDucId);
DECLARE @PairHoaLongSonId    INT = (SELECT PairingId FROM Pairings WHERE HorseId = @HorseHoaLongId   AND JockeyId = @JockeySonId);
DECLARE @PairBaoDemLinhId    INT = (SELECT PairingId FROM Pairings WHERE HorseId = @HorseBaoDemId    AND JockeyId = @JockeyLinhId);

-- =============================================================================
-- BLOCK 8: REFEREE & DOCTOR ASSIGNMENTS (Module F, G)
-- Gán cho Race 1 và Race 3 để demo 2 điểm kiểm tra COI [EC-38].
-- =============================================================================

-- Race 1: Trọng tài trưởng referee_long (chỉ 1 Lead per Race [EC-45])
IF NOT EXISTS (SELECT 1 FROM RefereeAssignments WHERE RaceId = @Race1Id AND RefereeId = @RefLongId)
    INSERT INTO RefereeAssignments (RaceId, RefereeId, [Role], AssignedAt)
    VALUES (@Race1Id, @RefLongId, 'Lead Referee', GETUTCDATE());

-- Race 3 (Chung Kết): cần đủ 1 Lead + 1 Assistant
IF NOT EXISTS (SELECT 1 FROM RefereeAssignments WHERE RaceId = @Race3Id AND RefereeId = @RefLongId)
    INSERT INTO RefereeAssignments (RaceId, RefereeId, [Role], AssignedAt)
    VALUES (@Race3Id, @RefLongId, 'Lead Referee', GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM RefereeAssignments WHERE RaceId = @Race3Id AND RefereeId = @RefHaiId)
    INSERT INTO RefereeAssignments (RaceId, RefereeId, [Role], AssignedAt)
    VALUES (@Race3Id, @RefHaiId, 'Assistant Referee', GETUTCDATE());

-- Doctor gán cho Race 1 và Race 3 để đo cân jockey trước/sau đua [EC-39]
IF NOT EXISTS (SELECT 1 FROM DoctorAssignments WHERE RaceId = @Race1Id AND DoctorId = @DoctorThanhId)
    INSERT INTO DoctorAssignments (RaceId, DoctorId, AssignedAt, CertifiedAt)
    VALUES (@Race1Id, @DoctorThanhId, GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM DoctorAssignments WHERE RaceId = @Race3Id AND DoctorId = @DoctorThanhId)
    INSERT INTO DoctorAssignments (RaceId, DoctorId, AssignedAt, CertifiedAt)
    VALUES (@Race3Id, @DoctorThanhId, GETUTCDATE(), GETUTCDATE());

-- =============================================================================
-- BLOCK 9: RACE ENTRIES
-- Thứ tự tham dự:
--   Race 1 (Vòng Loại) : 4 cặp — kết quả: Thần Phong 1st, Bão Đêm 2nd,
--                                           Sấm Trắng 3rd, Hỏa Long 4th
--   Race 2 (Bán Kết)   : 3 cặp (top 3) — kết quả: Bão Đêm 1st,
--                                           Thần Phong 2nd, Sấm Trắng 3rd
--   Race 3 (Chung Kết) : 3 cặp — kết quả: Thần Phong 1st, Bão Đêm 2nd,
--                                           Sấm Trắng 3rd
--
-- FinishTime: giây.millisecond (vd: 95.240 = 1 phút 35 giây 240ms cho 1600m)
-- PostPosition: cổng xuất phát sau bốc thăm — phải duy nhất mỗi Race [EC-06]
-- =============================================================================

-- ── 9.1  RACE 1 — VÒNG LOẠI ─────────────────────────────────────────────────

-- Hạng 1: Thần Phong — có đo cân jockey trước/sau đua bởi doctor_thanh
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race1Id AND PairingId = @PairThanPhongMinhId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race1Id, @PairThanPhongMinhId, 3, 'Confirmed',
        54.60, @DoctorThanhId,   -- cân trước đua: 54.60kg
        54.80, @DoctorThanhId,   -- cân sau đua:  54.80kg — chênh 0.20kg < 1.00kg ✓
        1, 95.240,               -- về nhất, 95.240 giây
        100, 5000000.00,         -- 100 điểm, nhận 50% × 10M = 5M
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 2: Bão Đêm
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race1Id AND PairingId = @PairBaoDemLinhId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race1Id, @PairBaoDemLinhId, 1, 'Confirmed',
        52.90, @DoctorThanhId, 53.10, @DoctorThanhId,
        2, 95.810, 75, 2500000.00,
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 3: Sấm Trắng
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race1Id AND PairingId = @PairSamTrangDucId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race1Id, @PairSamTrangDucId, 2, 'Confirmed',
        56.10, @DoctorThanhId, 56.30, @DoctorThanhId,
        3, 96.120, 50, 1500000.00,
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 4: Hỏa Long — bị cảnh cáo vi phạm (xem Block 10), không lọt Bán Kết
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race1Id AND PairingId = @PairHoaLongSonId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race1Id, @PairHoaLongSonId, 4, 'Confirmed',
        55.20, @DoctorThanhId, 55.50, @DoctorThanhId,
        4, 97.050, 25, 700000.00,
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- ── 9.2  RACE 2 — BÁN KẾT (3 cặp top từ Vòng Loại) ─────────────────────────

-- Hạng 1: Bão Đêm lật ngược tình thế
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race2Id AND PairingId = @PairBaoDemLinhId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race2Id, @PairBaoDemLinhId, 2, 'Confirmed',
        1, 94.520, 100, 7500000.00,
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 2: Thần Phong
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race2Id AND PairingId = @PairThanPhongMinhId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race2Id, @PairThanPhongMinhId, 1, 'Confirmed',
        2, 94.890, 75, 3750000.00,
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 3: Sấm Trắng
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race2Id AND PairingId = @PairSamTrangDucId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race2Id, @PairSamTrangDucId, 3, 'Confirmed',
        3, 95.430, 50, 2250000.00,
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- ── 9.3  RACE 3 — CHUNG KẾT ─────────────────────────────────────────────────
-- Thần Phong trở lại ngôi đầu. Cân nặng jockey được Doctor Lê Thanh Tùng đo.
-- PostRaceWeightFlagged=0: tất cả nằm trong ngưỡng cho phép 1.00kg [EC-39]

-- Hạng 1: Thần Phong — cũng là nguồn cho Predictions thắng
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race3Id AND PairingId = @PairThanPhongMinhId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race3Id, @PairThanPhongMinhId, 1, 'Confirmed',
        54.55, @DoctorThanhId,   -- cân trước: 54.55kg
        54.70, @DoctorThanhId,   -- cân sau:  54.70kg — chênh 0.15kg ✓
        1, 93.150,               -- kỷ lục cá nhân của Thần Phong
        150, 12500000.00,        -- hạng 1: 50% × 25M = 12.5M
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 2: Bão Đêm
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race3Id AND PairingId = @PairBaoDemLinhId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race3Id, @PairBaoDemLinhId, 3, 'Confirmed',
        52.85, @DoctorThanhId, 53.00, @DoctorThanhId,
        2, 93.620, 100, 6250000.00,   -- hạng 2: 25% × 25M = 6.25M
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Hạng 3: Sấm Trắng
IF NOT EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId = @Race3Id AND PairingId = @PairSamTrangDucId)
    INSERT INTO RaceEntries (
        RaceId, PairingId, PostPosition, [Status],
        PreRaceJockeyWeight,  PreRaceWeightByDoctorId,
        PostRaceJockeyWeight, PostRaceWeightByDoctorId,
        FinishPosition, FinishTime, PointsAwarded, EarningsAwarded,
        EntryFeeStatus, EntryFeeConfirmedBy, EntryFeeConfirmedAt,
        IsWithdrawn, PostRaceWeightFlagged, CreatedAt, UpdatedAt
    )
    VALUES (
        @Race3Id, @PairSamTrangDucId, 2, 'Confirmed',
        56.05, @DoctorThanhId, 56.20, @DoctorThanhId,
        3, 94.280, 75, 3750000.00,    -- hạng 3: 15% × 25M = 3.75M
        'Paid', @AdminId, GETUTCDATE(),
        0, 0, GETUTCDATE(), GETUTCDATE()
    );

-- Lấy RaceEntryId để dùng cho Predictions, PursePayouts, Violations, Protests
DECLARE @RE1_ThanPhong INT = (SELECT RaceEntryId FROM RaceEntries WHERE RaceId = @Race1Id AND PairingId = @PairThanPhongMinhId);
DECLARE @RE1_HoaLong   INT = (SELECT RaceEntryId FROM RaceEntries WHERE RaceId = @Race1Id AND PairingId = @PairHoaLongSonId);
DECLARE @RE3_ThanPhong INT = (SELECT RaceEntryId FROM RaceEntries WHERE RaceId = @Race3Id AND PairingId = @PairThanPhongMinhId);
DECLARE @RE3_BaoDem    INT = (SELECT RaceEntryId FROM RaceEntries WHERE RaceId = @Race3Id AND PairingId = @PairBaoDemLinhId);
DECLARE @RE3_SamTrang  INT = (SELECT RaceEntryId FROM RaceEntries WHERE RaceId = @Race3Id AND PairingId = @PairSamTrangDucId);

-- =============================================================================
-- BLOCK 10: RACE REPORTS & VIOLATIONS (Module H)
-- =============================================================================

-- Biên bản Race 1 — đã khóa, có ghi 1 vi phạm
IF NOT EXISTS (SELECT 1 FROM RaceReports WHERE RaceId = @Race1Id)
    INSERT INTO RaceReports (RaceId, LeadRefereeId, Notes, IsLocked, SubmittedAt, LockedAt)
    VALUES (
        @Race1Id, @RefLongId,
        N'Vòng Loại hoàn thành. Ghi nhận 1 cảnh cáo (Hỏa Long cản đường tại km 0.8). '
        + N'Kết quả chính thức được xác nhận lúc 10:15.',
        1,                         -- IsLocked=1: biên bản đã chốt, bất biến [EC-19]
        '2026-06-10 10:00:00',
        '2026-06-10 10:15:00'
    );

-- Biên bản Race 3 (Chung Kết) — đã khóa, không phát sinh vi phạm
IF NOT EXISTS (SELECT 1 FROM RaceReports WHERE RaceId = @Race3Id)
    INSERT INTO RaceReports (RaceId, LeadRefereeId, Notes, IsLocked, SubmittedAt, LockedAt)
    VALUES (
        @Race3Id, @RefLongId,
        N'Chung Kết diễn ra sạch sẽ. Thần Phong về nhất sau 1600m với 93.150 giây. '
        + N'Không phát sinh vi phạm. Kết quả chính thức được xác nhận lúc 10:45.',
        1,
        '2026-06-20 10:30:00',
        '2026-06-20 10:45:00'
    );

DECLARE @RaceReport1Id INT = (SELECT RaceReportId FROM RaceReports WHERE RaceId = @Race1Id);
DECLARE @RaceReport3Id INT = (SELECT RaceReportId FROM RaceReports WHERE RaceId = @Race3Id);

-- Vi phạm: Hỏa Long cản đường Thần Phong tại km 0.8 (Vòng Loại) — chỉ cảnh cáo
IF NOT EXISTS (SELECT 1 FROM Violations WHERE RaceReportId = @RaceReport1Id AND RaceEntryId = @RE1_HoaLong)
    INSERT INTO Violations (
        RaceReportId, RaceEntryId, ViolationCode, Penalty, [Description], LoggedAt
    )
    VALUES (
        @RaceReport1Id, @RE1_HoaLong,
        'VIO-INT-001',    -- mã nội bộ: Interference (cản đường)
        'Warning',        -- mức: cảnh cáo — không ảnh hưởng thứ hạng
        N'Hỏa Long lấn sang làn đường của Thần Phong tại km 0.8. '
        + N'Trọng tài ghi nhận và cảnh cáo. Thứ hạng giữ nguyên.',
        '2026-06-10 09:15:00'
    );

DECLARE @VioHoaLong1Id INT = (
    SELECT TOP 1 ViolationId FROM Violations
    WHERE RaceReportId = @RaceReport1Id AND RaceEntryId = @RE1_HoaLong
);

-- =============================================================================
-- BLOCK 11: PROTESTS — Khiếu nại (Module I)
-- Owner Trần Thị Mai khiếu nại vi phạm của Hỏa Long trong Race 1.
-- Kết quả: Rejected — trọng tài giữ nguyên quyết định sau khi xem lại video.
-- =============================================================================

IF NOT EXISTS (
    SELECT 1 FROM Protests
    WHERE RaceId = @Race1Id AND SubmittedByUserId = @OwnerTranId
)
    INSERT INTO Protests (
        RaceId, SubmittedByUserId, AccusedRaceEntryId, ViolationId,
        [Description], [Status], RefereeDecision, PenaltyApplied,
        SubmittedAt, ResolvedAt
    )
    VALUES (
        @Race1Id, @OwnerTranId,
        @RE1_HoaLong,    -- entry bị khiếu nại: Hỏa Long
        @VioHoaLong1Id,  -- liên kết trực tiếp tới Violation đã ghi
        N'Bão Đêm bị Hỏa Long cản đường ở đoạn km 0.8, ảnh hưởng đến thành tích. '
        + N'Đề nghị xem xét lại thứ hạng và tăng mức phạt.',
        'Rejected',
        N'Trọng tài đã xem lại video từ nhiều góc. Hành vi của Hỏa Long đã được xử lý '
        + N'bằng cảnh cáo (VIO-INT-001) — đủ theo quy định. Không đủ căn cứ thay đổi thứ hạng.',
        NULL,                          -- không áp thêm hình phạt
        '2026-06-10 10:05:00',
        '2026-06-10 10:20:00'
    );

-- =============================================================================
-- BLOCK 12: WALLETS & VIRTUAL POINTS TRANSACTIONS (Module N)
-- Mỗi Spectator có đúng 1 Wallet. Điểm ban đầu: 10,000 (SignUp Bonus).
--
-- Dòng tiền của từng spectator:
--   spectator_an  : +10,000 (bonus) − 500 (đặt) + 1,000 (thắng) = 10,500
--   spectator_binh: +10,000 (bonus) − 300 (đặt, thua)            =  9,700
--   spectator_chi : +10,000 (bonus) − 200 (đặt) + 400 (thắng)   = 10,200
-- =============================================================================

-- ── 12.1  Wallets ────────────────────────────────────────────────────────────
-- Balance phản ánh số dư CUỐI CÙNG sau tất cả giao dịch
IF NOT EXISTS (SELECT 1 FROM Wallets WHERE SpectatorId = @SpectAnId)
    INSERT INTO Wallets (SpectatorId, Balance, UpdatedAt) VALUES (@SpectAnId,   10500, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Wallets WHERE SpectatorId = @SpectBinhId)
    INSERT INTO Wallets (SpectatorId, Balance, UpdatedAt) VALUES (@SpectBinhId,  9700, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Wallets WHERE SpectatorId = @SpectChiId)
    INSERT INTO Wallets (SpectatorId, Balance, UpdatedAt) VALUES (@SpectChiId,  10200, GETUTCDATE());

DECLARE @WalletAnId   INT = (SELECT WalletId FROM Wallets WHERE SpectatorId = @SpectAnId);
DECLARE @WalletBinhId INT = (SELECT WalletId FROM Wallets WHERE SpectatorId = @SpectBinhId);
DECLARE @WalletChiId  INT = (SELECT WalletId FROM Wallets WHERE SpectatorId = @SpectChiId);

-- ── 12.2  VirtualPointsTransactions (sổ cái append-only) ────────────────────
-- Không có unique key tự nhiên nên dùng COUNT theo ReferenceId để chống duplicate

-- Thưởng đăng ký: +10,000 điểm mỗi người khi tạo tài khoản
IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletAnId   AND ReferenceId = 'SIGNUP_AN')   = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletAnId,   10000, 'SignUp Bonus', 'SIGNUP_AN');

IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletBinhId AND ReferenceId = 'SIGNUP_BINH') = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletBinhId, 10000, 'SignUp Bonus', 'SIGNUP_BINH');

IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletChiId  AND ReferenceId = 'SIGNUP_CHI')  = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletChiId,  10000, 'SignUp Bonus', 'SIGNUP_CHI');

-- Đặt cược trước Chung Kết: âm điểm (Prediction Placed)
IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletAnId   AND ReferenceId = 'PRED_R3_AN')   = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletAnId,    -500, 'Prediction Placed', 'PRED_R3_AN');

IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletBinhId AND ReferenceId = 'PRED_R3_BINH') = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletBinhId,  -300, 'Prediction Placed', 'PRED_R3_BINH');

IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletChiId  AND ReferenceId = 'PRED_R3_CHI')  = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletChiId,   -200, 'Prediction Placed', 'PRED_R3_CHI');

-- Thưởng thắng cược: x2 điểm đã đặt (chỉ người đoán đúng hạng 1)
IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletAnId  AND ReferenceId = 'REWARD_R3_AN')  = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletAnId,  1000, 'Prediction Win Reward', 'REWARD_R3_AN');

IF (SELECT COUNT(*) FROM VirtualPointsTransactions WHERE WalletId = @WalletChiId AND ReferenceId = 'REWARD_R3_CHI') = 0
    INSERT INTO VirtualPointsTransactions (WalletId, Amount, [Type], ReferenceId)
    VALUES (@WalletChiId,  400, 'Prediction Win Reward', 'REWARD_R3_CHI');
-- spectator_binh thua → không có giao dịch REWARD, không được hoàn điểm

-- =============================================================================
-- BLOCK 13: PREDICTIONS — Dự đoán Chung Kết (Module M)
-- Quy tắc: mỗi Spectator chỉ đặt 1 lần cho 1 entry / 1 race (UQ constraint).
-- Tỷ lệ: thắng nhận x2 PointsPlaced (demo đơn giản).
-- =============================================================================

-- spectator_an đặt 500 điểm vào Thần Phong → WON (hạng 1 đúng dự đoán)
IF NOT EXISTS (SELECT 1 FROM Predictions WHERE SpectatorId = @SpectAnId AND RaceEntryId = @RE3_ThanPhong AND PredictionType = 'Win')
    INSERT INTO Predictions (SpectatorId, RaceId, RaceEntryId, PredictionType, PointsPlaced, [Status], PointsAwarded)
    VALUES (@SpectAnId, @Race3Id, @RE3_ThanPhong, 'Win', 500, 'Won', 1000);

-- spectator_binh đặt 300 điểm vào Bão Đêm → LOST (Bão Đêm về hạng 2, không thắng)
IF NOT EXISTS (SELECT 1 FROM Predictions WHERE SpectatorId = @SpectBinhId AND RaceEntryId = @RE3_BaoDem AND PredictionType = 'Win')
    INSERT INTO Predictions (SpectatorId, RaceId, RaceEntryId, PredictionType, PointsPlaced, [Status], PointsAwarded)
    VALUES (@SpectBinhId, @Race3Id, @RE3_BaoDem, 'Win', 300, 'Lost', NULL);

-- spectator_chi đặt 200 điểm vào Thần Phong → WON
IF NOT EXISTS (SELECT 1 FROM Predictions WHERE SpectatorId = @SpectChiId AND RaceEntryId = @RE3_ThanPhong AND PredictionType = 'Win')
    INSERT INTO Predictions (SpectatorId, RaceId, RaceEntryId, PredictionType, PointsPlaced, [Status], PointsAwarded)
    VALUES (@SpectChiId, @Race3Id, @RE3_ThanPhong, 'Win', 200, 'Won', 400);

-- =============================================================================
-- BLOCK 14: PURSE PAYOUTS — Trao thưởng Chung Kết (Module K)
-- PurseAmount Race 3 = 25,000,000 VND
-- Tỷ lệ Owner:Jockey = 60:40 (quy ước demo — ứng dụng có thể cấu hình khác)
--
-- Phân bổ:
--   Hạng 1 (50% = 12,500,000): Owner Nguyễn 7,500,000 | Jockey Minh 5,000,000
--   Hạng 2 (25% =  6,250,000): Owner Trần   3,750,000 | Jockey Linh 2,500,000
--   Hạng 3 (15% =  3,750,000): Owner Nguyễn 2,250,000 | Jockey Đức  1,500,000
-- =============================================================================

-- Hạng 1 — Thần Phong (Owner: Nguyễn Văn Phú | Jockey: Lê Văn Minh)
IF NOT EXISTS (SELECT 1 FROM PursePayouts WHERE RaceEntryId = @RE3_ThanPhong AND RecipientUserId = @OwnerNguyenId)
    INSERT INTO PursePayouts (RaceEntryId, RecipientUserId, [Role], CalculatedAmount, PayoutStatus, PaidAt, UpdatedByAdminId, UpdatedAt)
    VALUES (@RE3_ThanPhong, @OwnerNguyenId, 'Owner',  7500000.00, 'Paid', '2026-06-21 09:00:00', @AdminId, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM PursePayouts WHERE RaceEntryId = @RE3_ThanPhong AND RecipientUserId = @JockeyMinhId)
    INSERT INTO PursePayouts (RaceEntryId, RecipientUserId, [Role], CalculatedAmount, PayoutStatus, PaidAt, UpdatedByAdminId, UpdatedAt)
    VALUES (@RE3_ThanPhong, @JockeyMinhId,  'Jockey', 5000000.00, 'Paid', '2026-06-21 09:00:00', @AdminId, GETUTCDATE());

-- Hạng 2 — Bão Đêm (Owner: Trần Thị Mai | Jockey: Vũ Thị Linh)
IF NOT EXISTS (SELECT 1 FROM PursePayouts WHERE RaceEntryId = @RE3_BaoDem AND RecipientUserId = @OwnerTranId)
    INSERT INTO PursePayouts (RaceEntryId, RecipientUserId, [Role], CalculatedAmount, PayoutStatus, PaidAt, UpdatedByAdminId, UpdatedAt)
    VALUES (@RE3_BaoDem, @OwnerTranId,   'Owner',  3750000.00, 'Paid', '2026-06-21 09:00:00', @AdminId, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM PursePayouts WHERE RaceEntryId = @RE3_BaoDem AND RecipientUserId = @JockeyLinhId)
    INSERT INTO PursePayouts (RaceEntryId, RecipientUserId, [Role], CalculatedAmount, PayoutStatus, PaidAt, UpdatedByAdminId, UpdatedAt)
    VALUES (@RE3_BaoDem, @JockeyLinhId,  'Jockey', 2500000.00, 'Paid', '2026-06-21 09:00:00', @AdminId, GETUTCDATE());

-- Hạng 3 — Sấm Trắng (Owner: Nguyễn Văn Phú | Jockey: Phạm Đức Huy)
IF NOT EXISTS (SELECT 1 FROM PursePayouts WHERE RaceEntryId = @RE3_SamTrang AND RecipientUserId = @OwnerNguyenId)
    INSERT INTO PursePayouts (RaceEntryId, RecipientUserId, [Role], CalculatedAmount, PayoutStatus, PaidAt, UpdatedByAdminId, UpdatedAt)
    VALUES (@RE3_SamTrang, @OwnerNguyenId, 'Owner',  2250000.00, 'Paid', '2026-06-21 09:05:00', @AdminId, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM PursePayouts WHERE RaceEntryId = @RE3_SamTrang AND RecipientUserId = @JockeyDucId)
    INSERT INTO PursePayouts (RaceEntryId, RecipientUserId, [Role], CalculatedAmount, PayoutStatus, PaidAt, UpdatedByAdminId, UpdatedAt)
    VALUES (@RE3_SamTrang, @JockeyDucId,   'Jockey', 1500000.00, 'Paid', '2026-06-21 09:05:00', @AdminId, GETUTCDATE());

-- =============================================================================
-- BLOCK 15: AUDIT LOGS — Nhật ký kiểm toán (Module O)
-- Append-only. Dùng ReferenceId làm sentinel để chống duplicate khi chạy lại.
-- NewValue/OldValue là JSON thuần ASCII nên không cần N'...'.
-- =============================================================================

-- Admin phê duyệt ngựa Thần Phong
IF (SELECT COUNT(*) FROM AuditLogs WHERE [Action] = 'APPROVE_HORSE'
    AND EntityName = 'Horses' AND EntityId = CAST(@HorseThanPhongId AS VARCHAR(50))) = 0
    INSERT INTO AuditLogs (ActorId, [Action], EntityName, EntityId, OldValue, NewValue, IpAddress)
    VALUES (
        @AdminId, 'APPROVE_HORSE', 'Horses', CAST(@HorseThanPhongId AS VARCHAR(50)),
        '{"AdminApprovalStatus":"Pending"}',
        '{"AdminApprovalStatus":"Approved"}',
        '127.0.0.1'
    );

-- Trọng tài trưởng khóa biên bản Chung Kết
IF (SELECT COUNT(*) FROM AuditLogs WHERE [Action] = 'LOCK_RACE_REPORT'
    AND EntityName = 'RaceReports' AND EntityId = CAST(@RaceReport3Id AS VARCHAR(50))) = 0
    INSERT INTO AuditLogs (ActorId, [Action], EntityName, EntityId, OldValue, NewValue, IpAddress)
    VALUES (
        @RefLongId, 'LOCK_RACE_REPORT', 'RaceReports', CAST(@RaceReport3Id AS VARCHAR(50)),
        '{"IsLocked":false}',
        '{"IsLocked":true,"LockedAt":"2026-06-20T10:45:00Z"}',
        '192.168.1.15'
    );

-- =============================================================================
-- BLOCK 16: NOTIFICATIONS — Thông báo in-app & email (Module Q)
-- =============================================================================

-- Jockey Minh: vô địch Chung Kết
IF (SELECT COUNT(*) FROM Notifications WHERE RecipientId = @JockeyMinhId
    AND Title = N'🏆 Chúc mừng! Bạn đã vô địch Chung Kết') = 0
    INSERT INTO Notifications (RecipientId, Title, [Message], [Type], IsRead, RelatedEntityType, RelatedEntityId, SentAt)
    VALUES (
        @JockeyMinhId,
        N'🏆 Chúc mừng! Bạn đã vô địch Chung Kết',
        N'Thần Phong và bạn xuất sắc về đích đầu tiên tại Chung Kết SU26. '
        + N'Tiền thưởng 5,000,000 VND đang được xử lý.',
        'In-app', 0, 'Races', @Race3Id, '2026-06-20 10:50:00'
    );

-- Owner Nguyễn: tiền thưởng đã được thanh toán (cả hạng 1 và hạng 3)
IF (SELECT COUNT(*) FROM Notifications WHERE RecipientId = @OwnerNguyenId
    AND Title = N'Tiền thưởng Chung Kết đã được thanh toán') = 0
    INSERT INTO Notifications (RecipientId, Title, [Message], [Type], IsRead, RelatedEntityType, RelatedEntityId, SentAt)
    VALUES (
        @OwnerNguyenId,
        N'Tiền thưởng Chung Kết đã được thanh toán',
        N'Thần Phong (Hạng 1): 7,500,000 VND và Sấm Trắng (Hạng 3): 2,250,000 VND '
        + N'đã được Admin xác nhận. Vui lòng kiểm tra tài khoản.',
        'Both', 0, 'PursePayouts', NULL, '2026-06-21 09:10:00'
    );

-- Spectator An: dự đoán thắng
IF (SELECT COUNT(*) FROM Notifications WHERE RecipientId = @SpectAnId
    AND Title = N'Dự đoán của bạn đã thắng!') = 0
    INSERT INTO Notifications (RecipientId, Title, [Message], [Type], IsRead, RelatedEntityType, RelatedEntityId, SentAt)
    VALUES (
        @SpectAnId,
        N'Dự đoán của bạn đã thắng!',
        N'Thần Phong về hạng 1 đúng như dự đoán. '
        + N'1,000 điểm đã được cộng vào ví. Số dư hiện tại: 10,500 điểm.',
        'In-app', 0, 'Predictions', NULL, '2026-06-20 10:55:00'
    );

-- Spectator Bình: dự đoán thua
IF (SELECT COUNT(*) FROM Notifications WHERE RecipientId = @SpectBinhId
    AND Title = N'Dự đoán không thành công') = 0
    INSERT INTO Notifications (RecipientId, Title, [Message], [Type], IsRead, RelatedEntityType, RelatedEntityId, SentAt)
    VALUES (
        @SpectBinhId,
        N'Dự đoán không thành công',
        N'Bão Đêm về hạng 2 trong Chung Kết. '
        + N'300 điểm đặt cược không được hoàn trả. Số dư: 9,700 điểm. Chúc may mắn lần sau!',
        'In-app', 0, 'Predictions', NULL, '2026-06-20 10:55:00'
    );

-- Owner Trần: kết quả xử lý khiếu nại
IF (SELECT COUNT(*) FROM Notifications WHERE RecipientId = @OwnerTranId
    AND Title = N'Kết quả xử lý khiếu nại — Vòng Loại') = 0
    INSERT INTO Notifications (RecipientId, Title, [Message], [Type], IsRead, RelatedEntityType, RelatedEntityId, SentAt)
    VALUES (
        @OwnerTranId,
        N'Kết quả xử lý khiếu nại — Vòng Loại',
        N'Khiếu nại về vi phạm của Hỏa Long đã được trọng tài xem xét. '
        + N'Sau khi xem lại video, khiếu nại bị bác — kết quả giữ nguyên.',
        'Both', 1, 'Protests', NULL, '2026-06-10 10:25:00'
    );




-- =============================================================================
-- TỔNG KẾT DỮ LIỆU SEED
-- =============================================================================
-- Bảng                   | Số bản ghi
-- -----------------------|-----------
-- Users                  | 13  (1 Admin · 2 Owner · 4 Jockey · 2 Referee · 1 Doctor · 3 Spectator)
-- OwnerProfiles          |  2
-- JockeyProfiles         |  4
-- RefereeProfiles        |  2
-- DoctorProfiles         |  1
-- SpectatorProfiles      |  3
-- Tournaments            |  1  (Completed)
-- PrizeDistributions     |  5  (Pos 1–5)
-- Rounds                 |  3  (Vòng Loại · Bán Kết · Chung Kết)
-- Races                  |  3  (10M · 15M · 25M — tất cả Official)
-- Horses                 |  5  (4 Approved + 1 Pending)
-- Pairings               |  5  (4 Accepted + 1 Pending)
-- RefereeAssignments     |  3  (Race1×1 Lead · Race3×1 Lead + 1 Assistant)
-- DoctorAssignments      |  2  (Race1 + Race3)
-- RaceEntries            | 10  (Race1×4 · Race2×3 · Race3×3)
-- RaceReports            |  2  (Race1 locked · Race3 locked)
-- Violations             |  1  (Warning — Hỏa Long, Race 1)
-- Protests               |  1  (Rejected — Race 1)
-- Wallets                |  3
-- VirtualPointsTransact. |  8  (3 Bonus + 3 Placed + 2 Win Reward)
-- Predictions            |  3  (2 Won + 1 Lost)
-- PursePayouts           |  6  (Race3 Pos1–3, Owner+Jockey mỗi vị trí)
-- AuditLogs              |  2
-- Notifications          |  5
-- =============================================================================
