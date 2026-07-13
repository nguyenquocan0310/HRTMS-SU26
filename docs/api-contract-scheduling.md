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
`422 INVALID_RACE_STATE` · `422 PAIRING_TOURNAMENT_MISMATCH` · `422 PAIRING_NOT_CONFIRMED` · `422 HORSE_NOT_APPROVED` ·
`422 PREVIOUS_ROUND_NOT_COMPLETED` · `422 PAIRING_NOT_QUALIFIED` ·
`422 JOCKEY_EXPERIENCE_TOO_LOW` (EC-21) ·
`409 MAX_HORSES_REACHED` (EC-46) · `409 DUPLICATE_IN_RACE` (EC-40) ·
`409 DOUBLE_BOOKED` (EC-15) · `422 INVALID_SCHEDULE` (EC-35).

> `entryFeeStatus` được set tự động khi tạo: `Paid` nếu `Tournament.EntryFeeAmount == 0`, ngược lại `Unpaid`.

> **Progression (round 2 trở đi):** round đầu allocate tự do từ pairing `Confirmed`; từ round sau, round trước phải `Completed` và pairing phải có entry round trước với `advancementStatus ∈ {Qualified, AlsoEligible}`. Xem mục "Progression" cuối file.

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
Errors: `404 ENTRY_NOT_FOUND` · `403 FORBIDDEN` · `409 INVALID_STATUS` · `422 ENTRY_FEE_NOT_PAID` (lệ phí chưa được Admin xác nhận) · `422 CONFIRMATION_CLOSED` (quá cut-off).

**Luật lệ phí ("Paid trước, Confirmed sau")** — chuẩn hóa từ behavior hệ thống, SRS chưa mô tả bằng câu chữ:
- Giải thu phí (`EntryFeeAmount > 0`): Owner đóng phí offline → Admin xác nhận (`PATCH /api/admin/entries/{id}/fee-status`, `Unpaid → Paid`) → Owner mới confirm được. Entry `Unpaid` → `422 ENTRY_FEE_NOT_PAID`.
- Giải miễn phí (`EntryFeeAmount == 0`): entry được auto-set `EntryFeeStatus = Paid` ngay khi allocate → Owner confirm bình thường.
- Chỉ entry `Pending` mới confirm được; mọi trạng thái khác (kể cả `Cancelled`) → `409 INVALID_STATUS`, không "hồi sinh" entry đã hủy.
- Phía Admin: xác nhận lệ phí và duyệt entry đều chỉ áp dụng cho entry `Pending`.

## 5. Rút lui — SCH.5
`DELETE /api/race-entries/{id}` · Role: **Owner** · lý do (tùy chọn) qua query: `?reason=Ngựa chấn thương`

`200 OK` → `WithdrawResultDto`:
```json
{ "raceEntryId": 45, "status": "Cancelled", "refundedPredictions": 3, "alreadyWithdrawn": false, "message": "..." }
```
Errors: `404 ENTRY_NOT_FOUND` · `403 FORBIDDEN`.
Idempotent (BR-36): gọi lại khi đã `Cancelled` → `alreadyWithdrawn=true`, không tác động phụ.
Hành vi: `Cancelled` + `PostPosition=null` (Vacant) + Prediction `Pending→Refunded` + entry `Paid→Refund Pending` + URGENT cho Admin **(in-app + email)** + Notification cho Owner & Jockey **(in-app + email)** + AuditLog, tất cả trong 1 transaction.

### 5b. Admin hủy entry (thay mặt Owner) — SCH.5
`DELETE /api/admin/race-entries/{id}` · Role: **Admin** · lý do (tùy chọn) qua query: `?reason=...` (mặc định `Ban tổ chức điều phối`).

