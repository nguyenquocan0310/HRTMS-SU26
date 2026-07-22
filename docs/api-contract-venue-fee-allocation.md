# API Contract — Venue, Lệ phí, Tự động phân race & Bốc thăm

Patch DB liên quan: `012_venue.sql`, `013_entry_fee_payment.sql`.
Auth: JWT Bearer. Role lấy từ claim, ActorId lấy từ `NameIdentifier`.

Tài liệu này bổ sung cho `api-contract-scheduling.md` và `api-contract-tournament.md`.
Phần nào mâu thuẫn với tài liệu cũ thì **tài liệu này thắng** (flow mới).

---

## 0. Tóm tắt thay đổi flow

**Trước:**
```
Owner mời Jockey -> Jockey accept -> Owner tự bấm confirm pairing -> Confirmed
Admin click allocate TỪNG pairing vào race -> entry Pending
Owner tự confirm entry trước cut-off -> entry Confirmed
Admin bốc thăm
```

**Sau:**
```
Owner mời Jockey -> Jockey accept -> Owner NỘP LỆ PHÍ -> PendingVerification
Admin đối chiếu -> verify -> Pairing Confirmed
Admin bấm "Chốt danh sách" -> auto-allocate CẢ VÒNG -> entry Confirmed luôn
Admin bốc thăm (hoặc AutoDrawJob tự chạy khi còn <= 24h)
```

Owner **không còn** bước tự confirm pairing (giải thu phí) và **không còn** bước tự
confirm entry. Xác nhận đến từ việc Admin verify lệ phí.

Với giải `entryFeeAmount = 0`, Jockey accept lời mời sẽ tự tạo payment `Verified`
với số tiền `0` và chuyển Pairing sang `Confirmed`. Owner không gọi endpoint confirm
và UI không hiển thị nút “Giải miễn phí”.

---

## 1. Venue — sân đua (patch 012)

`Venue.LaneCount` = số cổng xuất phát, là **trần cứng** cho sức chứa mỗi cuộc đua.

### 1.1 Danh sách sân
`GET /api/venues?includeInactive=false` · **AllowAnonymous**

Mặc định **chỉ trả sân `IsActive = true`**. `includeInactive=true` chỉ có hiệu lực
với role Admin — người dùng thường truyền cờ này vẫn chỉ nhận sân active.

`200 OK`:
```json
[
  {
    "venueId": 1,
    "name": "Trường đua Phú Thọ",
    "address": "Số 2 Lê Đại Hành, Phường 15, Quận 11",
    "city": "TP. Hồ Chí Minh",
    "trackType": "Dirt",
    "trackLengthMeters": 1800,
    "laneCount": 12,
    "isActive": true,
    "createdAt": "2026-07-22T08:00:00Z",
    "updatedAt": "2026-07-22T08:00:00Z"
  }
]
```

### 1.2 Chi tiết sân
`GET /api/venues/{id}` · **AllowAnonymous**. Sân inactive → `404` với non-Admin.

### 1.3 Danh sách quản trị sân
`GET /api/admin/venues` · Role: **Admin**

Trả toàn bộ sân, gồm cả sân tạm ngừng. Filter tại server:

```
GET /api/admin/venues?search=Đại%20Nam&city=Bình%20Dương&trackType=Dirt&isActive=true
```

| Query | Kiểu | Ý nghĩa |
|---|---|---|
| `search` | string | Tìm theo tên trường đua |
| `city` | string | Lọc theo tỉnh/thành phố |
| `trackType` | string | `Dirt` \| `Turf` \| `Synthetic` |
| `isActive` | bool | `true` = đang hoạt động; `false` = tạm ngừng |

`200 OK` → mảng `VenueResponseDto` như §1.1. `trackType` không hợp lệ →
`400 INVALID_VENUE_DATA`.

### 1.4 Tạo sân
`POST /api/admin/venues` · Role: **Admin**

```json
{
  "name": "Trường đua Đại Nam",
  "address": "Khu du lịch Đại Nam, Hiệp An",
  "city": "Bình Dương",
  "trackType": "Dirt",
  "trackLengthMeters": 1500,
  "laneCount": 10,
  "isActive": true
}
```
`201 Created` → `VenueResponseDto`.

Errors: `400 INVALID_VENUE_DATA` (tên rỗng, TrackType ngoài `Dirt/Turf/Synthetic`,
chiều dài không dương, LaneCount ngoài 2..24) · `409 VENUE_NAME_DUPLICATE`.

### 1.5 Cập nhật sân
`PUT /api/admin/venues/{id}` · Role: **Admin**. Mọi field optional.

