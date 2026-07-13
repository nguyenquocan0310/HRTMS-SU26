# API Contract — Module K (Tính & Phân bổ Tiền thưởng — REQ-F-PRZ)

Controller: `PursePayoutController` (Admin) · `OwnerEarningsController` (Owner self-view) · Base: `/api`
Auth: JWT Bearer — endpoint 1–3 **Role: Admin**; endpoint 4 **Role: Owner** (self-scoped). ActorId/UserId lấy từ claim `NameIdentifier`.

> **Phạm vi file này:** chỉ phần **quản lý chi trả sau công bố** (REQ-F-PRZ.6) + hiển thị `Remainder` (PRZ.4).
> Việc **tính & sinh** `PursePayouts` (PRZ.2/PRZ.3) diễn ra bên trong transaction **Declare Official** (Module J,
> `POST /api/races/{id}/declare-official`) — KHÔNG nằm ở controller này. Cấu hình `Race.PurseAmount` (PRZ.1) và
> validate `ΣRace.Purse ≤ Tournament.Purse` (PRZ.5) thuộc Module B (`TournamentController`).
>
> **Nguyên tắc 2.5.1 / Out-of-scope #1:** HRTMS chỉ cập nhật **trạng thái lý thuyết** trên sổ sách,
> KHÔNG xử lý dòng tiền thật (không Payment Gateway).

---

## 1. Bảng phân bổ Purse của 1 cuộc đua — PRZ.6 + PRZ.4
`GET /api/races/{raceId}/payouts` · Role: **Admin** · Màn hình: UI-S14

`200 OK` → `RacePayoutSummaryDto`:
```json
{
  "raceId": 3,
  "raceNumber": 1,
  "roundName": "Vòng loại",
  "tournamentName": "Spring Cup 2026",
  "raceStatus": "Official",
  "purseAmount": 100000000,
  "totalAllocated": 92000000,
  "remainderAmount": 8000000,
  "payouts": [
    {
      "pursePayoutId": 10, "raceEntryId": 45,
      "recipientUserId": 7, "recipientName": "Nguyen Van A", "role": "Owner",
      "finishPosition": 1, "horseName": "Thunder",
      "calculatedAmount": 54000000, "payoutStatus": "Unpaid",
      "paidAt": null, "updatedByAdminId": null, "updatedAt": "..."
    },
    {
      "pursePayoutId": 11, "raceEntryId": 45,
      "recipientUserId": 4, "recipientName": "Le Van B", "role": "Jockey",
      "finishPosition": 1, "horseName": "Thunder",
      "calculatedAmount": 6000000, "payoutStatus": "Unpaid",
      "paidAt": null, "updatedByAdminId": null, "updatedAt": "..."
    }
  ]
}
```
Errors: `404 RACE_NOT_FOUND`.

> `remainderAmount = purseAmount − totalAllocated`, **tính on-the-fly** (không lưu cột DB).
> EC-08/BR-26: phần dư phát sinh khi số ngựa về đích hợp lệ < số vị trí thưởng (`<5` ngựa) —
> Admin xử lý thủ công ngoài hệ thống. Race chưa `Official` → `payouts` rỗng, `remainderAmount = purseAmount`.

## 2. Cập nhật trạng thái chi trả — PRZ.6
`PUT /api/payouts/{payoutId}/status` · Role: **Admin** · Màn hình: UI-S14 (nút "Đánh dấu Paid")

Body:
```json
{ "payoutStatus": "Paid" }
```
`200 OK` → `PursePayoutItemDto` (đã cập nhật):
```json
{
  "pursePayoutId": 10, "raceEntryId": 45,
  "recipientUserId": 7, "recipientName": "Nguyen Van A", "role": "Owner",
  "finishPosition": 1, "horseName": "Thunder",
  "calculatedAmount": 54000000, "payoutStatus": "Paid",
  "paidAt": "2026-06-21T10:15:00Z", "updatedByAdminId": 1, "updatedAt": "2026-06-21T10:15:00Z"
}
```
Errors: `404 PAYOUT_NOT_FOUND` · `400` khi `payoutStatus` ∉ {`Paid`,`Unpaid`}.

