# API Contract — Module E (Lập lịch, Bốc thăm & Rút lui — REQ-F-SCH)

Controller: `SchedulingController` · Base: `/api`
Auth: JWT Bearer. Role lấy từ claim, ActorId lấy từ `NameIdentifier`.

> Lưu ý: `RaceEntryController` (`/api/race-entries`) là module ĐĂNG KÝ entry + entry fee của Owner — KHÔNG thuộc Module E. Module E nằm ở `SchedulingController`.

---

## 1. Phân bổ Pairing vào Race — SCH.1
`POST /api/admin/races/{raceId}/entries` · Role: **Admin**

Body:
```json
{ "pairingId": 12 }
```
`201 Created` → `RaceEntryResponseDto`:
```json
{
  "raceEntryId": 45, "raceId": 3, "pairingId": 12, "postPosition": null,
  "status": "Pending", "entryFeeStatus": "Unpaid", "isWithdrawn": false,
  "horseId": 7, "horseName": "Thunder", "jockeyId": 4, "jockeyName": "Le Van A",
  "createdAt": "...", "updatedAt": "..."
}
```
Errors: `404 RACE_NOT_FOUND` · `404 PAIRING_NOT_FOUND` · `409 RACE_ALREADY_DRAWN` ·
`422 INVALID_RACE_STATE` · `422 PAIRING_NOT_CONFIRMED` · `422 HORSE_NOT_APPROVED` ·
`409 MAX_HORSES_REACHED` (EC-46) · `409 DUPLICATE_IN_RACE` (EC-40) ·
`409 DOUBLE_BOOKED` (EC-15) · `422 INVALID_SCHEDULE` (EC-35).

## 2. Bốc thăm vị trí xuất phát — SCH.2
`POST /api/admin/races/{raceId}/draw` · Role: **Admin**

`200 OK` → `PostPositionDrawResultDto`:
```json
{
  "raceId": 3, "isPostPositionDrawn": true, "totalEntries": 6,
  "assignments": [
    { "raceEntryId": 45, "pairingId": 12, "horseId": 7, "horseName": "Thunder", "postPosition": 1 }
  ]
}
```
Errors: `404 RACE_NOT_FOUND` · `409 ALREADY_DRAWN` · `422 NO_ELIGIBLE_ENTRIES` · `409 DRAW_CONFLICT`.
Bốc thăm nguyên tử trong 1 transaction; `UNIQUE(RaceId, PostPosition)` chống trùng cổng (BR-37/EC-06).

## 3. Lịch thi đấu công khai — SCH.3
`GET /api/races/{raceId}/entries` · **AllowAnonymous** — ĐÃ CÓ ở `TournamentController.GetRaceEntries` (Module B)
(chỉ public sau khi `IsPostPositionDrawn=true`; Admin thấy luôn). SchedulingController không tạo lại.
Service `IRaceEntryService.GetRaceScheduleAsync` (trả `RaceScheduleDto` có `confirmationCutoffTime`) vẫn để sẵn nếu cần dùng nơi khác.

## 4. Xác nhận tham gia — SCH.4
`PATCH /api/race-entries/{id}/confirm` · Role: **Owner**

`200 OK` → `RaceEntryResponseDto` (status = `Confirmed`).
Errors: `404 ENTRY_NOT_FOUND` · `403 FORBIDDEN` · `409 INVALID_STATUS` · `422 CONFIRMATION_CLOSED` (quá cut-off).

## 5. Rút lui — SCH.5
`DELETE /api/race-entries/{id}` · Role: **Owner** · lý do (tùy chọn) qua query: `?reason=Ngựa chấn thương`

`200 OK` → `WithdrawResultDto`:
```json
{ "raceEntryId": 45, "status": "Cancelled", "refundedPredictions": 3, "alreadyWithdrawn": false, "message": "..." }
```
Errors: `404 ENTRY_NOT_FOUND` · `403 FORBIDDEN`.
Idempotent (BR-36): gọi lại khi đã `Cancelled` → `alreadyWithdrawn=true`, không tác động phụ.
Hành vi: `Cancelled` + `PostPosition=null` (Vacant) + Prediction `Pending→Refunded` + entry `Paid→Refund Pending` + URGENT cho Admin + AuditLog, tất cả trong 1 transaction.

---

## Tích hợp còn lại (ngoài phạm vi file mới, cần wire thêm)
- **SCH.5 (auto-cancel):** `IRaceEntryService.AutoCancelOverdueAsync()` cần đăng ký job nền **Hangfire** (NFR — BR-08) chạy định kỳ.
- **SCH.9 (freeze config):** `IRaceEntryService.EnsureRaceConfigEditableAsync(raceId)` cần được gọi trong hàm update Race của `TournamentSevice` trước khi sửa `ScheduledTime` / `RaceDistanceOverride` / `TrackTypeOverride` (throw `RACE_CONFIG_FROZEN`).
- **Refund điểm thực tế:** Module N (`VirtualPointsTransaction` + `Wallet`) — hiện chỉ đánh dấu Prediction = `Refunded`.
