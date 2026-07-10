# API Contract — Module M (Ticket Code Bonus & Ví ảo — BR-63 / REQ-F-PRD.5)

Controllers: `AdminTicketCodeController`, `WalletController` · Base: `/api`
Auth: JWT Bearer. ActorId lấy từ claim `NameIdentifier`.

> **Phạm vi:** phát hành (Admin) và redeem (Spectator) mã vé thưởng `Ticket Code Bonus`.
> Ghi ledger `VirtualPointsTransactions` giữ bất biến `Balance = SUM(transactions)`.
> DB chỉ lưu **SHA-256 hash** của mã (cột `TicketRewardCodes.CodeHash`, VARBINARY(32)); **không** lưu raw code.

---

## 1. Admin tạo batch mã — BR-63
`POST /api/admin/ticket-codes` · Role: **Admin**

Request:
```json
{
  "quantity": 10,
  "rewardAmount": 200,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

Rule:
- `quantity` ∈ [1, 1000]; `rewardAmount` > 0; `expiresAt` phải ở tương lai.
- Raw code sinh bằng RNG mật mã (`RandomNumberGenerator`), format `TKT-` + 12 ký tự Crockford base32; duy nhất trong batch.
- Mỗi code lưu `CodeHash = SHA256(raw)`, `Status='Active'`, `PointAmount=rewardAmount`, `ExpiresAt`.
- Toàn bộ batch trong **một transaction** — lỗi bất kỳ (kể cả trùng `UNIQUE(CodeHash)`) → rollback cả batch.
- Audit log chỉ ghi metadata batch (count/reward/expiresAt), **không** ghi raw code.

`200 OK` → `CreateTicketCodesResponseDto` — **raw code chỉ trả về đúng một lần tại đây**:
```json
{
  "count": 10,
  "rewardAmount": 200,
  "expiresAt": "2026-12-31T23:59:59Z",
  "codes": ["TKT-9F3KQ2M7XP4A", "TKT-..."]
}
```
`400` → `quantity`/`rewardAmount`/`expiresAt` không hợp lệ.

> **Không có GET endpoint lấy lại raw code.** Sau response này, hệ thống chỉ còn hash — không thể khôi phục raw code. Admin phải lưu/in ngay.

---

## 2. Spectator redeem mã — BR-63 / REQ-F-PRD.5
`POST /api/wallet/ticket-codes/redeem` · Role: **Spectator**

Request:
```json
{ "code": "TKT-9F3KQ2M7XP4A" }
```

Rule:
- BE hash raw code gửi lên (SHA-256) rồi so với `CodeHash` đã lưu.
- Validate: tồn tại / `Status='Active'` / `ExpiresAt > now` — sai → lỗi rõ từng case.
- Claim nguyên tử: `UPDATE ... SET Status='Redeemed', RedeemedBySpectatorId, RedeemedAt WHERE Status='Active' AND ExpiresAt>now` (affected==1) → **một code không redeem hai lần, kể cả request đồng thời**.
- Cộng `Wallet.Balance` + ghi `VirtualPointsTransactions` (`Type='Ticket Code Bonus'`, `ReferenceType='TicketRewardCode'`, `ReferenceId=TicketRewardCodeId`) **cùng transaction**.
- Không có ví / lỗi → rollback (code không bị đánh dấu Redeemed).

`200 OK` → `RedeemTicketCodeResponseDto`:
```json
{ "pointsAdded": 200, "newBalance": 1200 }
```
`400` → mã không tồn tại / đã dùng / hết hạn / không còn hiệu lực / không tìm thấy ví.

---

## Ghi chú schema
- Bảng `TicketRewardCodes` đã có sẵn trong `database/hrtms_schema.sql` (không cần patch mới).
- `VirtualPointsTransactions.Type` CHECK gồm `Ticket Code Bonus`; `ReferenceType` CHECK gồm `TicketRewardCode`.
- Reward `200` (REQ-F-REC.2, `Prediction Win Reward`) là hằng số riêng của luồng đối chiếu dự đoán; `rewardAmount` của ticket code do Admin cấu hình mỗi batch, độc lập.
