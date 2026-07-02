# API Contract — Module E (Lập lịch, Bốc thăm & Rút lui — REQ-F-SCH)

Controller: `SchedulingController` · Base: `/api`
Auth: JWT Bearer. Role lấy từ claim, ActorId lấy từ `NameIdentifier`.

> **Mô hình RaceEntry (quyết định thiết kế):** `RaceEntry` **chỉ do Admin tạo** qua SCH.1. Owner chỉ khai báo ngựa (Module C) + mời Jockey (Module D); KHÔNG còn `POST /api/race-entries` cho Owner. `RaceEntryController` chỉ còn `GET /api/race-entries/my` để Owner xem entry của mình.
>
> **Hệ quả:** vòng đời Entry Fee (`Unpaid → Paid → approve`) diễn ra ở **Pha 3** (sau khi Admin allocate mới có RaceEntry). Các endpoint fee/approve ở `AdminController` (`/api/admin/entries/...`) giữ nguyên.

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
`422 JOCKEY_EXPERIENCE_TOO_LOW` (EC-21) ·
`409 MAX_HORSES_REACHED` (EC-46) · `409 DUPLICATE_IN_RACE` (EC-40) ·
`409 DOUBLE_BOOKED` (EC-15) · `422 INVALID_SCHEDULE` (EC-35).

> `entryFeeStatus` được set tự động khi tạo: `Paid` nếu `Tournament.EntryFeeAmount == 0`, ngược lại `Unpaid`.

> Sau khi allocate thành công, gửi Notification đến Owner **(in-app + email)**: `title = "Ngựa đã được xếp vào cuộc đua"`, nhắc xác nhận trước cut-off.

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
Hành vi: `Cancelled` + `PostPosition=null` (Vacant) + Prediction `Pending→Refunded` + entry `Paid→Refund Pending` + URGENT cho Admin **(in-app + email)** + Notification cho Owner & Jockey **(in-app + email)** + AuditLog, tất cả trong 1 transaction.

---

## Tích hợp
- **SCH.5 (auto-cancel) — ĐÃ WIRE:** `IRaceEntryService.AutoCancelOverdueAsync()` được đăng ký làm recurring job **Hangfire** qua `HangfireExtensions.UseHangfireRecurringJobs()` (gọi trong `Program.cs` sau `app.Build()`, lịch `*/15 * * * *` — BR-08).
- **SCH.9 (freeze config) — ĐÃ WIRE:** `TournamentSevice.UpdateRace` gọi `IRaceEntryService.EnsureRaceConfigEditableAsync(raceId)` khi phát hiện thay đổi trường nhạy cảm (`ScheduledTime` / `RaceDistanceOverride` / `TrackTypeOverride`) → throw `RACE_CONFIG_FROZEN` nếu đã bốc thăm hoặc đã có Prediction. Trường không nhạy cảm (`PurseAmount`, cutoff…) vẫn sửa được sau khi đóng băng.
- **Refund điểm thực tế (còn lại):** Module N (`VirtualPointsTransaction` + `Wallet`) — hiện chỉ đánh dấu Prediction = `Refunded`.
