/* =============================================================================
   Patch 008 — Store ticket reward codes as plaintext (drop SHA-256 hash)
   -----------------------------------------------------------------------------
   Ticket reward codes were stored as SHA-256 hash (CodeHash VARBINARY(32)) so
   the raw code could never be recovered. This patch replaces that column with a
   plaintext Code VARCHAR(20) so admins can list / re-view generated codes via
   GET /api/admin/ticket-codes.

   SECURITY NOTE: codes are now readable by anyone with DB or admin-API access —
   they behave like plaintext vouchers. Accepted tradeoff for this project.

   Data impact:
     - Existing rows are DELETED. A SHA-256 hash cannot be reversed into the raw
       code, so old rows cannot be migrated to plaintext. Re-seed demo codes with
       seed.sql if needed.

   Idempotent: safe to run more than once.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.TicketRewardCodes', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.TicketRewardCodes', N'Code') IS NULL
BEGIN
    /* Old hashed rows are unrecoverable — remove before swapping the column. */
    DELETE FROM dbo.TicketRewardCodes;

    IF EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.TicketRewardCodes')
                 AND name = N'UQ_TicketRewardCodes_CodeHash')
        ALTER TABLE dbo.TicketRewardCodes DROP CONSTRAINT UQ_TicketRewardCodes_CodeHash;

    IF COL_LENGTH(N'dbo.TicketRewardCodes', N'CodeHash') IS NOT NULL
        ALTER TABLE dbo.TicketRewardCodes DROP COLUMN CodeHash;

    ALTER TABLE dbo.TicketRewardCodes ADD Code VARCHAR(20) NOT NULL;

    ALTER TABLE dbo.TicketRewardCodes
        ADD CONSTRAINT UQ_TicketRewardCodes_Code UNIQUE (Code);
END;
GO

PRINT 'Patch 008 applied: TicketRewardCodes now stores plaintext Code (hash dropped).';
GO
