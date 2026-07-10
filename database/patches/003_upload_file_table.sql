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