`200 OK` → `WithdrawResultDto` (giống #5). Dùng lại `WithdrawAsync(isSystem:true)` để bỏ qua check quyền sở hữu Owner.
Errors: `404 ENTRY_NOT_FOUND`.

---

## Tích hợp
- **SCH.5 (auto-cancel) — ĐÃ WIRE:** `IRaceEntryService.AutoCancelOverdueAsync()` được đăng ký làm recurring job **Hangfire** qua `HangfireExtensions.UseHangfireRecurringJobs()` (gọi trong `Program.cs` sau `app.Build()`, lịch `*/15 * * * *` — BR-08).
  - **Audit actor (patch 006):** job dùng system user chuẩn (`Username = "system"`, `Role = "System"`) làm `AuditLog.ActorId` — không còn mượn tài khoản Admin thật. Môi trường chưa chạy patch 006 → job fail rõ ràng `SYSTEM_USER_NOT_FOUND`. User system không thể đăng nhập (AuthService chặn `Role = "System"`; PasswordHash không phải BCrypt hash hợp lệ).

## Optimistic concurrency (patch 005)
`Races` và `RaceEntries` có cột `RowVersion` (ROWVERSION, EF `IsRowVersion`). Hai request cùng sửa 1 bản ghi qua change tracker → request sau nhận:

`409 Conflict` — `{ "error": "CONCURRENCY_CONFLICT", "message": "Dữ liệu vừa bị người khác thay đổi, vui lòng tải lại rồi thử lại." }`

Áp dụng cho MỌI endpoint ghi Race/RaceEntry qua `SaveChanges` (xử lý tập trung ở `ExceptionMiddleware`). FE nhận 409 này → tải lại dữ liệu rồi cho user thao tác lại. Các path atomic dùng `ExecuteUpdateAsync` (withdraw, hoàn điểm...) tự bảo vệ bằng UPDATE có điều kiện, không đi qua RowVersion — hành vi có chủ đích.
- **SCH.9 (freeze config) — ĐÃ WIRE:** `TournamentSevice.UpdateRace` gọi `IRaceEntryService.EnsureRaceConfigEditableAsync(raceId)` khi phát hiện thay đổi trường nhạy cảm (`ScheduledTime` / `RaceDistanceOverride` / `TrackTypeOverride`) → throw `RACE_CONFIG_FROZEN` nếu đã bốc thăm hoặc đã có Prediction. Trường không nhạy cảm (`PurseAmount`, cutoff…) vẫn sửa được sau khi đóng băng.
- **Refund điểm thực tế (còn lại):** Module N (`VirtualPointsTransaction` + `Wallet`) — hiện chỉ đánh dấu Prediction = `Refunded`.

---

## Progression — Tournament/Round/Race (patch 002)

Hệ thống **không có điểm số** — chỉ có tiền thưởng (`EarningsAwarded` từ purse). Progression dựa trên `FinishPosition` + earnings.

**Cấu hình (Tournaments):**
- `AdvancementRule`: `TopPerRace` (default/MVP) · `EarningsBased` · `Hybrid` (P1 — chưa auto-compute).
- `AdvancementCount`: N của Top N mỗi race (default 5, khớp PrizeDistributions Top1–Top5).

**Kết quả (RaceEntries)** — set tự động trong Declare Official (Module K), chỉ khi tournament còn round sau (chung kết không xét):
- `AdvancementStatus`: `Qualified` (trong Top N) · `AlsoEligible` (đồng hạng vắt ranh Top N — Admin quyết định khi allocate; hoặc overflow) · `Eliminated` (ngoài Top N / Disqualified) · `NULL` (chưa xét / entry Cancelled / round chung kết).
- `AdvancementRank`: MVP = `FinishPosition` trong race.
- `AdvancementReason`: lý do phục vụ audit.

**Round completion:** `Round.Status → 'Completed'` tự động khi mọi race trong round đã `Official`/`Cancelled` (trong transaction Declare Official).

**Allocation round sau (SCH.1):** round trước phải `Completed`; pairing phải `Qualified`/`AlsoEligible` ở round trước. Round đầu: allocate tự do từ pairing `Confirmed`.

**Overflow/split (quy ước vận hành, chưa có endpoint):** qualified > sức chứa (`MaxHorses`) → Admin allocate Top theo rank/earnings, phần dư giữ `AlsoEligible`; không chia đều → Admin tạo thêm race trong round (split), gợi ý chia cân bằng (vd 22 qualified, max 12 → 2 race × 11). Ít hơn sức chứa → race vẫn chạy (REQ-F-SCH.7). Consolation race: P2.

**Dependency:** `FinishPosition` do Module Result/Race Officiating nhập & chốt (RaceReport → Declare Official). Progression chỉ chạy khi official result đã có finish positions — backend không tự bịa dữ liệu.