Errors: `404 VENUE_NOT_FOUND` · `400 INVALID_VENUE_DATA` · `409 VENUE_NAME_DUPLICATE` ·
`422 LANE_COUNT_BELOW_TOURNAMENT_MAX_HORSES` (giảm số làn xuống dưới `MaxHorses`
của một giải đang dùng sân) · `422 VENUE_TRACK_TYPE_IN_USE` (đổi loại mặt sân khi
còn giải chưa Completed/Cancelled đang dùng sân).

Không có endpoint xóa cứng. Muốn ngừng sử dụng sân, Admin cập nhật `isActive: false`;
giải đã tham chiếu sân vẫn giữ lịch sử nguyên vẹn.

### 1.6 Ràng buộc ở Tournament

`CreateTournamentDto.VenueId` **bắt buộc**. `UpdateTournamentDto.VenueId` optional
nhưng giải đã có sân thì không được gỡ bỏ.

| Điều kiện | Error | HTTP |
|---|---|---|
| Sân không tồn tại | `VENUE_NOT_FOUND` | 404 |
| Sân `IsActive = false` | `VENUE_INACTIVE` | 422 |
| `MaxHorses > Venue.LaneCount` | `MAX_HORSES_EXCEEDS_LANES` | 422 |
| `dto.TrackType` khác `Venue.TrackType` | `TRACK_TYPE_VENUE_MISMATCH` | 422 |
| Update giải cũ chưa có sân, không truyền VenueId | `VENUE_REQUIRED` | 422 |

- `Tournament.TrackType` **suy ra từ sân**, không nhận tự do. Client gửi giá trị
  mâu thuẫn thì báo lỗi thay vì ghi đè im lặng.
- Đổi `VenueId` bị **khóa khi giải đang Open Registration** (cùng nhóm field-lock
  với `TrackType`/`EntryFeeAmount`) → `FIELD_LOCKED_OPEN_REGISTRATION`.
- **Giải cũ `VenueId = NULL` vẫn ĐỌC được bình thường** — mọi field venue trong DTO
  đều nullable. Chỉ khi *cập nhật* mới bắt buộc gán sân.

### 1.7 Field venue trong DTO

`TournamentResponseDto`, `RaceResponseDto`, `RaceScheduleDto` được bổ sung:
`venueName`, `venueCity`, `laneCount`, `trackLengthMeters`, `raceCapacity`
(= `min(MaxHorses, LaneCount)`); `TournamentResponseDto` có thêm `venueId`,
`RaceResponseDto`/`RaceScheduleDto` có thêm `venueTrackType`. **Tất cả nullable.**

---

## 2. Entry Fee Payment (patch 013)

### 2.1 State machine

**Pairing:**
```
Pending --(jockey accept)--> Accepted --(owner nộp phí)--> PendingVerification
                                ^                                |
                                |                          (admin verify)
                          (admin reject)                         v
                                |                            Confirmed
                                +--------------------------------+
Bất kỳ trạng thái chưa Confirmed --(quá PaymentDeadline)--> Declined
Accepted/Pending/PendingVerification --(owner confirm pairing khác cho cùng ngựa)--> Cancelled
```

**EntryFeePayment:**
```
PendingVerification --(verify)--> Verified
PendingVerification --(reject)--> Rejected      (nộp lại được)
Verified --(rút lui, còn trong RefundDeadline)--> RefundPending --> Refunded
```

> **Bất biến:** `Pairing.Confirmed` ⟺ tồn tại payment `Verified`.
> Giải miễn phí (`EntryFeeAmount = 0`) vẫn ghi payment `Verified` với `Amount = 0`,
> `ReceiptNo = "FREE-ENTRY"`. Nhờ vậy auto-allocate chỉ kiểm tra **một** điều kiện,
> không phải rẽ nhánh theo giải free/có phí.

> **Một payment hiệu lực mỗi Pairing:** filtered unique index
> `UQ_EFP_ActivePerPairing` chỉ tính `PendingVerification`/`Verified`.
> `Rejected` không nằm trong filter nên Owner **nộp lại được** sau khi bị từ chối.

### 2.2 Owner nộp lệ phí
`POST /api/pairings/{id}/fee-payment` · Role: **Owner** · `multipart/form-data`

| Field | Bắt buộc |
|---|---|
| `Method` | luôn — `Cash` \| `Transfer` |
| `ReceiptNo` | khi `Method = Cash` |
| `TransferRef` | khi `Method = Transfer` |
| `proofFile` | không (ảnh/PDF chứng từ, <= 10MB) |

`201 Created` → `FeePaymentResponseDto`:
```json
{
  "paymentId": 21, "pairingId": 12,
  "tournamentId": 3, "tournamentName": "Giải mùa hè 2026",
  "horseId": 7, "horseName": "Thunder",
  "jockeyId": 4, "jockeyName": "Le Van A",
  "ownerId": 9, "ownerName": "Nguyen Van B",
  "amount": 500000.00, "method": "Transfer",
  "receiptNo": null, "transferRef": "FT2607221234",
  "proofFileName": "bienlai.jpg", "hasProof": true,
  "status": "PendingVerification",
  "submittedAt": "2026-07-22T09:00:00Z",
  "verifiedBy": null, "verifiedAt": null, "rejectReason": null,
  "pairingStatus": "PendingVerification"
}
```

