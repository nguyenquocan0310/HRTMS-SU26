-- =============================================================================
-- SCRIPT ĐỒNG BỘ 30 TÀI KHOẢN TEST CHO CẢ NHÓM (DÙNG TRONG SSMS)
-- Mật khẩu mặc định: 123456
-- Chuỗi băm BCrypt đồng bộ hệ thống: $2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K
-- =============================================================================

USE [HRTMS];
GO

-- 1. DỌN SẠCH DỮ LIỆU TRÊN MÁY ĐỒNG ĐỘI ĐỂ TRÁNH LỖI KHÓA NGOẠI
DELETE FROM VirtualPointsTransactions;
DELETE FROM Predictions;
DELETE FROM Wallets;
DELETE FROM AuditLogs;
DELETE FROM Notifications;
DELETE FROM PursePayouts;
DELETE FROM Violations;
DELETE FROM Protests;
DELETE FROM RaceReports;
DELETE FROM RefereeAssignments;
DELETE FROM DoctorAssignments;
DELETE FROM RaceEntries;
DELETE FROM Pairings;
DELETE FROM Horses;
DELETE FROM Races;
DELETE FROM Rounds;
DELETE FROM PrizeDistributions;
DELETE FROM Tournaments;
DELETE FROM FamilyRelationshipDeclarations;

DELETE FROM SpectatorProfiles;
DELETE FROM DoctorProfiles;
DELETE FROM RefereeProfiles;
DELETE FROM JockeyProfiles;
DELETE FROM OwnerProfiles;
DELETE FROM Users WHERE Role != 'Admin'; -- Chỉ giữ lại các tài khoản Admin cũ
GO

-- 2. BẮT ĐẦU NẠP DỮ LIỆU BẢNG USERS CÓ BẬT IDENTITY
SET IDENTITY_INSERT [dbo].[Users] ON;

-- Nạp luồng Owner (ID: 17 -> 22)
INSERT [dbo].[Users] ([UserId], [Username], [FullName], [Email], [PasswordHash], [Role], [Status]) VALUES 
(17, N'owner_01', N'Nguyễn Văn Owner 1', N'owner_01@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Owner', N'Active'),
(18, N'owner_02', N'Nguyễn Văn Owner 2', N'owner_02@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Owner', N'Active'),
(19, N'owner_03', N'Nguyễn Văn Owner 3', N'owner_03@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Owner', N'Active'),
(20, N'owner_04', N'Nguyễn Văn Owner 4', N'owner_04@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Owner', N'Active'),
(21, N'owner_05', N'Nguyễn Văn Owner 5', N'owner_05@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Owner', N'Active'),
(22, N'owner_06', N'Nguyễn Văn Owner 6', N'owner_06@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Owner', N'Active');

-- Nạp luồng Jockey (ID: 23 -> 28)
INSERT [dbo].[Users] ([UserId], [Username], [FullName], [Email], [PasswordHash], [Role], [Status]) VALUES 
(23, N'jockey_01', N'Nguyễn Văn Jockey 1', N'jockey_01@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Jockey', N'Active'),
(24, N'jockey_02', N'Nguyễn Văn Jockey 2', N'jockey_02@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Jockey', N'Active'),
(25, N'jockey_03', N'Nguyễn Văn Jockey 3', N'jockey_03@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Jockey', N'Active'),
(26, N'jockey_04', N'Nguyễn Văn Jockey 4', N'jockey_04@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Jockey', N'Active'),
(27, N'jockey_05', N'Nguyễn Văn Jockey 5', N'jockey_05@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Jockey', N'Active'),
(28, N'jockey_06', N'Nguyễn Văn Jockey 6', N'jockey_06@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Jockey', N'Active');

-- Nạp luồng Referee (ID: 29 -> 34)
INSERT [dbo].[Users] ([UserId], [Username], [FullName], [Email], [PasswordHash], [Role], [Status]) VALUES 
(29, N'referee_01', N'Nguyễn Văn Referee 1', N'referee_01@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Referee', N'Active'),
(30, N'referee_02', N'Nguyễn Văn Referee 2', N'referee_02@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Referee', N'Active'),
(31, N'referee_03', N'Nguyễn Văn Referee 3', N'referee_03@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Referee', N'Active'),
(32, N'referee_04', N'Nguyễn Văn Referee 4', N'referee_04@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Referee', N'Active'),
(33, N'referee_05', N'Nguyễn Văn Referee 5', N'referee_05@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Referee', N'Active'),
(34, N'referee_06', N'Nguyễn Văn Referee 6', N'referee_06@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Referee', N'Active');

-- Nạp luồng Doctor (ID: 35 -> 40)
INSERT [dbo].[Users] ([UserId], [Username], [FullName], [Email], [PasswordHash], [Role], [Status]) VALUES 
(35, N'doctor_01', N'Nguyễn Văn Doctor 1', N'doctor_01@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Doctor', N'Active'),
(36, N'doctor_02', N'Nguyễn Văn Doctor 2', N'doctor_02@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Doctor', N'Active'),
(37, N'doctor_03', N'Nguyễn Văn Doctor 3', N'doctor_03@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Doctor', N'Active'),
(38, N'doctor_04', N'Nguyễn Văn Doctor 4', N'doctor_04@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Doctor', N'Active'),
(39, N'doctor_05', N'Nguyễn Văn Doctor 5', N'doctor_05@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Doctor', N'Active'),
(40, N'doctor_06', N'Nguyễn Văn Doctor 6', N'doctor_06@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Doctor', N'Active');