> Hành vi (BR / PRZ.6 AC#1):
> - `Paid` → set `paidAt = now`, `updatedByAdminId`, `updatedAt`; `Unpaid` → **clear** `paidAt = null`.
> - Mọi lần đổi trạng thái ghi **1 dòng `AuditLogs`** (`action = "Update_Payout_Status"`,
>   `oldValue`/`newValue` = trạng thái cũ/mới) — cùng 1 `SaveChanges` với bản ghi payout (nguyên tử).
> - Bấm lại đúng trạng thái hiện tại → no-op (không ghi audit thừa).

## 3. Lịch sử thưởng tích lũy — PRZ.6
`GET /api/payouts/earnings-history?recipientUserId={id}&role={Owner|Jockey}` · Role: **Admin**

Cả 2 query param đều **tùy chọn**. Không truyền → tổng hợp toàn hệ thống.

`200 OK` → `List<EarningsHistoryItemDto>` (sắp xếp giảm dần theo `totalEarnings`):
```json
[
  {
    "recipientUserId": 7, "recipientName": "Nguyen Van A", "role": "Owner",
    "totalEarnings": 120000000, "paidAmount": 54000000, "unpaidAmount": 66000000,
    "payoutCount": 3
  }
]
```
Errors: không có (trả list rỗng nếu không có dữ liệu).

> Gom nhóm theo (`recipientUserId`, `role`): một người vừa là Owner vừa là Jockey sẽ xuất hiện 2 dòng.
> `totalEarnings = paidAmount + unpaidAmount`.

## 4. Owner tự xem tiền thưởng của mình — PRZ.6 (self-scoped)
`GET /api/owner/earnings` · Role: **Owner**

Owner xem tổng thưởng + chi tiết từng dòng (ngựa nào thắng, về hạng mấy, bao nhiêu, đã trả chưa). `ownerUserId` **lấy từ JWT** (claim `NameIdentifier`), KHÔNG nhận từ query → Owner chỉ thấy payout của chính mình. Chỉ payout `role = "Owner"`; race đã `Official` mới sinh payout.

`200 OK` → `OwnerEarningsDto`:
```json
{
  "ownerUserId": 7,
  "totalEarnings": 120000000,
  "paidAmount": 54000000,
  "unpaidAmount": 66000000,
  "payoutCount": 3,
  "payouts": [
    {
      "pursePayoutId": 15, "raceEntryId": 45, "recipientUserId": 7,
      "recipientName": "Nguyen Van A", "role": "Owner",
      "finishPosition": 1, "horseName": "Thunder",
      "calculatedAmount": 45000000, "payoutStatus": "Unpaid",
      "paidAt": null, "updatedByAdminId": null, "updatedAt": "..."
    }
  ]
}
```
Errors: không có (chưa có payout → tổng = 0, `payouts` rỗng).

> Khác endpoint 3 (`earnings-history`, Admin, nhận `recipientUserId` từ query): endpoint này Owner-only, self-scoped, trả **chi tiết từng dòng** thay vì chỉ tổng gộp. `totalEarnings = paidAmount + unpaidAmount`.

---

## Mapping REQ-F-PRZ → endpoint

| REQ | Nội dung | Vị trí |
|---|---|---|
| PRZ.1 | Cấu hình `Race.PurseAmount` | Module B — `TournamentController` (đã có) |
| PRZ.2 | Phân bổ theo `FinishPosition` (nạp `PrizeDistributions`) | Module J — `declare-official` (đã có) |
| PRZ.3 | Chia nội bộ Jockey/Owner | Module J — `declare-official` (đã có) |
| PRZ.4 | Tổng = 100% & `Remainder` | Validate khi lưu (Module B) + hiển thị: **endpoint 1** |
| PRZ.5 | ΣRace.Purse ≤ Tournament.Purse | Module B — `TournamentController` (đã có) |
| **PRZ.6** | Lịch sử thưởng + trạng thái Paid/Unpaid + Audit | **endpoint 2 + 3** |