Errors: `404 PAIRING_NOT_FOUND` · `403 FORBIDDEN` (không phải chủ ngựa) ·
`400 INVALID_PROOF_FILE` · `400 INVALID_PAYMENT_METHOD` · `400 RECEIPT_NO_REQUIRED` ·
`400 TRANSFER_REF_REQUIRED` · `422 PAIRING_NOT_ACCEPTED` · `422 TOURNAMENT_IS_FREE` ·
`422 PAYMENT_DEADLINE_PASSED` · `409 ACTIVE_PAYMENT_EXISTS`.

> Nộp đồng thời 2 request: `UQ_EFP_ActivePerPairing` bảo đảm **chỉ một** payment
> active; request thua nhận `409 ACTIVE_PAYMENT_EXISTS`.

### 2.3 Admin: danh sách đối chiếu
`GET /api/admin/fee-payments?status=PendingVerification&tournamentId=3&page=1&pageSize=20`
· Role: **Admin**

`200 OK` → `PagedResult<FeePaymentResponseDto>`. Sắp theo `submittedAt` tăng dần
(nộp sớm đối chiếu trước — cùng thứ tự ưu tiên với auto-allocate).

### 2.4 Admin verify
`POST /api/admin/fee-payments/{id}/verify` · Role: **Admin**

`200 OK` → `FeePaymentResponseDto` (`status = Verified`, `pairingStatus = Confirmed`).

Trong **một transaction**: payment → `Verified` (+ `VerifiedBy`/`VerifiedAt`),
Pairing → `Confirmed`, các pairing còn treo của **cùng con ngựa** trong giải →
`Cancelled`. Audit + notify Owner & Jockey sau commit.

Errors: `404 PAYMENT_NOT_FOUND` · `409 PAYMENT_ALREADY_VERIFIED` · `409 PAYMENT_NOT_PENDING`.

> Guard nguyên tử bằng `ExecuteUpdate` có điều kiện `Status = 'PendingVerification'`
> → hai Admin verify song song thì chỉ một thắng.

### 2.5 Admin reject
`POST /api/admin/fee-payments/{id}/reject` · Role: **Admin**

```json
{ "reason": "Ảnh chứng từ mờ, không đọc được mã giao dịch" }
```
Lý do **bắt buộc, >= 10 ký tự**.

`200 OK` → payment `Rejected`, Pairing quay về `Accepted` → Owner nộp lại được
trước `PaymentDeadline`.

Errors: `404 PAYMENT_NOT_FOUND` · `400 REJECT_REASON_REQUIRED` · `409 PAYMENT_NOT_PENDING`.

### 2.6 Tải chứng từ
`GET /api/fee-payments/{id}/proof` · Role: **Owner của pairing** hoặc **Admin**

Trả file stream. Errors: `404 PAYMENT_NOT_FOUND` · `404 PROOF_NOT_FOUND` · `403 FORBIDDEN`.

**Bảo mật file:**
- Lưu ở kho private **riêng** (`App_Data/uploads/fee-proofs/{pairingId}/`), tách khỏi
  kho chứng chỉ để một lỗi phân quyền ở đây không làm lộ hồ sơ cá nhân/CCCD.
- **Không** serve qua static file hosting.
- Tên file sinh mới hoàn toàn từ `Guid` — không dùng lại tên người dùng gửi lên.
- Whitelist đuôi: `.pdf .jpg .jpeg .png .webp`; tối đa 10MB.
- `ResolveWithinRoot` so sánh prefix **có separator ở cuối** → chặn path traversal
  và cả prefix-collision kiểu `/uploads-evil`.
- Owner khác pairing → `403`, **không** lộ chứng từ của pairing khác.

### 2.7 Deadline ở Tournament — RULE ĐÃ CHỐT

`Tournaments.PaymentDeadline` / `RefundDeadline` (`DATETIME2 NULL` ở DB, rule
enforce ở `TournamentService`).

**`PaymentDeadline` — BẮT BUỘC với MỌI giải**, kể cả giải miễn phí.
Với giải free ngữ nghĩa là **"hạn chốt đăng ký"**: `AutoAllocateJob` lấy đúng mốc
này làm trigger (`Tournament.PaymentDeadline < now`), không có thì job **mù** và
cả chuỗi tự động (reject phí trễ → auto-allocate → auto-draw) chết từ gốc.

```
now < PaymentDeadline <= StartDate - 24h
```
Buffer 24h là bắt buộc: sau deadline hệ thống còn phải auto-allocate rồi
auto-draw (`AutoDrawJob` chỉ chạy khi race còn <= 24h). Deadline sát `StartDate`
thì draw không kịp.