-- Nạp luồng Spectator (ID: 41 -> 46)
INSERT [dbo].[Users] ([UserId], [Username], [FullName], [Email], [PasswordHash], [Role], [Status]) VALUES 
(41, N'spectator_01', N'Nguyễn Văn Spectator 1', N'spectator_01@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Spectator', N'Active'),
(42, N'spectator_02', N'Nguyễn Văn Spectator 2', N'spectator_02@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Spectator', N'Active'),
(43, N'spectator_03', N'Nguyễn Văn Spectator 3', N'spectator_03@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Spectator', N'Active'),
(44, N'spectator_04', N'Nguyễn Văn Spectator 4', N'spectator_04@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Spectator', N'Active'),
(45, N'spectator_05', N'Nguyễn Văn Spectator 5', N'spectator_05@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Spectator', N'Active'),
(46, N'spectator_06', N'Nguyễn Văn Spectator 6', N'spectator_06@hrtms.com', N'$2a$12$ehg1N3T1SE8mpVetkuEtY.tutN61tNzAt5rttDNleZkgooBTwZp9K', N'Spectator', N'Active');

SET IDENTITY_INSERT [dbo].[Users] OFF;
GO

-- 3. NẠP DỮ LIỆU ĐỒNG BỘ VÀO CÁC BẢNG PROFILE EXTENSION (KHỚP CHÍNH XÁC ID)

-- Nạp bảng OwnerProfiles
INSERT INTO OwnerProfiles (OwnerId, PhoneNumber, IdentityNumber, CreatedAt, UpdatedAt) VALUES
(17, '0912345001', '001206000001', GETUTCDATE(), GETUTCDATE()),
(18, '0912345002', '001206000002', GETUTCDATE(), GETUTCDATE()),
(19, '0912345003', '001206000003', GETUTCDATE(), GETUTCDATE()),
(20, '0912345004', '001206000004', GETUTCDATE(), GETUTCDATE()),
(21, '0912345005', '001206000005', GETUTCDATE(), GETUTCDATE()),
(22, '0912345006', '001206000006', GETUTCDATE(), GETUTCDATE());

-- Nạp bảng JockeyProfiles
INSERT INTO JockeyProfiles (JockeyId, LicenseCertificate, ExperienceYears, SelfDeclaredWeight, BloodType, HealthStatus, [Status], CreatedAt, UpdatedAt) VALUES
(23, 'LIC-JOCKEY-2026-01', 3, 51.00, 'O', 'Good', 'Active', GETUTCDATE(), GETUTCDATE()),
(24, 'LIC-JOCKEY-2026-02', 4, 52.00, 'O', 'Good', 'Active', GETUTCDATE(), GETUTCDATE()),
(25, 'LIC-JOCKEY-2026-03', 5, 53.00, 'O', 'Good', 'Active', GETUTCDATE(), GETUTCDATE()),
(26, 'LIC-JOCKEY-2026-04', 6, 54.00, 'O', 'Good', 'Active', GETUTCDATE(), GETUTCDATE()),
(27, 'LIC-JOCKEY-2026-05', 7, 55.00, 'O', 'Good', 'Active', GETUTCDATE(), GETUTCDATE()),
(28, 'LIC-JOCKEY-2026-06', 8, 56.00, 'O', 'Good', 'Active', GETUTCDATE(), GETUTCDATE());

-- Nạp bảng RefereeProfiles
INSERT INTO RefereeProfiles (RefereeId, CertificationLevel, [Status], CreatedAt, UpdatedAt) VALUES
(29, 'National Class 1', 'Active', GETUTCDATE(), GETUTCDATE()),
(30, 'National Class 2', 'Active', GETUTCDATE(), GETUTCDATE()),
(31, 'National Class 3', 'Active', GETUTCDATE(), GETUTCDATE()),
(32, 'National Class 4', 'Active', GETUTCDATE(), GETUTCDATE()),
(33, 'National Class 5', 'Active', GETUTCDATE(), GETUTCDATE()),
(34, 'National Class 6', 'Active', GETUTCDATE(), GETUTCDATE());

-- Nạp bảng DoctorProfiles
INSERT INTO DoctorProfiles (DoctorId, MedicalLicenseNumber, [Status], CreatedAt, UpdatedAt) VALUES
(35, 'VET-LIC-2026-01', 'Active', GETUTCDATE(), GETUTCDATE()),
(36, 'VET-LIC-2026-02', 'Active', GETUTCDATE(), GETUTCDATE()),
(37, 'VET-LIC-2026-03', 'Active', GETUTCDATE(), GETUTCDATE()),
(38, 'VET-LIC-2026-04', 'Active', GETUTCDATE(), GETUTCDATE()),
(39, 'VET-LIC-2026-05', 'Active', GETUTCDATE(), GETUTCDATE()),
(40, 'VET-LIC-2026-06', 'Active', GETUTCDATE(), GETUTCDATE());

-- Nạp bảng SpectatorProfiles
INSERT INTO SpectatorProfiles (SpectatorId, CreatedAt) VALUES
(41, GETUTCDATE()),
(42, GETUTCDATE()),
(43, GETUTCDATE()),
(44, GETUTCDATE()),
(45, GETUTCDATE()),
(46, GETUTCDATE());

PRINT '--> HOÀN THÀNH: Đã đồng bộ 30 tài khoản test full các bảng nhánh. Mật khẩu: 123456';
GO