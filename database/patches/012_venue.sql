/* =============================================================================
   Patch 012 — Module B/E: Venues (sân đua) + Tournaments.VenueId
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Bảng Venues — sân đua vật lý. Số làn (LaneCount) của sân là TRẦN CỨNG cho
       sức chứa mỗi cuộc đua: không thể xếp nhiều ngựa hơn số cổng xuất phát.
     • Tournaments.VenueId — giải đấu diễn ra ở sân nào.
         NULL được phép ở DB để KHÔNG phá dữ liệu giải cũ (tạo trước patch này).
         Rule "bắt buộc VenueId" được enforce ở TournamentService cho giải
         mới/cập nhật, không ép NOT NULL ở DB.
     • Backfill: mọi giải cũ (VenueId IS NULL) trỏ về sân Phú Thọ.

   Quan hệ với MaxHorses:
     TournamentService bắt MaxHorses <= Venue.LaneCount (error MAX_HORSES_EXCEEDS_LANES).
     KHÔNG đặt CHECK constraint cross-table ở DB vì dữ liệu cũ có thể vi phạm
     (giải cũ MaxHorses > 12 backfill về Phú Thọ 12 làn) — patch sẽ fail.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Bảng Venues
   --------------------------------------------------------------------------- */
IF OBJECT_ID('Venues', 'U') IS NULL
BEGIN
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
        -- 2..24 làn: dưới 2 thì không thành cuộc đua, trên 24 vượt mọi sân thực tế.
        CONSTRAINT CHK_Venues_LaneCount CHECK (LaneCount BETWEEN 2 AND 24)
    );
END
GO

-- Tên sân là duy nhất — chặn Admin tạo trùng sân qua POST /api/admin/venues.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Venues_Name')
    CREATE UNIQUE INDEX UQ_Venues_Name ON Venues ([Name]);
GO

-- GET /api/venues mặc định lọc IsActive = 1.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venues_IsActive')
    CREATE INDEX IX_Venues_IsActive ON Venues (IsActive);
GO

/* ---------------------------------------------------------------------------
   2) Seed 4 sân đua Việt Nam
   Idempotent theo [Name] (UQ_Venues_Name).
   Sóc Sơn để IsActive = 0 làm case "sân chưa hoạt động" cho test/demo.
   --------------------------------------------------------------------------- */
MERGE Venues AS target
USING (VALUES
    (N'Trường đua Phú Thọ',        N'Số 2 Lê Đại Hành, Phường 15, Quận 11', N'TP. Hồ Chí Minh', 'Dirt', 1800, 12, 1),
    (N'Trường đua Đại Nam',        N'Khu du lịch Đại Nam, Hiệp An',         N'Bình Dương',      'Dirt', 1500, 10, 1),
    (N'Trường đua Thiên Mã Madagui', N'Khu du lịch Madagui, Đạ Huoai',      N'Lâm Đồng',        'Turf', 1200,  6, 1),
    (N'Trường đua Sóc Sơn',        N'Xã Tân Minh, Huyện Sóc Sơn',           N'Hà Nội',          'Turf', 2000, 14, 0)
) AS source ([Name], [Address], City, TrackType, TrackLengthMeters, LaneCount, IsActive)
    ON target.[Name] = source.[Name]
WHEN NOT MATCHED BY TARGET THEN
    INSERT ([Name], [Address], City, TrackType, TrackLengthMeters, LaneCount, IsActive)
    VALUES (source.[Name], source.[Address], source.City, source.TrackType,
            source.TrackLengthMeters, source.LaneCount, source.IsActive);
GO

/* ---------------------------------------------------------------------------
   3) Tournaments.VenueId + FK
   NULL cho phép ở DB (dữ liệu cũ); service enforce bắt buộc cho giải mới.
   --------------------------------------------------------------------------- */
IF COL_LENGTH('Tournaments', 'VenueId') IS NULL
    ALTER TABLE Tournaments ADD VenueId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Tournaments_Venue')
    ALTER TABLE Tournaments ADD CONSTRAINT FK_Tournaments_Venue
        FOREIGN KEY (VenueId) REFERENCES Venues(VenueId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tournaments_VenueId')
    CREATE INDEX IX_Tournaments_VenueId ON Tournaments (VenueId) WHERE VenueId IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   4) Backfill giải cũ về sân Phú Thọ
   Chỉ chạm dòng VenueId IS NULL -> chạy lại lần 2 không đổi gì.
   --------------------------------------------------------------------------- */
DECLARE @PhuThoId INT = (SELECT VenueId FROM Venues WHERE [Name] = N'Trường đua Phú Thọ');

IF @PhuThoId IS NOT NULL
    UPDATE Tournaments SET VenueId = @PhuThoId, UpdatedAt = GETUTCDATE()
    WHERE VenueId IS NULL;
GO