**`RefundDeadline` — không bắt buộc gửi, chỉ áp dụng khi `EntryFeeAmount > 0`.**
Bỏ trống khi tạo giải thu phí thì hệ thống tự suy:
```
RefundDeadline = max(StartDate - 24h, PaymentDeadline)
PaymentDeadline <= RefundDeadline <= StartDate     (rule khi Admin nhập tay)
```
Neo vào **ngày đua**, không phải ngày nộp tiền: chi phí tổ chức phát sinh theo
ngày đua, còn `PaymentDeadline + N ngày` sẽ trôi theo lựa chọn hành chính (mở
đóng phí sớm 30 ngày thì cắt quyền rút quá sớm; chốt phí sát ngày đua thì đẩy
hạn hoàn ra sau khi đã đua xong). `StartDate - 24h` trùng mốc `AutoDrawJob`, nên
rule phát biểu gọn: *rút trước khi bốc thăm thì được hoàn, bốc thăm xong là
scratch*.

Cửa sổ hoàn phí đóng **trước** hạn đóng tiền là vô nghĩa — người nộp đúng hạn
chót sẽ không bao giờ có cửa rút; vì vậy giá trị suy ra được clamp về
`PaymentDeadline`.

Giá trị đã lưu **không tự tính lại** khi Admin dời `StartDate`: đó là mốc Owner
đã nhìn thấy trước khi quyết định nộp tiền, tự dịch sẽ âm thầm rút ngắn quyền
rút của người đã đóng phí. Muốn đổi thì gửi `RefundDeadline` mới (có audit).
Trường hợp duy nhất suy lại ở `Update` là giải **miễn phí chuyển sang thu phí** —
lúc đó giải chưa từng có chính sách hoàn phí nào để tôn trọng.

**Update:** chỉ sửa được khi giải còn `Draft`/`Open Registration` (guard status
sẵn có) **và** chưa qua `PaymentDeadline` hiện tại — job đã chạy thì dời mốc sẽ
mâu thuẫn với dữ liệu job vừa ghi.

> `UpdateTournamentDto.RefundDeadline = null` **không xoá** được giá trị cũ
> (không phân biệt "không gửi" với "gửi null"). Dùng `ClearRefundDeadline: true`
> để bỏ chính sách hoàn phí.

| Điều kiện | Error | HTTP |
|---|---|---|
| Thiếu `PaymentDeadline` | `PAYMENT_DEADLINE_REQUIRED` | 422 |
| Ngoài khoảng `now`..`StartDate-24h` | `PAYMENT_DEADLINE_OUT_OF_RANGE` | 422 |
| `RefundDeadline` sai khoảng, hoặc đặt cho giải free | `REFUND_DEADLINE_INVALID` | 422 |
| Đổi deadline sau khi đã qua `PaymentDeadline` | `DEADLINE_LOCKED` | 422 |

### 2.8 Hoàn lệ phí khi rút lui — `RefundDeadline`

`WithdrawAsync` nhánh lệ phí (entry `EntryFeeStatus = "Paid"`):

| Điều kiện | Hành vi | `refundOutcome` |
|---|---|---|
| Entry chưa trả phí / giải free | không làm gì | `NotApplicable` |
| `RefundDeadline` NULL | **không hoàn** (policy giải không hoàn phí) | `NoRefundPolicy` |
| `now <= RefundDeadline` | entry → `Refund Pending`, payment `Verified` → `RefundPending` | `Refunding` |
| `now > RefundDeadline` | **giữ** `Paid`/`Verified`, entry vẫn `Cancelled`/`Scratched` | `DeadlinePassed` |

`WithdrawResultDto` trả thêm `refundOutcome` + `refundDeadline` để FE hiển thị và
đếm ngược. Owner luôn nhận notification nói rõ tiền có được hoàn hay không — đây
là điểm dễ khiếu nại nhất của luồng rút lui.

---

## 3. Auto Allocate (Module E)

### 3.1 Chốt danh sách & phân vào cuộc đua
`POST /api/admin/rounds/{roundId}/auto-allocate` · Role: **Admin**

`200 OK` → `AutoAllocateResultDto`:
```json
{
  "roundId": 5, "tournamentId": 3,
  "poolSize": 25, "capacityPerRace": 8, "raceCount": 3,
  "totalCapacity": 24, "allocatedCount": 24, "waitlistedCount": 1,
  "races": [
    {
      "raceId": 11, "raceNumber": 1, "scheduledTime": "2026-08-01T02:00:00Z",
      "entryCount": 8,
      "entries": [
        { "raceEntryId": 101, "pairingId": 12, "horseId": 7,
          "horseName": "Thunder", "jockeyId": 4, "jockeyName": "Le Van A" }
      ]
    }
  ],
  "waitlist": [
    { "pairingId": 44, "horseId": 31, "horseName": "Lightning",
      "feeVerifiedAt": "2026-07-25T10:00:00Z" }
  ]
}
```

