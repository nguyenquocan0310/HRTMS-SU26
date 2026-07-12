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
