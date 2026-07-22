/* =============================================================================
   Patch 014 — Module E: RoundWaitlist (danh sách chờ theo vòng)
   -----------------------------------------------------------------------------
   Vấn đề patch này giải quyết:
     `AlsoEligible` là giá trị của RaceEntries.AdvancementStatus nên CHỈ tồn tại
     khi pairing đã có entry ở một race. Với VÒNG 1, pairing chưa vào race nào
     => trước patch này không có chỗ lưu danh sách chờ, waitlist chỉ là thông tin
     trong response rồi mất.

     RoundWaitlist lưu phần dư khi pool > tổng sức chứa của vòng
     (tổng sức chứa = min(Tournament.MaxHorses, Venue.LaneCount) * số race).

   Quan hệ với AlsoEligible (KHÔNG thay thế nhau):
     • RoundWaitlist  : pairing chưa được phân vào race nào của vòng.
     • AlsoEligible   : entry ĐÃ đua vòng trước, đủ điều kiện dự bị cho vòng sau.
     Vòng 2+ dùng AdvancementStatus như cũ; RoundWaitlist chủ yếu phục vụ vòng 1
     nhưng vẫn ghi cho mọi vòng để Admin thấy phần dư.

   Position: thứ tự ưu tiên gọi bù (1 = gọi trước). Sinh từ cùng thứ tự đã dùng
   để cắt pool — vòng 1 theo thời điểm lệ phí được verify, vòng sau theo
   AdvancementStatus rồi AdvancementRank.

   Idempotent: chạy lại nhiều lần đều an toàn.
   Target: SQL Server (T-SQL).
   ============================================================================= */

SET XACT_ABORT ON;
GO

IF OBJECT_ID('RoundWaitlist', 'U') IS NULL
BEGIN
    CREATE TABLE RoundWaitlist (
        WaitlistId  INT         IDENTITY(1,1) NOT NULL,
        RoundId     INT         NOT NULL,
        PairingId   INT         NOT NULL,
        [Position]  INT         NOT NULL,
        CreatedAt   DATETIME2   NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT PK_RoundWaitlist PRIMARY KEY (WaitlistId),
        CONSTRAINT FK_RoundWaitlist_Round FOREIGN KEY (RoundId) REFERENCES Rounds(RoundId),
        CONSTRAINT FK_RoundWaitlist_Pairing FOREIGN KEY (PairingId) REFERENCES Pairings(PairingId),
        CONSTRAINT CHK_RoundWaitlist_Position CHECK ([Position] > 0)
    );
END
GO

-- Một pairing chỉ nằm trong danh sách chờ của một vòng đúng một lần.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_RoundWaitlist_RoundPairing')
    CREATE UNIQUE INDEX UQ_RoundWaitlist_RoundPairing
        ON RoundWaitlist (RoundId, PairingId);
GO

-- Thứ tự gọi bù là duy nhất trong mỗi vòng — chặn hai pairing cùng Position.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_RoundWaitlist_RoundPosition')
    CREATE UNIQUE INDEX UQ_RoundWaitlist_RoundPosition
        ON RoundWaitlist (RoundId, [Position]);
GO