**Guard:**

| Điều kiện | Error | HTTP |
|---|---|---|
| Round không tồn tại | `ROUND_NOT_FOUND` | 404 |
| Giải không ở Open/Closed Registration | `TOURNAMENT_NOT_OPEN_FOR_SCHEDULING` | 422 |
| Giải chưa gán sân (không biết LaneCount) | `VENUE_REQUIRED` | 422 |
| Vòng chưa có race | `NO_RACES_IN_ROUND` | 422 |
| Đã có race bốc thăm | `ROUND_ALREADY_DRAWN` | 409 |
| Vòng đã có entry hợp lệ | `ROUND_ALREADY_ALLOCATED` | 409 |
| Vòng trước chưa `Completed` | `PREVIOUS_ROUND_NOT_COMPLETED` | 422 |
| Pool rỗng | `NO_ELIGIBLE_PAIRINGS` | 422 |

**Pool:**
- **Vòng 1:** pairing `Confirmed` + lệ phí `Verified` + ngựa còn `Enrolled/Approved`
  trong giải. Ưu tiên theo `VerifiedAt` sớm hơn.
- **Vòng 2+:** **chỉ** RaceEntry `Qualified`/`AlsoEligible` của **vòng TRƯỚC**
  (`Qualified` trước `AlsoEligible`, rồi theo `AdvancementRank`). Không quét lại
  toàn giải → pairing đã đua vòng loại **không bị biến mất** ở vòng sau.

**Sức chứa mỗi race** = `min(Tournament.MaxHorses, Venue.LaneCount)`.
Pool vượt `totalCapacity` → phần dư trả về trong `waitlist`.

**Phân bổ:** Fisher-Yates rồi chia round-robin. Thứ tự nộp phí quyết định **AI được
vào**, không quyết định **vào race nào**.

**Entry tạo ra:** `Status = "Confirmed"`, `EntryFeeStatus = "Paid"` — không còn bước
Owner tự xác nhận. Một transaction; audit; notify từng Owner sau commit:
> "Ngựa '[Tên]' đã được phân vào Cuộc đua #[X], lúc [Y]."

### 3.1b Preview (dry-run) — patch 014
`POST /api/admin/rounds/{roundId}/auto-allocate/preview` · Role: **Admin**

**KHÔNG ghi DB.** Dùng **chung** `BuildAllocationPlanAsync` với thao tác chốt thật
nên guard, pool và sức chứa luôn khớp — khác biệt duy nhất là không có bước ghi.
Mọi error code giống `/auto-allocate`.

```json
{
  "roundId": 5, "tournamentId": 3,
  "isPreview": true, "assignmentIsFinal": false,
  "poolSize": 25, "capacityPerRace": 8, "raceCount": 3,
  "totalCapacity": 24, "allocatedCount": 24, "waitlistedCount": 1,
  "warnings": [
    "Có 25 cặp đủ điều kiện nhưng tổng sức chứa của vòng chỉ 24 (8 ngựa × 3 cuộc đua). 1 cặp sẽ vào danh sách chờ."
  ],
  "selectedPool": [
    { "position": 1, "pairingId": 12, "horseId": 7, "horseName": "Thunder",
      "jockeyId": 4, "jockeyName": "Le Van A", "feeVerifiedAt": "2026-07-23T08:00:00Z" }
  ],
  "races": [
    { "raceId": 11, "raceNumber": 1, "scheduledTime": "2026-08-01T02:00:00Z",
      "entryCount": 8, "entries": [] }
  ],
  "waitlist": [
    { "position": 1, "pairingId": 44, "horseId": 31, "horseName": "Lightning",
      "feeVerifiedAt": "2026-07-25T10:00:00Z" }
  ]
}
```

> ⚠️ **`assignmentIsFinal: false` — đọc kỹ.** Preview cho biết **AI được vào** và
> **AI phải chờ** (tất định theo thứ tự ưu tiên) và **số ngựa mỗi race** (tất định
> theo round-robin). Nhưng **ngựa nào vào race nào** dùng Fisher-Yates *tại thời
> điểm chốt* nên **không** tất định → `races[].entries` để **rỗng** ở preview.
> FE **không** được hiển thị mapping ngựa→race ở bước preview; kết quả thật sẽ khác.

### 3.1c Danh sách chờ đã lưu — patch 014
`GET /api/admin/rounds/{roundId}/waitlist` · Role: **Admin**

`200 OK` → `AutoAllocateWaitlistDto[]`, sắp theo `position` tăng dần (1 = gọi bù trước).

