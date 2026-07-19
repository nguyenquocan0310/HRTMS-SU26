# API Contract — Module M (Ticket Code Bonus & Ví ảo — BR-63 / REQ-F-PRD.5)

Controllers: `AdminTicketCodeController`, `WalletController` · Base: `/api`
Auth: JWT Bearer. ActorId lấy từ claim `NameIdentifier`.

> **Phạm vi:** phát hành (Admin) và redeem (Spectator) mã vé thưởng `Ticket Code Bonus`.
> Ghi ledger `VirtualPointsTransactions` giữ bất biến `Balance = SUM(transactions)`.
> Mã lưu **plaintext** (cột `TicketRewardCodes.Code`, VARCHAR(20)) để Admin xem/tra lại được qua GET.
> Đánh đổi bảo mật: ai có quyền truy cập DB / API Admin đều đọc được mã (như voucher plaintext).

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
- Mỗi code lưu `Code = raw` (plaintext), `Status='Active'`, `PointAmount=rewardAmount`, `ExpiresAt`.
- Toàn bộ batch trong **một transaction** — lỗi bất kỳ (kể cả trùng `UNIQUE(Code)`) → rollback cả batch.
- Audit log chỉ ghi metadata batch (count/reward/expiresAt).

`200 OK` → `CreateTicketCodesResponseDto`:
```json
{
  "count": 10,
  "rewardAmount": 200,
  "expiresAt": "2026-12-31T23:59:59Z",
  "codes": ["TKT-9F3KQ2M7XP4A", "TKT-..."]
}
```
`400` → `quantity`/`rewardAmount`/`expiresAt` không hợp lệ.

---

## 1b. Admin xem danh sách mã đã tạo
`GET /api/admin/ticket-codes?status=&page=1&pageSize=20` · Role: **Admin**

Query:
- `status` (optional): `Active` | `Redeemed` | `Expired` — bỏ trống = tất cả.
- `page` ≥ 1 (mặc định 1); `pageSize` ∈ [1, 100] (mặc định 20).

Rule:
- `Expired` là trạng thái **suy ra lúc chạy** (`Status='Active'` nhưng `ExpiresAt ≤ now`); DB không tự đổi `Status` khi hết hạn.
- Sắp xếp mới nhất trước (`TicketRewardCodeId` giảm dần).

`200 OK` → `TicketCodeListResponseDto`:
```json
{
  "items": [
    {
      "id": 1,
      "code": "TKT-9F3KQ2M7XP4A",
      "pointAmount": 200,
      "status": "Redeemed",
      "expiresAt": "2026-12-31T23:59:59Z",
      "createdAt": "2026-07-19T00:00:00Z",
      "redeemedBySpectatorName": "Nguyễn Văn A",
      "redeemedAt": "2026-07-20T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

---

## 2. Spectator redeem mã — BR-63 / REQ-F-PRD.5
`POST /api/wallet/ticket-codes/redeem` · Role: **Spectator**

Request:
```json
{ "code": "TKT-9F3KQ2M7XP4A" }
```

Rule:
- BE tra code gửi lên (đã `Trim`) trực tiếp với cột `Code` đã lưu.
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
