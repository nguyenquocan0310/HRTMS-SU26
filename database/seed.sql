/* =============================================================================
   HRTMS seed.sql — SEED HỢP NHẤT CHO DEMO "GIẢI ĐUA NGỰA MÙA HÈ 2026"
   -----------------------------------------------------------------------------
   Gộp từ bộ demo (2026-07-19): 01_base_accounts.sql + 02_create_tournament.sql
   + hai tài khoản chính + mã ticket demo.

   Tạo:
     • Admin        : summer26_admin / summer26.admin@hrtms.localhost.com
     • 2 TÀI KHOẢN CHÍNH (thao tác demo, nhận mail thật):
         Owner  : nguyenan_owner  / nguyenan159246+owner@gmail.com
         Jockey : nguyenan_jockey / nguyenan159246+jockey@gmail.com
     • 37 cặp Owner/Jockey hỗ trợ (summer26_owner01..37 / summer26_jockey01..37)
     • 2 Referee, 2 Doctor, 1 Spectator (kèm ví 1000 điểm)
     • Tournament GIẢI ĐUA NGỰA MÙA HÈ 2026: 3 round, race 4/2/1, 01–30/09/2026,
       MaxHorses=10, TopPerRace, AdvancementCount=5; tổng purse 500.000.000
       (Vòng loại 50tr×4 + Bán kết 75tr×2 + Chung kết 150tr)
     • GIẢI GIAO HỮU THÁNG 9-2026 (song song 05–25/09/2026, Open Registration,
       1 round / 1 race, MaxHorses=10, 0 pairing ban đầu — account/ngựa/roster
       friendly26_* sẵn sàng để ghép cặp bằng UI hoặc seed2)
       — demo vận hành nhiều giải cùng lúc + demo nhanh MỘT race duy nhất
       (bổ sung 9 pairing hỗ trợ cho đủ 10 bằng `src\demo\seed2`)
     • GIẢI ĐUA NGỰA MÙA XUÂN 2026 (01–31/03/2026, Completed) — lịch sử đầy đủ:
       2 round / 3 race Official, 8 pairing spring26_*, kết quả, biên bản khóa,
       payout đã trả, thông báo — xem lại như một giải thật
     • 5 mã TicketRewardCodes (plaintext theo patch 008)

   Mật khẩu mọi tài khoản seed: password  (hash BCrypt bên dưới).
   Idempotent: NOT EXISTS — chạy lại an toàn, không tạo trùng.
   ⚠️ Chỉ chạy trên database HRTMS (guard bên dưới). KHÔNG chạy trên production.
   ============================================================================= */

SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'HRTMS'
    THROW 51000, N'DỪNG: database đích phải là HRTMS.', 1;

DECLARE @Now DATETIME2 = SYSUTCDATETIME();
DECLARE @PasswordHash VARCHAR(255) = '$2a$12$h5ACuyerc5Y4nYStAGnYlOJVNBMkbMzRfnHCMGQZuk0LApe0xrO5y'; -- "password"