**Bảng `RoundWaitlist`** (`RoundId`, `PairingId`, `Position`, `CreatedAt`):
- Unique `(RoundId, PairingId)` và unique `(RoundId, Position)`.
- Ghi trong **cùng transaction** với auto-allocate; xoá bản cũ của vòng trước khi
  ghi lại nên chạy lại không vướng unique.
- `Position` sinh từ **cùng thứ tự** đã dùng để cắt pool (vòng 1: thời điểm verify
  lệ phí; vòng sau: `AdvancementStatus` rồi `AdvancementRank`).

### 3.2 Điều chỉnh thủ công
`PUT /api/admin/race-entries/{id}/move` · Role: **Admin**

```json
{ "targetRaceId": 12 }
```
`200 OK` → `RaceEntryResponseDto`.

| Điều kiện | Error | HTTP |
|---|---|---|
| Entry không tồn tại | `ENTRY_NOT_FOUND` | 404 |
| Race đích không tồn tại | `TARGET_RACE_NOT_FOUND` | 404 |
| Race đích khác vòng | `RACE_NOT_IN_SAME_ROUND` | 422 |
| Race nguồn hoặc đích đã bốc thăm | `ALREADY_DRAWN` | 409 |
| Race đích kín làn | `MAX_LANES_REACHED` | 409 |
| Pairing chưa verify lệ phí | `PAIRING_FEE_NOT_PAID` | 422 |
| Trùng ngựa/nài ở race đích | `DUPLICATE_IN_RACE` | 409 |
| Chuyển vào chính race hiện tại | `SAME_RACE` | 422 |
| Entry không còn hiệu lực | `INVALID_STATUS` | 409 |

> Chỉ cho move **trong cùng vòng** → chặn luôn move cross-tournament.
> Guard `PAIRING_FEE_NOT_PAID` bảo đảm manual move không phải đường vòng để đưa
> pairing chưa trả phí vào đua.

### 3.3 Rút lui — state machine RaceEntry

```
Confirmed --(rút TRƯỚC bốc thăm)--> Cancelled   (PostPosition = null, giải phóng chỗ)
Confirmed --(rút SAU bốc thăm)----> Scratched   (GIỮ PostPosition, cổng để trống)
```

- **`Scratched` KHÔNG bốc lại** — cổng bỏ trống, không xô lệch cổng của ngựa khác.
- `Scratched` không tính là entry hợp lệ nên không ảnh hưởng draw sau đó.
- Rút sau bốc thăm cũng notify Referee/Doctor để điều phối tại chỗ.
- Idempotent: gọi lại khi đã `Cancelled`/`Scratched` → `alreadyWithdrawn = true`.

---

## 4. Bốc thăm

### 4.1 Guard mới cho `POST /api/admin/races/{raceId}/draw`

| Điều kiện | Error | HTTP |
|---|---|---|
| Đã bốc thăm | `ALREADY_DRAWN` | 409 |
| Không có entry hợp lệ | `NO_ELIGIBLE_ENTRIES` | 422 |
| **Ít hơn 2 entry hợp lệ** | `NOT_ENOUGH_ENTRIES` | 422 |
| **Còn entry chưa `Confirmed`** | `ENTRIES_NOT_ALL_CONFIRMED` | 422 |
| **Số entry > `Venue.LaneCount`** | `MAX_LANES_REACHED` | 409 |
| Vi phạm UNIQUE cổng | `DRAW_CONFLICT` | 409 |

### 4.2 Concurrency

Dùng `ExecuteUpdate` có điều kiện `!IsPostPositionDrawn` để **giành quyền** bốc thăm.
Hai Admin — hoặc manual draw chạy cùng `AutoDrawJob` — thì **chỉ một** bên lật được
cờ; bên còn lại nhận rowcount 0 → `409 ALREADY_DRAWN`.

> Trước đây guard chỉ dựa vào `UNIQUE(RaceId, PostPosition)`. Điều đó **không đủ**:
> hai tiến trình ghi cùng tập entry với cùng dải cổng 1..N nên không vi phạm UNIQUE,
> và bên thua vẫn có thể xáo trộn lại cổng đã công bố.

### 4.3 Chốt vòng
`POST /api/admin/rounds/{roundId}/finalize` · Role: **Admin**

Auto-allocate rồi bốc thăm toàn bộ race của vòng.

`200 OK` → `FinalizeRoundResultDto`:
```json
{
  "roundId": 5,
  "allocation": { "...": "AutoAllocateResultDto" },
  "draws": [ { "raceId": 11, "isPostPositionDrawn": true, "totalEntries": 8, "assignments": [] } ],
  "skippedDraws": [ { "raceId": 13, "raceNumber": 3, "reason": "NOT_ENOUGH_ENTRIES" } ]
}
```

**RANH GIỚI TRANSACTION (có chủ ý, KHÔNG phải một transaction duy nhất):**
- allocate: **một** transaction cho cả vòng.
- mỗi draw: **một** transaction riêng cho từng race.

