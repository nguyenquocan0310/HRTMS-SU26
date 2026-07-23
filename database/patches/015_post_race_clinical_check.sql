-- =============================================================================
-- Patch 015: Post-race clinical check (doctor kiểm tra lại ngựa + nài sau trận)
--
-- Bối cảnh: luồng cũ, sau khi Referee submit finish results (Race chuyển
-- Live -> Unofficial), Admin chỉ bị chặn bởi PostRaceWeighInComplete (chỉ có
-- cân nài ngựa sau đua) trước khi Declare Official. Chưa có bước bác sĩ khám
-- lâm sàng lại cho cả ngựa và nài sau khi kết thúc trận.
--
-- Patch này thêm 1 bước bắt buộc: Doctor phải khám lâm sàng sau trận
-- (PostRaceClinicalStatus) cho từng RaceEntry hợp lệ trước khi Admin được
-- Declare Official. Tái dùng đúng pattern của ClinicalStatus (khám tiền trận)
-- — 1 cột duy nhất đại diện chung cho cặp Horse+Jockey (Pairing), khớp với
-- thiết kế hiện có của ClinicalStatus.
--
-- LƯU Ý: mỗi ALTER TABLE nằm trong 1 batch riêng (ngăn cách bằng GO).
-- Nếu gộp ADD COLUMN và ADD CONSTRAINT tham chiếu cột đó chung 1 batch,
-- SQL Server sẽ báo lỗi "Invalid column name" vì cột mới chưa được compile
-- xong khi batch được phân tích (bind) toàn bộ cùng lúc.
-- =============================================================================

ALTER TABLE RaceEntries ADD PostRaceClinicalStatus VARCHAR(20) NULL;
GO

ALTER TABLE RaceEntries ADD PostRaceUnfitReason VARCHAR(255) NULL;
GO

ALTER TABLE RaceEntries ADD PostRaceClinicalCheckedByDoctorId INT NULL;
GO

ALTER TABLE RaceEntries ADD PostRaceClinicalCheckedAt DATETIME2 NULL;
GO

ALTER TABLE RaceEntries
    ADD CONSTRAINT FK_RaceEntries_PostRaceClinicalDoctor
    FOREIGN KEY (PostRaceClinicalCheckedByDoctorId) REFERENCES DoctorProfiles(DoctorId);
GO

ALTER TABLE RaceEntries
    ADD CONSTRAINT CK_RaceEntries_PostRaceClinicalStatus
    CHECK (PostRaceClinicalStatus IS NULL OR PostRaceClinicalStatus IN ('Fit', 'Unfit'));
GO