BEGIN TRY
    BEGIN TRANSACTION;

    /* ------------------------------------------------------------------ ADMIN */
    IF NOT EXISTS (SELECT 1 FROM Users WHERE Username='summer26_admin')
        INSERT Users (Username,FullName,Email,NormalizedEmail,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
        VALUES ('summer26_admin',N'Quản trị Mùa Hè 2026','summer26.admin@hrtms.localhost.com',
                'SUMMER26.ADMIN@HRTMS.LOCALHOST.COM',@PasswordHash,'Admin','Active',@Now,@Now);

    /* -------------------------------------------- 2 TÀI KHOẢN CHÍNH (demo thật)
       Username KHÔNG theo pattern summer26_owner%/summer26_jockey% để các seed
       hỗ trợ (pairing nền, allocation bulk) không đụng vào cặp chính. */
    IF NOT EXISTS (SELECT 1 FROM Users WHERE Email='nguyenan159246+owner@gmail.com')
        INSERT Users (Username,FullName,Email,NormalizedEmail,PhoneNumber,NormalizedPhone,DateOfBirth,
                      IdentityNumberEncrypted,IdentityHash,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
        VALUES ('nguyenan_owner',N'Nguyễn Quốc An (Chủ ngựa)','nguyenan159246+owner@gmail.com',
                'NGUYENAN159246+OWNER@GMAIL.COM','0911113224','0911113224','1990-01-01',
                CONVERT(VARBINARY(512),'079090113224'),HASHBYTES('SHA2_256','079090113224'),
                @PasswordHash,'Owner','Active',@Now,@Now);

    IF NOT EXISTS (SELECT 1 FROM Users WHERE Email='nguyenan159246+jockey@gmail.com')
        INSERT Users (Username,FullName,Email,NormalizedEmail,PhoneNumber,NormalizedPhone,DateOfBirth,
                      IdentityNumberEncrypted,IdentityHash,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
        VALUES ('nguyenan_jockey',N'Nguyễn Quốc An (Nài ngựa)','nguyenan159246+jockey@gmail.com',
                'NGUYENAN159246+JOCKEY@GMAIL.COM','0911159246','0911159246','1999-01-01',
                CONVERT(VARBINARY(512),'001099159246'),HASHBYTES('SHA2_256','001099159246'),
                @PasswordHash,'Jockey','Active',@Now,@Now);

    INSERT OwnerProfiles (OwnerId,CreatedAt,UpdatedAt)
    SELECT UserId,@Now,@Now FROM Users u WHERE u.Username='nguyenan_owner'
      AND NOT EXISTS (SELECT 1 FROM OwnerProfiles p WHERE p.OwnerId=u.UserId);

    INSERT JockeyProfiles (JockeyId,LicenseCertificate,ExperienceYears,SelfDeclaredWeight,BloodType,HealthStatus,[Status],CreatedAt,UpdatedAt)
    SELECT UserId,'nguyenan_jockey.pdf',6,53.50,'O+','Good','Active',@Now,@Now FROM Users u
    WHERE u.Username='nguyenan_jockey'
      AND NOT EXISTS (SELECT 1 FROM JockeyProfiles p WHERE p.JockeyId=u.UserId);

    /* ------------------------------------- 37 CẶP OWNER/JOCKEY HỖ TRỢ + STAFF */
    DECLARE @Support TABLE (N INT PRIMARY KEY, OwnerName NVARCHAR(100), JockeyName NVARCHAR(100));
    INSERT @Support VALUES
    (1,N'Nguyễn Nhật Hạ',N'Lê Anh Khoa'),
    (2,N'Trần Minh Bảo',N'Phạm Quốc Anh'),(3,N'Lê Ngọc Châu',N'Võ Thành Bách'),
    (4,N'Phạm Thu Dung',N'Nguyễn Minh Cường'),(5,N'Vũ Hoàng Đức',N'Trần Hải Đăng'),
    (6,N'Đặng Ngọc Hà',N'Lê Trọng Giang'),(7,N'Bùi Thành Hưng',N'Phạm Khánh Hòa'),
    (8,N'Đỗ Mai Lan',N'Vũ Đức Long'),(9,N'Hoàng Văn Nam',N'Đặng Nhật Minh'),
    (10,N'Ngô Thảo Phương',N'Bùi Quốc Phúc'),(11,N'Dương Hải Sơn',N'Đỗ Thành Tâm'),
    (12,N'Đinh Ngọc Trang',N'Hoàng Anh Tú'),(13,N'Tạ Quang Vinh',N'Ngô Quang Việt'),
    (14,N'Nguyễn Bảo Yến',N'Dương Minh Xuân'),(15,N'Trần Gia Hân',N'Đinh Tuấn Kiệt'),
    (16,N'Lê Đức Khang',N'Tạ Hoàng Lâm'),(17,N'Phạm Thanh Mai',N'Nguyễn Công Nam'),
    (18,N'Vũ Quỳnh Nga',N'Trần Đức Phong'),(19,N'Đặng Hữu Phúc',N'Lê Minh Quân'),
    (20,N'Bùi Kim Oanh',N'Phạm Tuấn Sơn'),(21,N'Đỗ Xuân Quang',N'Vũ Gia Thịnh'),
    (22,N'Hoàng Minh Tâm',N'Đặng Quốc Toàn'),(23,N'Ngô Hải Yến',N'Bùi Thanh Vũ'),
    (24,N'Dương Quốc Bảo',N'Đỗ Anh Dũng'),(25,N'Đinh Thu Giang',N'Hoàng Minh Hiếu'),
    (26,N'Tạ Minh Khôi',N'Ngô Quang Huy'),(27,N'Nguyễn Phương Linh',N'Dương Đức Mạnh'),
    (28,N'Trần Hoài An',N'Đinh Thanh Nhân'),(29,N'Lê Khánh Chi',N'Tạ Quốc Thắng'),
    (30,N'Phạm Quốc Duy',N'Nguyễn Văn Trí'),(31,N'Vũ Thanh Hương',N'Trần Minh Vương'),
    (32,N'Đặng Đình Khánh',N'Lê Quốc Cường'),(33,N'Bùi Ngọc Liên',N'Phạm Hải Dương'),
    (34,N'Đỗ Trọng Nghĩa',N'Vũ Minh Hoàng'),(35,N'Hoàng Thu Thủy',N'Đặng Gia Huy'),
    (36,N'Ngô Tuấn Vũ',N'Bùi Hoàng Long'),(37,N'Dương Bảo Trâm',N'Đỗ Quốc Minh');

    DECLARE @Accounts TABLE (Username VARCHAR(50),FullName NVARCHAR(100),Email VARCHAR(100),[Role] VARCHAR(20),Phone VARCHAR(20),Dob DATE,IdentityNo VARCHAR(20));
    INSERT @Accounts VALUES
    ('summer26_referee01',N'Trọng tài Phan Văn Kiên','summer26.referee01@hrtms.localhost.com','Referee','0926000001','1978-03-15','001078260001'),
    ('summer26_referee02',N'Trọng tài Lương Đức Mạnh','summer26.referee02@hrtms.localhost.com','Referee','0926000002','1980-04-16','001080260002'),
    ('summer26_doctor01',N'Bác sĩ Nguyễn Thùy Linh','summer26.doctor01@hrtms.localhost.com','Doctor','0936000001','1984-05-17','001084260001'),
    ('summer26_doctor02',N'Bác sĩ Trần Quốc Thái','summer26.doctor02@hrtms.localhost.com','Doctor','0936000002','1982-06-18','001082260002');

    INSERT @Accounts
    SELECT CONCAT('summer26_owner',RIGHT('00'+CAST(N AS VARCHAR(2)),2)),OwnerName,
           CONCAT('summer26.owner',RIGHT('00'+CAST(N AS VARCHAR(2)),2),'@hrtms.localhost.com'),'Owner',
           CONCAT('0907',RIGHT('000000'+CAST(N AS VARCHAR(6)),6)),'1988-01-01',CONCAT('001088',RIGHT('000000'+CAST(N AS VARCHAR(6)),6))
    FROM @Support
    UNION ALL
    SELECT CONCAT('summer26_jockey',RIGHT('00'+CAST(N AS VARCHAR(2)),2)),JockeyName,
           CONCAT('summer26.jockey',RIGHT('00'+CAST(N AS VARCHAR(2)),2),'@hrtms.localhost.com'),'Jockey',
           CONCAT('0917',RIGHT('000000'+CAST(N AS VARCHAR(6)),6)),'1997-01-01',CONCAT('079097',RIGHT('000000'+CAST(N AS VARCHAR(6)),6))
    FROM @Support;

    INSERT Users (Username,FullName,Email,NormalizedEmail,PhoneNumber,NormalizedPhone,DateOfBirth,IdentityNumberEncrypted,IdentityHash,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
    SELECT a.Username,a.FullName,a.Email,UPPER(a.Email),a.Phone,a.Phone,a.Dob,
           CONVERT(VARBINARY(512),a.IdentityNo),HASHBYTES('SHA2_256',a.IdentityNo),
           @PasswordHash,a.[Role],'Active',@Now,@Now
    FROM @Accounts a
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username=a.Username OR u.Email=a.Email);

    INSERT OwnerProfiles (OwnerId,CreatedAt,UpdatedAt)
    SELECT UserId,@Now,@Now FROM Users u
    WHERE u.Username LIKE 'summer26_owner%'
      AND NOT EXISTS (SELECT 1 FROM OwnerProfiles p WHERE p.OwnerId=u.UserId);

    INSERT JockeyProfiles (JockeyId,LicenseCertificate,ExperienceYears,SelfDeclaredWeight,BloodType,HealthStatus,[Status],CreatedAt,UpdatedAt)
    SELECT UserId,CONCAT(Username,'.pdf'),6,54.00,'O+','Good','Active',@Now,@Now FROM Users u
    WHERE u.Username LIKE 'summer26_jockey%'
      AND NOT EXISTS (SELECT 1 FROM JockeyProfiles p WHERE p.JockeyId=u.UserId);

    INSERT RefereeProfiles (RefereeId,CertificationLevel,[Status],CreatedAt,UpdatedAt)
    SELECT UserId,N'Cấp quốc gia','Active',@Now,@Now FROM Users u
    WHERE u.Username LIKE 'summer26_referee%' AND NOT EXISTS (SELECT 1 FROM RefereeProfiles p WHERE p.RefereeId=u.UserId);

    INSERT DoctorProfiles (DoctorId,MedicalLicenseNumber,[Status],CreatedAt,UpdatedAt)
    SELECT UserId,CONCAT(Username,'.pdf'),'Active',@Now,@Now FROM Users u
    WHERE u.Username LIKE 'summer26_doctor%' AND NOT EXISTS (SELECT 1 FROM DoctorProfiles p WHERE p.DoctorId=u.UserId);

    INSERT Certificates (UserId,CertificateType,FileName,FilePath,ContentType,FileSizeBytes,UploadedAt)
    SELECT u.UserId,u.[Role],CONCAT(u.Username,'.pdf'),CONCAT('/demo-certificates/',u.Username,'.pdf'),'application/pdf',2048,@Now
    FROM Users u
    WHERE (u.Username LIKE 'summer26_jockey%' OR u.Username LIKE 'summer26_referee%'
           OR u.Username LIKE 'summer26_doctor%' OR u.Username='nguyenan_jockey')
      AND NOT EXISTS (SELECT 1 FROM Certificates c WHERE c.UserId=u.UserId);

    /* ---------------------------------------------- SPECTATOR + VÍ (demo mã vé) */
    IF NOT EXISTS (SELECT 1 FROM Users WHERE Username='summer26_spectator01')
        INSERT Users (Username,FullName,Email,NormalizedEmail,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
        VALUES ('summer26_spectator01',N'Khán giả Đỗ Anh Minh','summer26.spectator01@hrtms.localhost.com',
                'SUMMER26.SPECTATOR01@HRTMS.LOCALHOST.COM',@PasswordHash,'Spectator','Active',@Now,@Now);

    INSERT SpectatorProfiles (SpectatorId,CreatedAt)
    SELECT UserId,@Now FROM Users u WHERE u.Username='summer26_spectator01'
      AND NOT EXISTS (SELECT 1 FROM SpectatorProfiles s WHERE s.SpectatorId=u.UserId);

    INSERT Wallets (SpectatorId,Balance,UpdatedAt)
    SELECT UserId,1000,@Now FROM Users u WHERE u.Username='summer26_spectator01'
      AND NOT EXISTS (SELECT 1 FROM Wallets w WHERE w.SpectatorId=u.UserId);

    /* --------------------------------------------------------- TOURNAMENT 4/2/1 */
    DECLARE @AdminId INT=(SELECT UserId FROM Users WHERE Username='summer26_admin');

    IF NOT EXISTS (SELECT 1 FROM Tournaments WHERE [Name]=N'GIẢI ĐUA NGỰA MÙA HÈ 2026')
    INSERT Tournaments ([Name],[Description],StartDate,EndDate,MaxHorses,AllowedBreed,TrackType,RaceDistance,RaceCategory,
     MinJockeyExperienceYears,PurseAmount,EntryFeeAmount,PreRaceWeightThresholdKg,PostRaceWeightDiffThresholdKg,[Status],
     AdvancementRule,AdvancementCount,CreatedAt,UpdatedAt,CreatedBy)
    VALUES (N'GIẢI ĐUA NGỰA MÙA HÈ 2026',N'Demo 38 pairing, 4 vòng loại, 2 bán kết, 1 chung kết.',
     '2026-09-01T00:00:00','2026-09-30T23:59:59',10,'Thoroughbred','Turf',1600,'Open',3,
     500000000,1000000,2.00,1.00,'Open Registration','TopPerRace',5,@Now,@Now,@AdminId);
    -- Tổng purse 500.000.000 = Vòng loại 50tr×4 (200tr) + Bán kết 75tr×2 (150tr) + Chung kết 150tr.

    DECLARE @TId INT=(SELECT TournamentId FROM Tournaments WHERE [Name]=N'GIẢI ĐUA NGỰA MÙA HÈ 2026');
    -- Giải đã tồn tại từ lần seed trước (AdvancementCount=2) thì nâng lên 5 cho khớp
    -- kịch bản demo 4 race × Top5 = 20 bán kết → 2 race × Top5 = 10 chung kết.
    UPDATE Tournaments SET AdvancementCount=5,UpdatedAt=@Now
    WHERE TournamentId=@TId AND AdvancementRule='TopPerRace' AND AdvancementCount<>5;

    IF EXISTS (SELECT 1 FROM Tournaments WHERE TournamentId=@TId AND (MaxHorses<>10 OR AdvancementRule<>'TopPerRace' OR AdvancementCount<>5))
        THROW 51003,N'Cấu hình tournament hiện có không khớp MaxHorses=10, TopPerRace=5.',1;

    INSERT PrizeDistributions (TournamentId,[Position],Percentage,CreatedAt,UpdatedAt)
    SELECT @TId,v.Pos,v.Pct,@Now,@Now FROM (VALUES (1,50.00),(2,25.00),(3,15.00),(4,7.00),(5,3.00))v(Pos,Pct)
    WHERE NOT EXISTS (SELECT 1 FROM PrizeDistributions p WHERE p.TournamentId=@TId AND p.[Position]=v.Pos);

    INSERT Rounds (TournamentId,[Name],SequenceOrder,ScheduledDate,[Status],UpdatedAt)
    SELECT @TId,v.Name,v.Seq,v.Dt,'Upcoming',@Now
    FROM (VALUES (N'Vòng loại',1,CONVERT(DATETIME2,'2026-09-05T08:00:00')),
                 (N'Bán kết',2,CONVERT(DATETIME2,'2026-09-15T08:00:00')),
                 (N'Chung kết',3,CONVERT(DATETIME2,'2026-09-25T15:00:00')))v(Name,Seq,Dt)
    WHERE NOT EXISTS (SELECT 1 FROM Rounds r WHERE r.TournamentId=@TId AND r.SequenceOrder=v.Seq);

    DECLARE @Q INT=(SELECT RoundId FROM Rounds WHERE TournamentId=@TId AND SequenceOrder=1),
            @S INT=(SELECT RoundId FROM Rounds WHERE TournamentId=@TId AND SequenceOrder=2),
            @F INT=(SELECT RoundId FROM Rounds WHERE TournamentId=@TId AND SequenceOrder=3);
    INSERT Races (RoundId,RaceNumber,ScheduledTime,PurseAmount,[Status],IsPostPositionDrawn,IsPredictionGateClosed,ConfirmationCutoffHours,ProtestDeadlineMinutes,CreatedAt,UpdatedAt)
    SELECT v.RoundId,v.RaceNo,v.Dt,v.Purse,'Upcoming',0,0,24,10,@Now,@Now   -- patch 008: cửa sổ khiếu nại 10 phút
    FROM (VALUES (@Q,1,CONVERT(DATETIME2,'2026-09-05T09:00:00'),50000000),(@Q,2,CONVERT(DATETIME2,'2026-09-05T11:00:00'),50000000),
                 (@Q,3,CONVERT(DATETIME2,'2026-09-06T09:00:00'),50000000),(@Q,4,CONVERT(DATETIME2,'2026-09-06T11:00:00'),50000000),
                 (@S,1,CONVERT(DATETIME2,'2026-09-15T09:00:00'),75000000),(@S,2,CONVERT(DATETIME2,'2026-09-15T11:00:00'),75000000),
                 (@F,1,CONVERT(DATETIME2,'2026-09-25T15:00:00'),150000000))v(RoundId,RaceNo,Dt,Purse)
    WHERE NOT EXISTS (SELECT 1 FROM Races r WHERE r.RoundId=v.RoundId AND r.RaceNumber=v.RaceNo);

    /* -------------------------------------- TICKET REWARD CODES (patch 008 — plaintext)
       BR-63 / REQ-F-PRD.5: admin xem lại được qua GET /api/admin/ticket-codes.
       TKT-DEMO00000005 để Expired làm case demo mã hết hạn. */
    IF NOT EXISTS (SELECT 1 FROM TicketRewardCodes WHERE Code='TKT-DEMO00000001')
        INSERT TicketRewardCodes (Code,PointAmount,[Status],ExpiresAt,CreatedAt)
        VALUES
            ('TKT-DEMO00000001',200,'Active', DATEADD(DAY,365,@Now),@Now),
            ('TKT-DEMO00000002',200,'Active', DATEADD(DAY,365,@Now),@Now),
            ('TKT-DEMO00000003',500,'Active', DATEADD(DAY,365,@Now),@Now),
            ('TKT-DEMO00000004',500,'Active', DATEADD(DAY,365,@Now),@Now),
            ('TKT-DEMO00000005',200,'Expired',DATEADD(DAY,-1,@Now),@Now);


    /* =========================================================================
       GIẢI PHỤ SONG SONG — "GIẢI GIAO HỮU THÁNG 9-2026"
       Trùng thời gian với giải chính (05–25/09/2026) để minh họa vận hành
       NHIỀU GIẢI CÙNG LÚC. 1 round + 1 race Upcoming, MaxHorses=10.
       **0 PAIRING BAN ĐẦU** — chỉ dựng account/ngựa/roster `friendly26_*` ở
       trạng thái sẵn sàng ghép cặp; việc ghép cặp do UI (cặp chính) và seed2
       (9 cặp hỗ trợ) đảm nhiệm.
       Account riêng (friendly26_*) — không đụng 38 pairing của giải chính.
       Chỉ 1 race ⇒ dùng làm kịch bản demo NGẮN: chạy trọn vòng đời một cuộc
       đua mà không phải đi hết 7 race của giải chính. Bổ sung 9 pairing cho
       đủ 10 bằng `src\demo\seed2\01_friendly_support_pairings.sql`.
       ========================================================================= */
    DECLARE @FrAcc TABLE (N INT PRIMARY KEY, OwnerName NVARCHAR(100), JockeyName NVARCHAR(100), HorseName NVARCHAR(100), HorseColor NVARCHAR(50));
    INSERT @FrAcc VALUES
    (1,N'Cao Thái Bình',N'Mai Văn Lâm',N'Gió Biển',N'Xám khói'),
    (2,N'Lý Thu Hằng',N'Chu Đức Toản',N'Sóng Thần',N'Nâu trầm');

    INSERT Users (Username,FullName,Email,NormalizedEmail,PhoneNumber,NormalizedPhone,DateOfBirth,IdentityNumberEncrypted,IdentityHash,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
    SELECT v.Username,v.FullName,v.Email,UPPER(v.Email),v.Phone,v.Phone,v.Dob,
           CONVERT(VARBINARY(512),v.IdNo),HASHBYTES('SHA2_256',v.IdNo),@PasswordHash,v.[Role],'Active',@Now,@Now
    FROM (
        SELECT CONCAT('friendly26_owner0',N) Username,OwnerName FullName,
               CONCAT('friendly26.owner0',N,'@hrtms.localhost.com') Email,'Owner' [Role],
               CONCAT('0947',RIGHT('000000'+CAST(N AS VARCHAR),6)) Phone,CAST('1986-02-02' AS DATE) Dob,CONCAT('001086',RIGHT('000000'+CAST(N AS VARCHAR),6)) IdNo
        FROM @FrAcc
        UNION ALL
        SELECT CONCAT('friendly26_jockey0',N),JockeyName,CONCAT('friendly26.jockey0',N,'@hrtms.localhost.com'),'Jockey',
               CONCAT('0957',RIGHT('000000'+CAST(N AS VARCHAR),6)),'1996-03-03',CONCAT('079096',RIGHT('000000'+CAST(N AS VARCHAR),6))
        FROM @FrAcc
    ) v
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username=v.Username OR u.Email=v.Email);

    INSERT OwnerProfiles (OwnerId,CreatedAt,UpdatedAt)
    SELECT UserId,@Now,@Now FROM Users u WHERE u.Username LIKE 'friendly26_owner%'
      AND NOT EXISTS (SELECT 1 FROM OwnerProfiles p WHERE p.OwnerId=u.UserId);
    INSERT JockeyProfiles (JockeyId,LicenseCertificate,ExperienceYears,SelfDeclaredWeight,BloodType,HealthStatus,[Status],CreatedAt,UpdatedAt)
    SELECT UserId,CONCAT(Username,'.pdf'),5,54.50,'A+','Good','Active',@Now,@Now FROM Users u
    WHERE u.Username LIKE 'friendly26_jockey%'
      AND NOT EXISTS (SELECT 1 FROM JockeyProfiles p WHERE p.JockeyId=u.UserId);

    IF NOT EXISTS (SELECT 1 FROM Tournaments WHERE [Name]=N'GIẢI GIAO HỮU THÁNG 9-2026')
    BEGIN
        INSERT Tournaments ([Name],[Description],StartDate,EndDate,MaxHorses,AllowedBreed,TrackType,RaceDistance,RaceCategory,
         MinJockeyExperienceYears,PurseAmount,EntryFeeAmount,PreRaceWeightThresholdKg,PostRaceWeightDiffThresholdKg,[Status],
         AdvancementRule,AdvancementCount,CreatedAt,UpdatedAt,CreatedBy)
        VALUES (N'GIẢI GIAO HỮU THÁNG 9-2026',N'Giải giao hữu 1 cuộc đua duy nhất, chạy song song với Giải Mùa Hè 2026 — demo nhanh trọn vòng đời một race.',
         '2026-09-05T00:00:00','2026-09-25T23:59:59',10,'Thoroughbred','Turf',1400,'Open',2,
         30000000,500000,2.00,1.00,'Open Registration','TopPerRace',2,@Now,@Now,@AdminId);

        DECLARE @FrTId INT = SCOPE_IDENTITY();

        INSERT PrizeDistributions (TournamentId,[Position],Percentage,CreatedAt,UpdatedAt)
        SELECT @FrTId,v.Pos,v.Pct,@Now,@Now FROM (VALUES (1,50.00),(2,30.00),(3,20.00))v(Pos,Pct);

        INSERT Rounds (TournamentId,[Name],SequenceOrder,ScheduledDate,[Status],UpdatedAt)
        VALUES (@FrTId,N'Vòng đấu chính',1,'2026-09-10T08:00:00','Upcoming',@Now);
        DECLARE @FrRound INT = SCOPE_IDENTITY();

        -- MỘT race duy nhất; purse race = toàn bộ purse giải (30tr) để tổng
        -- purse các race không vượt Tournaments.PurseAmount (guard TournamentService).
        INSERT Races (RoundId,RaceNumber,ScheduledTime,PurseAmount,[Status],IsPostPositionDrawn,IsPredictionGateClosed,ConfirmationCutoffHours,ProtestDeadlineMinutes,CreatedAt,UpdatedAt)
        VALUES (@FrRound,1,'2026-09-10T09:00:00',30000000,'Upcoming',0,0,24,10,@Now,@Now);

        INSERT TournamentParticipants (TournamentId,UserId,[Role],[Status],ScreeningStatus,RegisteredAt,ApprovedBy,ApprovedAt)
        SELECT @FrTId,u.UserId,u.[Role],'Approved','AutoEligible',@Now,@AdminId,@Now
        FROM Users u WHERE u.Username LIKE 'friendly26_%';

        INSERT Horses (OwnerId,[Name],BirthYear,Gender,Color,Pedigree,Weight,IdentifyingMarks,Breed,VaccinationRecordRef,DopingTestDate,DopingTestResult,LegalConsentAccepted,[Status],ScreeningStatus,AdminApprovalStatus,CreatedAt,UpdatedAt)
        SELECT u.UserId,a.HorseName,2021,'Male',a.HorseColor,N'Dòng giống thuần chủng đã xác minh',470.00,CONCAT(N'Dấu nhận dạng giao hữu số ',a.N),'Thoroughbred',
               CONCAT('VAC-F26-',a.N),'2026-08-01','Clean',1,'Active','AutoEligible','Approved',@Now,@Now
        FROM @FrAcc a JOIN Users u ON u.Username=CONCAT('friendly26_owner0',a.N)
        WHERE NOT EXISTS (SELECT 1 FROM Horses x WHERE x.OwnerId=u.UserId AND x.[Name]=a.HorseName);

        INSERT HorseTournamentEntries (HorseId,TournamentId,OwnerId,[Status],ScreeningStatus,AdminApprovalStatus,CreatedAt,UpdatedAt)
        SELECT h.HorseId,@FrTId,h.OwnerId,'Enrolled','AutoEligible','Approved',@Now,@Now
        FROM Horses h JOIN Users u ON u.UserId=h.OwnerId AND u.Username LIKE 'friendly26_owner%';

        -- KHÔNG seed Pairing cho giải giao hữu: giải bắt đầu với 0 pairing.
        -- Ngựa/nài/roster đã sẵn sàng để GHÉP CẶP bằng UI hoặc bằng seed2.
        -- Pairing chính do 2 tài khoản nguyenan159246+* tạo qua UI; 9 cặp hỗ trợ
        -- do `src\demo\seed2\01_friendly_support_pairings.sql` tạo.
    END;

    /* Nâng cấp DB đã seed bản cũ (MaxHorses=6, 2 race) sang cấu hình 1 race.
       Chỉ hạ race 2 khi nó CHƯA có RaceEntry nào — có dữ liệu thật thì dừng,
       không tự xóa. */
    DECLARE @FrTIdFix INT=(SELECT TournamentId FROM Tournaments WHERE [Name]=N'GIẢI GIAO HỮU THÁNG 9-2026');
    IF @FrTIdFix IS NOT NULL
    BEGIN
        UPDATE Tournaments SET MaxHorses=10,UpdatedAt=@Now
        WHERE TournamentId=@FrTIdFix AND MaxHorses<10;

        DECLARE @FrRace2 INT=(SELECT r.RaceId FROM Races r JOIN Rounds rd ON rd.RoundId=r.RoundId
                              WHERE rd.TournamentId=@FrTIdFix AND r.RaceNumber=2);
        IF @FrRace2 IS NOT NULL
        BEGIN
            -- Chỉ xóa khi race 2 hoàn toàn TRỐNG. Kiểm đủ MỌI bảng con có FK tới
            -- Races (RaceEntries, Predictions, RaceReports, Protests) — có bất kỳ
            -- dữ liệu thật nào thì DỪNG, không tự xóa.
            IF EXISTS (SELECT 1 FROM RaceEntries WHERE RaceId=@FrRace2)
            OR EXISTS (SELECT 1 FROM Predictions WHERE RaceId=@FrRace2)
            OR EXISTS (SELECT 1 FROM RaceReports WHERE RaceId=@FrRace2)
            OR EXISTS (SELECT 1 FROM Protests    WHERE RaceId=@FrRace2)
                THROW 51004,N'Giải giao hữu cần còn 1 race nhưng race 2 đã có dữ liệu (entry/prediction/biên bản/khiếu nại) — xử lý tay trước khi seed lại.',1;
            DELETE FROM RefereeAssignments WHERE RaceId=@FrRace2;
            DELETE FROM DoctorAssignments  WHERE RaceId=@FrRace2;
            DELETE FROM Races WHERE RaceId=@FrRace2;
        END;

        UPDATE r SET PurseAmount=30000000,UpdatedAt=@Now
        FROM Races r JOIN Rounds rd ON rd.RoundId=r.RoundId
        WHERE rd.TournamentId=@FrTIdFix AND r.RaceNumber=1 AND r.PurseAmount<30000000;

        -- Giải giao hữu phải bắt đầu với 0 pairing. DB seed bản cũ có 2 pairing
        -- friendly26_* → gỡ, nhưng CHỈ khi chưa được allocate vào race nào.
        IF EXISTS (SELECT 1 FROM Pairings p WHERE p.TournamentId=@FrTIdFix)
        BEGIN
            IF EXISTS (SELECT 1 FROM RaceEntries e JOIN Pairings p ON p.PairingId=e.PairingId
                       WHERE p.TournamentId=@FrTIdFix)
                THROW 51005,N'Giải giao hữu cần 0 pairing ban đầu nhưng đã có pairing được allocate vào race — xử lý tay trước khi seed lại.',1;
            DELETE FROM Pairings WHERE TournamentId=@FrTIdFix;
        END;
    END;

    /* =========================================================================
       GIẢI ĐÃ KẾT THÚC — "GIẢI ĐUA NGỰA MÙA XUÂN 2026" (xem lại lịch sử)
       01–31/03/2026, Status='Completed'. 2 round: Vòng loại (2 race) + Chung kết
       (1 race) — tất cả Official. Đầy đủ: 8 owner/jockey/horse, roster, pairing,
       entry (fee Paid, cân trước/sau, identity, clinical), kết quả về đích,
       advancement, phân công trọng tài/bác sĩ, biên bản đã khóa, payout đã trả
       (Owner 80% / Jockey 20% theo cơ cấu 50/30/20), thông báo lịch sử.
       Mốc thời gian dùng tháng 2–3/2026 để lịch sử nhất quán.
       ========================================================================= */
    IF NOT EXISTS (SELECT 1 FROM Tournaments WHERE [Name]=N'GIẢI ĐUA NGỰA MÙA XUÂN 2026')
    BEGIN
        DECLARE @Sp TABLE (N INT PRIMARY KEY, OwnerName NVARCHAR(100), JockeyName NVARCHAR(100), HorseName NVARCHAR(100), HorseColor NVARCHAR(50));
        INSERT @Sp VALUES
        (1,N'Hồ Văn Tùng',N'Kiều Minh Đạt',N'Xuân Phong',N'Hạt dẻ'),
        (2,N'La Thị Nhung',N'Ông Quốc Bảo',N'Mai Vàng',N'Vàng nâu'),
        (3,N'Thái Đức Long',N'Ninh Hữu Tài',N'Đào Hồng',N'Nâu hồng'),
        (4,N'Tiêu Ngọc Bích',N'Ứng Văn Sang',N'Lộc Xuân',N'Xám bạc'),
        (5,N'Quách Hải Nam',N'Từ Minh Nhật',N'Én Nhỏ',N'Đen tuyền'),
        (6,N'Ma Thị Cúc',N'Hà Quang Vinh',N'Nắng Mới',N'Nâu sáng'),
        (7,N'Ưng Đình Phú',N'Cổ Thành Danh',N'Chồi Biếc',N'Xám xanh'),
        (8,N'Giang Thu Thảo',N'Bạch Công Hậu',N'Mưa Xuân',N'Nâu đỏ');

        DECLARE @T0 DATETIME2 = '2026-02-01T08:00:00'; -- mốc tạo dữ liệu lịch sử

        INSERT Users (Username,FullName,Email,NormalizedEmail,PhoneNumber,NormalizedPhone,DateOfBirth,IdentityNumberEncrypted,IdentityHash,PasswordHash,[Role],[Status],CreatedAt,UpdatedAt)
        SELECT v.Username,v.FullName,v.Email,UPPER(v.Email),v.Phone,v.Phone,v.Dob,
               CONVERT(VARBINARY(512),v.IdNo),HASHBYTES('SHA2_256',v.IdNo),@PasswordHash,v.[Role],'Active',@T0,@T0
        FROM (
            SELECT CONCAT('spring26_owner0',N) Username,OwnerName FullName,
                   CONCAT('spring26.owner0',N,'@hrtms.localhost.com') Email,'Owner' [Role],
                   CONCAT('0967',RIGHT('000000'+CAST(N AS VARCHAR),6)) Phone,CAST('1985-04-04' AS DATE) Dob,CONCAT('001085',RIGHT('000000'+CAST(N AS VARCHAR),6)) IdNo
            FROM @Sp
            UNION ALL
            SELECT CONCAT('spring26_jockey0',N),JockeyName,CONCAT('spring26.jockey0',N,'@hrtms.localhost.com'),'Jockey',
                   CONCAT('0977',RIGHT('000000'+CAST(N AS VARCHAR),6)),'1995-05-05',CONCAT('079095',RIGHT('000000'+CAST(N AS VARCHAR),6))
            FROM @Sp
        ) v
        WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username=v.Username OR u.Email=v.Email);

        INSERT OwnerProfiles (OwnerId,CreatedAt,UpdatedAt)
        SELECT UserId,@T0,@T0 FROM Users u WHERE u.Username LIKE 'spring26_owner%'
          AND NOT EXISTS (SELECT 1 FROM OwnerProfiles p WHERE p.OwnerId=u.UserId);
        INSERT JockeyProfiles (JockeyId,LicenseCertificate,ExperienceYears,SelfDeclaredWeight,BloodType,HealthStatus,[Status],CreatedAt,UpdatedAt)
        SELECT UserId,CONCAT(Username,'.pdf'),7,53.00,'B+','Good','Active',@T0,@T0 FROM Users u
        WHERE u.Username LIKE 'spring26_jockey%'
          AND NOT EXISTS (SELECT 1 FROM JockeyProfiles p WHERE p.JockeyId=u.UserId);

        INSERT Tournaments ([Name],[Description],StartDate,EndDate,MaxHorses,AllowedBreed,TrackType,RaceDistance,RaceCategory,
         MinJockeyExperienceYears,PurseAmount,EntryFeeAmount,PreRaceWeightThresholdKg,PostRaceWeightDiffThresholdKg,[Status],
         AdvancementRule,AdvancementCount,CreatedAt,UpdatedAt,CreatedBy)
        VALUES (N'GIẢI ĐUA NGỰA MÙA XUÂN 2026',N'Giải đã kết thúc — dữ liệu lịch sử đầy đủ để xem lại kết quả, tiền thưởng và biên bản.',
         '2026-03-01T00:00:00','2026-03-31T23:59:59',6,'Thoroughbred','Turf',1400,'Open',2,
         60000000,500000,2.00,1.00,'Completed','TopPerRace',2,@T0,'2026-03-25T12:00:00',@AdminId);
        DECLARE @SpTId INT = SCOPE_IDENTITY();

        INSERT PrizeDistributions (TournamentId,[Position],Percentage,CreatedAt,UpdatedAt)
        SELECT @SpTId,v.Pos,v.Pct,@T0,@T0 FROM (VALUES (1,50.00),(2,30.00),(3,20.00))v(Pos,Pct);

        INSERT Rounds (TournamentId,[Name],SequenceOrder,ScheduledDate,[Status],UpdatedAt)
        VALUES (@SpTId,N'Vòng loại',1,'2026-03-08T08:00:00','Completed','2026-03-08T18:00:00'),
               (@SpTId,N'Chung kết',2,'2026-03-22T15:00:00','Completed','2026-03-22T18:00:00');
        DECLARE @SpQ INT=(SELECT RoundId FROM Rounds WHERE TournamentId=@SpTId AND SequenceOrder=1);
        DECLARE @SpF INT=(SELECT RoundId FROM Rounds WHERE TournamentId=@SpTId AND SequenceOrder=2);

        -- Race lịch sử GIỮ ProtestDeadlineMinutes=120: chúng đã diễn ra dưới quy định cũ.
        -- Patch 008 chỉ đổi DEFAULT cho race MỚI (10 phút), không viết lại lịch sử.
        INSERT Races (RoundId,RaceNumber,ScheduledTime,ActualStartTime,PurseAmount,[Status],IsPostPositionDrawn,IsPredictionGateClosed,ConfirmationCutoffHours,ProtestDeadlineMinutes,CreatedAt,UpdatedAt)
        VALUES (@SpQ,1,'2026-03-08T09:00:00','2026-03-08T09:02:00',15000000,'Official',1,1,24,120,@T0,'2026-03-08T11:00:00'),
               (@SpQ,2,'2026-03-08T15:00:00','2026-03-08T15:03:00',15000000,'Official',1,1,24,120,@T0,'2026-03-08T17:00:00'),
               (@SpF,1,'2026-03-22T15:00:00','2026-03-22T15:01:00',30000000,'Official',1,1,24,120,@T0,'2026-03-22T17:00:00');

        INSERT TournamentParticipants (TournamentId,UserId,[Role],[Status],ScreeningStatus,RegisteredAt,ApprovedBy,ApprovedAt)
        SELECT @SpTId,u.UserId,u.[Role],'Approved','AutoEligible',@T0,@AdminId,@T0
        FROM Users u
        WHERE u.Username LIKE 'spring26_%'
           OR u.Username IN ('summer26_referee01','summer26_referee02','summer26_doctor01','summer26_doctor02');

        INSERT Horses (OwnerId,[Name],BirthYear,Gender,Color,Pedigree,Weight,IdentifyingMarks,Breed,VaccinationRecordRef,DopingTestDate,DopingTestResult,LegalConsentAccepted,[Status],ScreeningStatus,AdminApprovalStatus,CreatedAt,UpdatedAt)
        SELECT u.UserId,a.HorseName,2020,'Male',a.HorseColor,N'Dòng giống thuần chủng đã xác minh',475.00,CONCAT(N'Dấu nhận dạng mùa xuân số ',a.N),'Thoroughbred',
               CONCAT('VAC-SP26-',a.N),'2026-02-10','Clean',1,'Active','AutoEligible','Approved',@T0,@T0
        FROM @Sp a JOIN Users u ON u.Username=CONCAT('spring26_owner0',a.N)
        WHERE NOT EXISTS (SELECT 1 FROM Horses x WHERE x.OwnerId=u.UserId AND x.[Name]=a.HorseName);

        INSERT HorseTournamentEntries (HorseId,TournamentId,OwnerId,[Status],ScreeningStatus,AdminApprovalStatus,CreatedAt,UpdatedAt)
        SELECT h.HorseId,@SpTId,h.OwnerId,'Enrolled','AutoEligible','Approved',@T0,@T0
        FROM Horses h JOIN Users u ON u.UserId=h.OwnerId AND u.Username LIKE 'spring26_owner%';

        INSERT Pairings (TournamentId,HorseId,JockeyId,[Status],RequestMessage,ResponseReason,CreatedAt,UpdatedAt)
        SELECT @SpTId,h.HorseId,j.UserId,'Confirmed',N'Ghép cặp Giải Mùa Xuân 2026.',N'Chủ ngựa đã xác nhận.',@T0,@T0
        FROM @Sp a
        JOIN Users o ON o.Username=CONCAT('spring26_owner0',a.N)
        JOIN Horses h ON h.OwnerId=o.UserId AND h.[Name]=a.HorseName
        JOIN Users j ON j.Username=CONCAT('spring26_jockey0',a.N);

        /* Phân công trọng tài/bác sĩ (dùng lại staff giải Mùa Hè — 1 người phục vụ nhiều giải) */
        DECLARE @Ref1 INT=(SELECT UserId FROM Users WHERE Username='summer26_referee01');
        DECLARE @Ref2 INT=(SELECT UserId FROM Users WHERE Username='summer26_referee02');
        DECLARE @Doc1 INT=(SELECT UserId FROM Users WHERE Username='summer26_doctor01');
        DECLARE @Doc2 INT=(SELECT UserId FROM Users WHERE Username='summer26_doctor02');

        INSERT RefereeAssignments (RaceId,RefereeId,[Role],AssignedAt)
        SELECT r.RaceId,CASE WHEN r.RaceNumber=2 AND r.RoundId=@SpQ THEN @Ref2 ELSE @Ref1 END,'Lead Referee','2026-03-01T08:00:00'
        FROM Races r WHERE r.RoundId IN (@SpQ,@SpF);
        INSERT DoctorAssignments (RaceId,DoctorId,AssignedAt)
        SELECT r.RaceId,CASE WHEN r.RaceNumber=2 AND r.RoundId=@SpQ THEN @Doc2 ELSE @Doc1 END,'2026-03-01T08:00:00'
        FROM Races r WHERE r.RoundId IN (@SpQ,@SpF);

        /* Kịch bản kết quả:
           Vòng loại race 1: cặp 1-4 về 1,2,3,4  → cặp 1,2 Qualified
           Vòng loại race 2: cặp 5-8 về 1,2,3,4  → cặp 5,6 Qualified
           Chung kết       : 5 (Nhất), 1 (Nhì), 6 (Ba), 2 (Tư) */
        DECLARE @Plan TABLE (RoundId INT, RaceNo INT, PairIdx INT, Pos INT, Ft DECIMAL(8,3), Adv VARCHAR(20) NULL, AdvRank INT NULL);
        INSERT @Plan VALUES
        (@SpQ,1,1,1, 84.512,'Qualified',1),(@SpQ,1,2,2, 85.104,'Qualified',3),(@SpQ,1,3,3, 86.230,'Eliminated',NULL),(@SpQ,1,4,4, 87.415,'Eliminated',NULL),
        (@SpQ,2,5,1, 84.207,'Qualified',2),(@SpQ,2,6,2, 85.663,'Qualified',4),(@SpQ,2,7,3, 86.884,'Eliminated',NULL),(@SpQ,2,8,4, 88.020,'Eliminated',NULL),
        (@SpF,1,5,1, 83.905,NULL,NULL),(@SpF,1,1,2, 84.377,NULL,NULL),(@SpF,1,6,3, 85.128,NULL,NULL),(@SpF,1,2,4, 86.049,NULL,NULL);

        INSERT RaceEntries (RaceId,PairingId,PostPosition,[Status],
            PreRaceJockeyWeight,PreRaceWeightByDoctorId,
            HorseIdentityCheckStatus,HorseIdentityCheckedByDoctorId,HorseIdentityCheckedAt,
            ClinicalStatus,ClinicalCheckedByDoctorId,ClinicalCheckedAt,
            PostRaceJockeyWeight,PostRaceWeightByDoctorId,
            FinishPosition,FinishTime,AdvancementStatus,AdvancementRank,
            EntryFeeStatus,EntryFeeConfirmedBy,EntryFeeConfirmedAt,IsWithdrawn,CreatedAt,UpdatedAt)
        SELECT r.RaceId,pg.PairingId,pl.Pos,'Confirmed',
            53.00 + pl.PairIdx*0.10, CASE WHEN pl.RaceNo=2 AND pl.RoundId=@SpQ THEN @Doc2 ELSE @Doc1 END,
            'Matched', CASE WHEN pl.RaceNo=2 AND pl.RoundId=@SpQ THEN @Doc2 ELSE @Doc1 END, DATEADD(HOUR,-2,r.ScheduledTime),
            'Fit', CASE WHEN pl.RaceNo=2 AND pl.RoundId=@SpQ THEN @Doc2 ELSE @Doc1 END, DATEADD(HOUR,-2,r.ScheduledTime),
            53.20 + pl.PairIdx*0.10, CASE WHEN pl.RaceNo=2 AND pl.RoundId=@SpQ THEN @Doc2 ELSE @Doc1 END,
            pl.Pos, pl.Ft, pl.Adv, pl.AdvRank,
            'Paid', @AdminId, DATEADD(DAY,-3,r.ScheduledTime), 0, @T0, DATEADD(HOUR,2,r.ScheduledTime)
        FROM @Plan pl
        JOIN Races r ON r.RoundId=pl.RoundId AND r.RaceNumber=pl.RaceNo
        JOIN @Sp a ON a.N=pl.PairIdx
        JOIN Users o ON o.Username=CONCAT('spring26_owner0',a.N)
        JOIN Horses h ON h.OwnerId=o.UserId AND h.[Name]=a.HorseName
        JOIN Pairings pg ON pg.TournamentId=@SpTId AND pg.HorseId=h.HorseId;

        /* Biên bản trận đua — đã khóa */
        -- ProtestWindowClosedAt (patch 009): trọng tài đã đóng sớm cửa sổ khiếu nại
        -- (30 phút sau khi nộp biên bản, trước hạn 120 phút) rồi mới khóa biên bản.
        INSERT RaceReports (RaceId,LeadRefereeId,Notes,IsLocked,SubmittedAt,LockedAt,ProtestWindowClosedAt)
        SELECT r.RaceId,CASE WHEN r.RaceNumber=2 AND r.RoundId=@SpQ THEN @Ref2 ELSE @Ref1 END,
               N'Trận đua diễn ra đúng lịch, không có khiếu nại.',1,
               DATEADD(HOUR,1,r.ScheduledTime),DATEADD(HOUR,3,r.ScheduledTime),
               DATEADD(MINUTE,90,r.ScheduledTime)
        FROM Races r WHERE r.RoundId IN (@SpQ,@SpF);

        /* Payout đã trả: mỗi race Top 3 theo 50/30/20; chia Owner 80% / Jockey 20% */
        INSERT PursePayouts (RaceEntryId,RecipientUserId,[Role],CalculatedAmount,PayoutStatus,PaidAt,UpdatedByAdminId,UpdatedAt)
        SELECT e.RaceEntryId,
               CASE part.[Role] WHEN 'Owner' THEN h.OwnerId ELSE pg.JockeyId END,
               part.[Role],
               ROUND(r.PurseAmount * pd.Percentage/100.0 * CASE part.[Role] WHEN 'Owner' THEN 0.8 ELSE 0.2 END, 0),
               'Paid', DATEADD(DAY,1,r.ScheduledTime), @AdminId, DATEADD(DAY,1,r.ScheduledTime)
        FROM RaceEntries e
        JOIN Races r ON r.RaceId=e.RaceId AND r.RoundId IN (@SpQ,@SpF)
        JOIN PrizeDistributions pd ON pd.TournamentId=@SpTId AND pd.[Position]=e.FinishPosition
        JOIN Pairings pg ON pg.PairingId=e.PairingId
        JOIN Horses h ON h.HorseId=pg.HorseId
        CROSS JOIN (VALUES ('Owner'),('Jockey')) part([Role])
        WHERE e.FinishPosition<=3;

        /* Thông báo lịch sử (in-app, đã đọc) cho 3 chủ ngựa đạt giải chung kết */
        INSERT Notifications (RecipientId,Title,[Message],[Type],IsRead,RelatedEntityType,RelatedEntityId,SentAt,ReadAt)
        SELECT h.OwnerId,
               N'Kết quả chung kết Giải Mùa Xuân 2026',
               CONCAT(N'Ngựa ',h.[Name],N' về hạng ',e.FinishPosition,N' tại chung kết. Tiền thưởng đã được chi trả.'),
               'In-app',1,'Race',e.RaceId,'2026-03-22T18:00:00','2026-03-23T08:00:00'
        FROM RaceEntries e
        JOIN Races r ON r.RaceId=e.RaceId AND r.RoundId=@SpF
        JOIN Pairings pg ON pg.PairingId=e.PairingId
        JOIN Horses h ON h.HorseId=pg.HorseId
        WHERE e.FinishPosition<=3;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ------------------------------------------------------------------ KIỂM CHỨNG */
SELECT [Role],COUNT(*) AS SoTaiKhoan
FROM Users
WHERE Username LIKE 'summer26_%' OR Username IN ('nguyenan_owner','nguyenan_jockey')
GROUP BY [Role] ORDER BY [Role];

SELECT t.TournamentId,t.[Name],t.[Status],t.StartDate,t.EndDate,t.MaxHorses,t.AdvancementRule,t.AdvancementCount,
 (SELECT COUNT(*) FROM Rounds rd WHERE rd.TournamentId=t.TournamentId) SoRound,
 (SELECT COUNT(*) FROM Races r JOIN Rounds rd ON rd.RoundId=r.RoundId WHERE rd.TournamentId=t.TournamentId) SoRace,
 (SELECT COUNT(*) FROM Pairings p WHERE p.TournamentId=t.TournamentId) SoPairing
FROM Tournaments t
WHERE t.[Name] IN (N'GIẢI ĐUA NGỰA MÙA HÈ 2026',N'GIẢI GIAO HỮU THÁNG 9-2026',N'GIẢI ĐUA NGỰA MÙA XUÂN 2026')
ORDER BY t.StartDate;

-- Giải đã kết thúc: đối chiếu tổng payout mỗi race = PurseAmount
SELECT rd.[Name] AS Vong,r.RaceNumber,r.PurseAmount,SUM(pp.CalculatedAmount) AS TongDaTra
FROM PursePayouts pp
JOIN RaceEntries e ON e.RaceEntryId=pp.RaceEntryId
JOIN Races r ON r.RaceId=e.RaceId
JOIN Rounds rd ON rd.RoundId=r.RoundId
JOIN Tournaments t ON t.TournamentId=rd.TournamentId AND t.[Name]=N'GIẢI ĐUA NGỰA MÙA XUÂN 2026'
GROUP BY rd.SequenceOrder,rd.[Name],r.RaceNumber,r.PurseAmount ORDER BY rd.SequenceOrder,r.RaceNumber;

SELECT Code,PointAmount,[Status],ExpiresAt FROM TicketRewardCodes WHERE Code LIKE 'TKT-DEMO%' ORDER BY Code;

SELECT N'Seed hợp nhất hoàn tất: Admin + 2 tài khoản chính + 37 cặp hỗ trợ + staff + tournament 4/2/1 + 5 mã ticket.' AS KetQua;