Không gộp được vì mỗi bước gửi notification sau commit; gộp thì một race không đủ
điều kiện bốc thăm sẽ rollback cả phần phân race đã đúng.

**Hệ quả khi lỗi giữa chừng:** phần đã phân race và các race đã bốc **vẫn giữ
nguyên** (không rollback). Race chưa bốc được nằm trong `skippedDraws` kèm lý do →
trạng thái luôn đọc được, không mơ hồ. **Gọi lại `/finalize` an toàn:** allocate đã
xong trả `ROUND_ALREADY_ALLOCATED` và được bỏ qua; race đã bốc trả `ALREADY_DRAWN`
và cũng được bỏ qua.

Manual draw giữ nguyên để demo lễ bốc thăm.

---

## 5. Hangfire jobs

| Job | Lịch (cron) | Việc | Idempotency |
|---|---|---|---|
| `auto-cancel-overdue-entries` | `*/15 * * * *` | **DEPRECATED** — cancel entry `Pending` quá cut-off | entry mới đã `Confirmed` nên job không chạm tới |
| `fee-deadline-job` | `0 * * * *` | Quá `PaymentDeadline` mà chưa `Confirmed` → Pairing `Declined` + đóng payment treo | `ExecuteUpdate` có điều kiện Status từng pairing |
| `auto-allocate-job` | `10 * * * *` | Auto-allocate **vòng 1** của giải đã quá `PaymentDeadline` | vòng đã allocate/drawn bị bỏ qua |
| `auto-draw-job` | `20 * * * *` | Bốc thăm race `Upcoming`, chưa drawn, còn <= 24h | race đã bốc trả `ALREADY_DRAWN`, bỏ qua |

Lệch phút có chủ ý: fee-deadline (:00) → allocate (:10) → draw (:20), để pairing quá
hạn được xử lý xong **trước** khi chốt pool.

Mọi job dùng system user (`Role = "System"`, patch 006) làm audit actor. Thiếu →
`SYSTEM_USER_NOT_FOUND`.

**Vòng N+1** không do `auto-allocate-job` kích hoạt: nó chạy sau khi vòng N chuyển
`Completed` (`ApplyProgressionAsync`, Module K) — Admin gọi `/auto-allocate` hoặc
`/finalize` cho vòng kế.

---

## 6. Endpoint mới

| Method | Path | Role |
|---|---|---|
| GET | `/api/venues` | Anonymous |
| GET | `/api/venues/{id}` | Anonymous |
| POST | `/api/admin/venues` | Admin |
| PUT | `/api/admin/venues/{id}` | Admin |
| POST | `/api/pairings/{id}/fee-payment` | Owner |
| GET | `/api/admin/fee-payments` | Admin |
| POST | `/api/admin/fee-payments/{id}/verify` | Admin |
| POST | `/api/admin/fee-payments/{id}/reject` | Admin |
| GET | `/api/fee-payments/{id}/proof` | Owner (chủ pairing) hoặc Admin |
| POST | `/api/admin/rounds/{id}/auto-allocate` | Admin |
| POST | `/api/admin/rounds/{id}/auto-allocate/preview` | Admin |
| GET | `/api/admin/rounds/{id}/waitlist` | Admin |
| PUT | `/api/admin/race-entries/{id}/move` | Admin |
| POST | `/api/admin/rounds/{id}/finalize` | Admin |

## 7. Endpoint deprecated

| Endpoint | Trạng thái |
|---|---|
| `PATCH /api/pairings/{id}/confirm` | **Giải THU PHÍ → `422 ENTRY_FEE_REQUIRED`.** Giải miễn phí vẫn dùng bình thường. Chặn Owner bypass thanh toán và bảo đảm **chỉ MỘT** đường đưa Pairing lên `Confirmed`. |
| `PATCH /api/race-entries/{id}/confirm` | Còn hoạt động cho dữ liệu cũ, nhưng entry do auto-allocate tạo đã `Confirmed` nên không cần gọi. FE mới **không** nên hiển thị. |
| `POST /api/admin/races/{raceId}/entries` | Giữ làm **manual override**. Case thông thường dùng `/auto-allocate`. |
| `Race.ConfirmationCutoffHours` | **Deprecated, KHÔNG drop cột.** Không còn ý nghĩa vì Owner không tự confirm entry. Vẫn trả trong DTO để không vỡ contract cũ. |
| Notification "xác nhận trước hạn chốt" | Không còn đúng với flow mới. |

## 8. Bảng error code

