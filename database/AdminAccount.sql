INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, Status, FailedLoginAttempts, CreatedAt, UpdatedAt)
VALUES (
    'admin',
    'Administrator',
    'admin@hrtms.com',
    '$2b$12$oFG8MH2PjVbGqYRdpmVcjexJMBSRqKXcmyswa1qMJ8sfpouC1e6OK', -- password = "Admin@123"
    'Admin',
    'Active',
    0,
    GETDATE(),
    GETDATE()
);
