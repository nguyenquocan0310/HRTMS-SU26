/* =============================================================================
   Patch 013 — Module E/N: Entry Fee Payment (nộp & đối chiếu lệ phí)
   -----------------------------------------------------------------------------
   Mục tiêu:
     • Bảng EntryFeePayments — Owner nộp thông tin lệ phí cho MỘT Pairing,
       Admin đối chiếu (verify/reject). Đây là bước thay thế cho việc Owner tự
       bấm "confirm pairing": Pairing chỉ chuyển Confirmed khi payment Verified.
     • Tournaments.PaymentDeadline / RefundDeadline.
     • Mở rộng CHECK constraint sẵn có:
         - Pairings.Status  + 'PendingVerification'
         - RaceEntries.Status + 'Scratched'
       Entity update KHÔNG đủ — CHECK ở DB sẽ chặn giá trị mới nếu không sửa.

   State machine Pairing (sau patch này):
     Pending -> Accepted -> PendingVerification -> Confirmed
                                 |                     |
                                 +-> Rejected          +-> Cancelled
     Giải miễn phí (EntryFeeAmount = 0): Accepted -> Confirmed thẳng, payment
     được tạo sẵn ở trạng thái Verified (Amount = 0) để giữ một nguồn sự thật.

   State machine RaceEntry:
     Confirmed -> Cancelled  (rút TRƯỚC bốc thăm — giải phóng cổng)
     Confirmed -> Scratched  (rút SAU bốc thăm — GIỮ cổng trống, không bốc lại)

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Tournaments: PaymentDeadline + RefundDeadline
   --------------------------------------------------------------------------- */
IF COL_LENGTH('Tournaments', 'PaymentDeadline') IS NULL
    ALTER TABLE Tournaments ADD PaymentDeadline DATETIME2 NULL;
GO

IF COL_LENGTH('Tournaments', 'RefundDeadline') IS NULL
    ALTER TABLE Tournaments ADD RefundDeadline DATETIME2 NULL;
GO

/* ---------------------------------------------------------------------------
   2) Bảng EntryFeePayments
   --------------------------------------------------------------------------- */
IF OBJECT_ID('EntryFeePayments', 'U') IS NULL
BEGIN
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
END
GO

/* Một payment ĐANG HIỆU LỰC (PendingVerification hoặc Verified) cho mỗi Pairing.
   Filtered unique index — Rejected/Refunded KHÔNG tính, nên Owner nộp lại được
   sau khi bị reject mà không vướng unique. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_EFP_ActivePerPairing')
    CREATE UNIQUE INDEX UQ_EFP_ActivePerPairing
        ON EntryFeePayments (PairingId)
        WHERE [Status] IN ('PendingVerification','Verified');
GO

/* Màn đối chiếu của Admin lọc theo Status. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EFP_Status')
    CREATE INDEX IX_EFP_Status ON EntryFeePayments ([Status], SubmittedAt);
GO

/* ---------------------------------------------------------------------------
   3) Pairings.Status += 'PendingVerification'
   CHECK cũ (CHK_Pairings_Status) chỉ cho Pending/Accepted/Declined/Confirmed/
   Cancelled — phải DROP rồi tạo lại, không ALTER được CHECK tại chỗ.
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Pairings_Status')
    ALTER TABLE Pairings DROP CONSTRAINT CHK_Pairings_Status;
GO

ALTER TABLE Pairings ADD CONSTRAINT CHK_Pairings_Status
    CHECK ([Status] IN ('Pending','Accepted','PendingVerification','Confirmed','Declined','Cancelled'));
GO

/* ---------------------------------------------------------------------------
   4) RaceEntries.Status += 'Scratched'
   Rút SAU bốc thăm: giữ nguyên PostPosition (cổng bỏ trống), KHÔNG bốc lại.
   Phân biệt rõ với 'Cancelled' (rút trước bốc thăm, giải phóng cổng).
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_RaceEntries_Status')
    ALTER TABLE RaceEntries DROP CONSTRAINT CHK_RaceEntries_Status;
GO

ALTER TABLE RaceEntries ADD CONSTRAINT CHK_RaceEntries_Status
    CHECK ([Status] IN ('Pending','Confirmed','Cancelled','Scratched','Disqualified'));
GO

/* ---------------------------------------------------------------------------
   5) Backfill payment cho pairing đã Confirmed từ trước patch
   Giữ bất biến "Pairing Confirmed <=> có payment Verified" để auto-allocate
   (patch/phase 3) không bỏ sót pairing cũ. Amount lấy từ EntryFeeAmount của giải.
   Method 'Cash' + ReceiptNo đánh dấu rõ là dữ liệu backfill, không phải chứng
   từ thật. Chỉ chèn khi CHƯA có payment active -> chạy lại không nhân bản.
   --------------------------------------------------------------------------- */
INSERT INTO EntryFeePayments (PairingId, Amount, Method, ReceiptNo, [Status], SubmittedAt, VerifiedAt)
SELECT p.PairingId, t.EntryFeeAmount, 'Cash', N'BACKFILL-011', 'Verified', GETUTCDATE(), GETUTCDATE()
FROM Pairings p
JOIN Tournaments t ON t.TournamentId = p.TournamentId
WHERE p.[Status] = 'Confirmed'
  AND NOT EXISTS (
        SELECT 1 FROM EntryFeePayments e
        WHERE e.PairingId = p.PairingId
          AND e.[Status] IN ('PendingVerification','Verified'));
GO