| Code | HTTP | Nguồn |
|---|---|---|
| `VENUE_NOT_FOUND` | 404 | Venue, Tournament |
| `VENUE_INACTIVE` | 422 | Tournament |
| `VENUE_REQUIRED` | 422 | Tournament, auto-allocate |
| `VENUE_NAME_DUPLICATE` | 409 | Venue |
| `LANE_COUNT_BELOW_TOURNAMENT_MAX_HORSES` | 422 | Venue |
| `MAX_HORSES_EXCEEDS_LANES` | 422 | Tournament |
| `TRACK_TYPE_VENUE_MISMATCH` | 422 | Tournament |
| `PAYMENT_DEADLINE_REQUIRED` | 422 | Tournament |
| `PAYMENT_DEADLINE_OUT_OF_RANGE` | 422 | Tournament |
| `REFUND_DEADLINE_INVALID` | 422 | Tournament |
| `DEADLINE_LOCKED` | 422 | Tournament |
| `INVALID_PAYMENT_METHOD` | 400 | Fee |
| `RECEIPT_NO_REQUIRED` | 400 | Fee |
| `TRANSFER_REF_REQUIRED` | 400 | Fee |
| `INVALID_PROOF_FILE` | 400 | Fee |
| `REJECT_REASON_REQUIRED` | 400 | Fee |
| `PAIRING_NOT_ACCEPTED` | 422 | Fee |
| `TOURNAMENT_IS_FREE` | 422 | Fee |
| `PAYMENT_DEADLINE_PASSED` | 422 | Fee |
| `ACTIVE_PAYMENT_EXISTS` | 409 | Fee |
| `PAYMENT_NOT_FOUND` | 404 | Fee |
| `PROOF_NOT_FOUND` | 404 | Fee |
| `PAYMENT_NOT_PENDING` | 409 | Fee |
| `PAYMENT_ALREADY_VERIFIED` | 409 | Fee |
| `ENTRY_FEE_REQUIRED` | 422 | Pairing confirm (deprecated) |
| `ROUND_NOT_FOUND` | 404 | Allocate |
| `ROUND_ALREADY_ALLOCATED` | 409 | Allocate |
| `ROUND_ALREADY_DRAWN` | 409 | Allocate |
| `NO_RACES_IN_ROUND` | 422 | Allocate |
| `NO_ELIGIBLE_PAIRINGS` | 422 | Allocate |
| `PREVIOUS_ROUND_NOT_COMPLETED` | 422 | Allocate |
| `RACE_NOT_IN_SAME_ROUND` | 422 | Move |
| `MAX_LANES_REACHED` | 409 | Move, Draw |
| `PAIRING_FEE_NOT_PAID` | 422 | Move |
| `SAME_RACE` | 422 | Move |
| `NOT_ENOUGH_ENTRIES` | 422 | Draw |
| `ENTRIES_NOT_ALL_CONFIRMED` | 422 | Draw |
| `ALREADY_DRAWN` | 409 | Draw, Move |
| `DRAW_CONFLICT` | 409 | Draw |

> `ApiResponse<T>` được bổ sung field `Error` (nullable, additive) để FE switch theo
> mã lỗi thay vì so khớp `Message` tiếng Việt. Endpoint không dùng `ApiResponse` trả
> thẳng `{ "error": "...", "message": "..." }` như trước.

---

## 9. FE handoff

### 9.1 Race Operations
- **Bỏ** flow click allocate từng pairing cho case thông thường.
- Thêm 2 nút:
  - **"Chốt danh sách và phân vào cuộc đua"** → `POST /api/admin/rounds/{id}/auto-allocate`
  - **"Hoàn tất phân race và bốc thăm"** → `POST /api/admin/rounds/{id}/finalize`
- Hiển thị: tên sân, loại mặt sân, số làn, sức chứa (`raceCapacity`).
- **Trước bốc thăm:** gate trống (`postPosition = null`) — KHÔNG hiển thị số cổng giả.
- **Sau bốc thăm:** mới có vị trí xuất phát.
- Manual move đặt sau auto-allocate (`PUT .../move`), chỉ trong cùng vòng.
- **Không** để một pairing xuất hiện cùng lúc ở "chưa phân" và "đã phân".
- **Không** để pairing vòng trước biến mất sai ở vòng sau — pool vòng 2+ lấy từ
  `AdvancementStatus` của vòng trước, không phải "chưa allocate toàn giải".
- **Không** cho FE tự random draw hoặc tự auto allocate — mọi thứ qua API.

### 9.2 Entry fee page → màn đối chiếu
- Nguồn: `GET /api/admin/fee-payments?status=PendingVerification`.
- Hiển thị: thông tin thanh toán, `receiptNo`/`transferRef`, ảnh chứng từ
  (`GET /api/fee-payments/{id}/proof` khi `hasProof = true`).
- Hành động: Verify / Reject + lý do (>= 10 ký tự).

### 9.3 Wizard Owner
Giữ flow: đăng ký ngựa vào giải → mời nài ngựa → **nộp thông tin lệ phí**
(thay cho bước "xác nhận cặp đấu" cũ ở giải thu phí).
