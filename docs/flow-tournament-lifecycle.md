# HRTMS — Flow vòng đời giải đấu (theo code)

Nhánh: `feat/venue-fee-auto-allocate` · Cập nhật: 2026-07-22

Tài liệu mô tả luồng nghiệp vụ **đúng như code đang chạy**, kèm endpoint và role
cho từng bước. Chi tiết request/response xem:

- `docs/api-contract-venue-fee-allocation.md` — sân đua, lệ phí, allocate/draw
- `docs/api-contract-tournament.md` — cấu hình giải
- `docs/api-contract-scheduling.md` — xếp lịch, race entry

Ký hiệu role trong `[...]` là giá trị `[Authorize(Roles = ...)]` trên controller.

---

## Tổng quan

```
GĐ 0  Admin dựng giải trên một sân đua cụ thể
GĐ 1  Nài đăng ký roster  ×  Chủ ngựa đăng ký ngựa      (hai nhánh độc lập)
GĐ 2  Ghép cặp ngựa–nài, đóng lệ phí kèm minh chứng     (bắt tay 3 bên)
GĐ 3  Hết hạn nộp phí → hệ thống chia field → bốc thăm
GĐ 4  Đua → công bố kết quả → xét đi tiếp → lặp GĐ 3 cho vòng sau
```

Ba mốc thời gian điều khiển toàn bộ chuỗi tự động:

| Mốc | Nguồn | Vai trò |
|---|---|---|
| `PaymentDeadline` | Admin nhập | Chốt danh sách dự thi; trigger chia field |
| `RefundDeadline` | **Hệ thống suy** | Ranh giới được/không được hoàn lệ phí |
| `ScheduledTime − 24h` | Suy từ lịch race | Trigger bốc thăm tự động |

---

## GIAI ĐOẠN 0 — Setup (Admin)

### 0a. Sân đua

| Endpoint | Role | Ghi chú |
|---|---|---|
| `POST /api/admin/venues` | Admin | Tạo sân |
| `GET /api/venues` | public | Chỉ sân `IsActive` |
| `GET /api/venues/{id}` | public | |
| `GET /api/admin/venues?search=&city=&trackType=&isActive=` | Admin | Có cả sân đã tắt |
| `PUT /api/admin/venues/{id}` | Admin | Sửa / bật-tắt hoạt động |

`LaneCount` của sân là **trần cứng** cho số ngựa mỗi cuộc đua.

### 0b. Tạo giải

`POST /api/tournament` [Admin] → `Status: Draft`

Ràng buộc kiểm ở service:

| Điều kiện | Lỗi |
|---|---|
| `VenueId` bắt buộc, sân phải `IsActive` | `VENUE_NOT_FOUND` / `VENUE_INACTIVE` |
| `MaxHorses ≤ Venue.LaneCount` | `MAX_HORSES_EXCEEDS_LANES` |
| `TrackType` phải khớp sân (suy từ sân) | `TRACK_TYPE_VENUE_MISMATCH` |
| `PaymentDeadline` bắt buộc **mọi giải** | `PAYMENT_DEADLINE_REQUIRED` |
| `now < PaymentDeadline ≤ StartDate − 24h` | `PAYMENT_DEADLINE_OUT_OF_RANGE` |
| `RefundDeadline` (nếu nhập tay) trong `[PaymentDeadline, StartDate]` | `REFUND_DEADLINE_INVALID` |

**`PaymentDeadline` bắt buộc cả với giải miễn phí** — với giải free nó mang nghĩa
"hạn chốt đăng ký", vì `auto-allocate-job` lấy đúng mốc này làm trigger; thiếu nó
thì cả chuỗi tự động không chạy.

**`RefundDeadline` Admin không phải nhập.** Bỏ trống thì hệ thống tự đặt:

```
RefundDeadline = max(StartDate − 24h, PaymentDeadline)      khi EntryFeeAmount > 0
                 NULL                                        khi giải miễn phí
```

Neo vào ngày đua chứ không phải ngày nộp tiền, và trùng mốc bốc thăm tự động, nên
chính sách phát biểu gọn: *rút trước khi bốc thăm thì được hoàn lệ phí; bốc thăm
xong là scratch, không hoàn*. Giá trị đã lưu **không tự tính lại** khi dời
`StartDate` — đó là mốc Owner đã thấy trước khi quyết định nộp tiền. Trường hợp
duy nhất suy lại ở `Update` là giải miễn phí chuyển sang thu phí.

### 0c. Cấu trúc vòng / cuộc đua

```
POST /api/tournament/{id}/rounds              [Admin]
POST /api/rounds/{id}/races                   [Admin]
PUT  /api/tournament/{id}/prize-distributions [Admin]
PUT  /api/races/{raceId}                      [Admin]
```

### 0d. Mở đăng ký

`PATCH /api/tournament/{id}/status` [Admin] → `Open Registration`

Sau khi đã qua `PaymentDeadline`, mọi thay đổi deadline bị chặn → `DEADLINE_LOCKED`
(job đã chạy, dời mốc sẽ mâu thuẫn với dữ liệu job vừa ghi).

---

## GIAI ĐOẠN 1 — Vào giải (hai nhánh độc lập)

Hai nhánh này **cố ý tách rời**: người duyệt khác nhau (Admin thẩm định ngựa,
nài tự quyết việc nhận lời mời), thời điểm khác nhau, và ngoài đời việc chốt nài
diễn ra rất muộn so với việc đăng ký ngựa (có thể đổi nài phút chót).

### 1a. Nài đăng ký roster

```
POST  /api/tournament/{tournamentId}/participants       [Owner,Jockey,Doctor,Referee] → Pending
GET   /api/tournament/{tournamentId}/participants       [Admin]
GET   /api/my/tournament-participations                 [Auth]
PATCH /api/admin/tournament-participants/{id}/approve   [Admin] → Approved
PATCH /api/admin/tournament-participants/{id}/reject    [Admin]
```

### 1b. Chủ ngựa đăng ký ngựa vào giải

```
POST   /api/horses                                      [Owner] — hồ sơ ngựa (1 lần, không gắn giải)
POST   /api/horses/{horseId}/enrollments                [Owner] → Enrolled
GET    /api/horses/{horseId}/enrollments                [Owner]
GET    /api/horses/my/enrollments                       [Owner]
DELETE /api/horses/{horseId}/enrollments/{id}           [Owner] — rút khỏi giải
```

Enrollment chạy **auto-screening** giống/doping ngay khi tạo:

| Kết quả sàng lọc | `AdminApprovalStatus` |
|---|---|
| Đủ điều kiện rõ ràng | `Approved` — tự động |
| Vi phạm rõ ràng | `Rejected` — tự động |
| Mập mờ | chờ Admin duyệt tay |

Ngựa thuộc chuồng của Owner, **không gắn cứng vào giải** — mỗi giải là một
`HorseTournamentEntry` riêng.

---

## GIAI ĐOẠN 2 — Ghép cặp + đóng lệ phí

### 2a. Owner mời nài

`POST /api/pairings` [Owner] → `Pending`

Guard: ngựa `Enrolled` + `Approved` trong **đúng giải** · nài `Approved` trong
roster giải · `ExperienceYears ≥ MinJockeyExperienceYears` · nài chưa có cặp
`Accepted`/`Confirmed` ở giải nào trùng khoảng thời gian.

### 2b. Nài phản hồi

```
PATCH /api/pairings/{id}/accept    [Jockey] → Accepted
PATCH /api/pairings/{id}/decline   [Jockey] → Declined
```

### 2c. Owner nộp lệ phí kèm minh chứng

`POST /api/pairings/{id}/fee-payment` [Owner] → `Pairing: PendingVerification`

multipart form:

| Field | Bắt buộc khi |
|---|---|
| `Method` | luôn — `Cash` \| `Transfer` |
| `ReceiptNo` | `Method = Cash` |
| `TransferRef` | `Method = Transfer` |
| `Proof` (ảnh hóa đơn / màn hình chuyển khoản) | optional |

Chặn nếu đã quá `PaymentDeadline`. Bước này **thay cho** thao tác "Owner confirm
cặp đấu" trước đây — xác nhận tham gia và nộp tiền là một hành động.

### 2d. Admin đối chiếu

```
GET  /api/admin/fee-payments?status=PendingVerification   [Admin]
GET  /api/fee-payments/{id}/proof                         [Auth]  — tải minh chứng
POST /api/admin/fee-payments/{id}/verify                  [Admin] → Pairing: Confirmed
POST /api/admin/fee-payments/{id}/reject                  [Admin] — kèm lý do, Owner nộp lại được
```

`verify` đồng thời **huỷ các cặp đối thủ** tranh cùng ngựa hoặc cùng nài.

### Giải miễn phí

Bỏ qua 2c/2d, dùng đường cũ:

```
PATCH /api/pairings/{id}/confirm   [Owner] → Confirmed
```

Gọi endpoint này trên giải **có thu phí** → `422 ENTRY_FEE_REQUIRED`. Chốt chặn
này đảm bảo chỉ tồn tại **một** đường đưa Pairing lên `Confirmed`, không bypass
được thanh toán.

```
PATCH /api/pairings/{id}/cancel    [Owner]
GET   /api/owner/pairings          [Owner]
GET   /api/admin/pairings          [Admin]
```

### Chốt danh sách

⏰ **`fee-deadline-job`** — cron `0 * * * *`

Quá `PaymentDeadline` mà pairing chưa `Confirmed` → `Declined` + notify.
Sau mốc này danh sách dự thi chốt cứng, không còn pairing treo vô thời hạn.

---

## GIAI ĐOẠN 3 — Vào đua

### 3a. ALLOCATE — chia field tự động

```
POST /api/admin/rounds/{roundId}/auto-allocate/preview   [Admin] — dry-run, KHÔNG ghi DB
POST /api/admin/rounds/{roundId}/auto-allocate           [Admin] — chốt thật
GET  /api/admin/rounds/{roundId}/waitlist                [Admin]
```

**Pool ứng viên**

| Vòng | Nguồn |
|---|---|
| Vòng 1 | Pairing `Confirmed` + lệ phí `Verified` |
| Vòng 2+ | Entry `Qualified`/`AlsoEligible` ở **vòng trước** (vòng trước phải `Completed`) |

**Thuật toán**

```
capacity mỗi race = min(Tournament.MaxHorses, Venue.LaneCount)

chọn AI được vào     : thứ tự verify lệ phí sớm (first-paid-first-in)
chọn vào RACE nào    : Fisher-Yates shuffle + chia round-robin
                       → các race lệch nhau tối đa 1 ngựa
phần dư quá sức chứa : RoundWaitlist (persist) — Position 1 = gọi bù trước
```

Ưu tiên chỉ quyết định **ai** được vào, ngẫu nhiên quyết định **vào đâu** —
thứ tự nộp phí không ảnh hưởng việc rơi vào race nào.

`RaceEntry` sinh ra với `Status = "Confirmed"`, `EntryFeeStatus = "Paid"` — không
còn trạng thái `Pending`, vì pairing đã `Confirmed` + đã trả tiền, không còn gì
phải chờ Owner. Notify từng Owner: ngựa vào race nào, giờ nào.

**Sửa tay** (chỉ khi race chưa bốc thăm)

```
PUT    /api/admin/race-entries/{id}/move     [Admin] — chuyển sang race khác cùng vòng
POST   /api/admin/races/{raceId}/entries     [Admin] — thêm thủ công 1 pairing
DELETE /api/admin/race-entries/{id}          [Admin]
```

### 3b. Rút lui

`DELETE /api/race-entries/{id}` [Owner]

| Thời điểm | Trạng thái entry | Cổng xuất phát |
|---|---|---|
| Trước bốc thăm | `Cancelled` | giải phóng chỗ |
| Sau bốc thăm | `Scratched` | **giữ nguyên** `PostPosition`, cổng bỏ trống, không bốc lại |

Hoàn lệ phí (`refundOutcome` trong response):

| Điều kiện | Kết quả |
|---|---|
| `RefundDeadline` NULL | `NoRefundPolicy` — không hoàn |
| `now ≤ RefundDeadline` | `Refunding` — entry `Refund Pending` |
| `now > RefundDeadline` | `DeadlinePassed` — giữ `Paid`, không hoàn |

Không còn bước "Owner xác nhận tham gia cuộc đua" — quyền duy nhất của Owner sau
khi được xếp vào race là **rút lui**.

### 3c. DRAW — bốc thăm vị trí xuất phát

```
POST /api/admin/races/{raceId}/draw          [Admin] — bốc sớm (lễ bốc thăm / demo)
POST /api/admin/rounds/{roundId}/finalize    [Admin] — gộp allocate + draw (demo)
```

Guard (dùng chung cho cả bốc tay lẫn job tự động):

| Điều kiện | Lỗi |
|---|---|
| < 2 entry hợp lệ | `NOT_ENOUGH_ENTRIES` |
| Đã bốc rồi | `ALREADY_DRAWN` — khoá vĩnh viễn |
| Số entry > `LaneCount` | chặn |
| Giải không ở `Open`/`Closed Registration` | `INVALID_TOURNAMENT_STATE` |

Bốc bằng Fisher-Yates trong transaction; `UNIQUE(RaceId, PostPosition)` chống
trùng cổng, hai phiên bốc song song → `DRAW_CONFLICT`.

**Vì sao allocate và draw tách làm hai mốc:** field lộ sớm để in chương trình và
sắp lịch; gate lộ muộn (sát giờ đua) để giảm thời gian thao túng kèo. Gộp lại thì
mỗi lần có ngựa rút sẽ phải bốc lại toàn bộ, phá tính công bằng đã công bố.

### Chuỗi job tự động

⏰ Ba job nối đuôi, lệch nhau 10 phút trong cùng giờ:

| Giờ | Job | Việc |
|---|---|---|
| `:00` | `fee-deadline-job` | Loại pairing chưa hoàn tất lệ phí |
| `:10` | `auto-allocate-job` | Chia field vòng 1 của giải đã quá `PaymentDeadline` (idempotent) |
| `:20` | `auto-draw-job` | Bốc thăm race `Upcoming` còn ≤ 24h là tới giờ chạy |

`auto-cancel-overdue-entries` (`*/15 * * * *`) — **DEPRECATED** cùng flow Owner tự
confirm entry; entry mới sinh ra đã `Confirmed` nên job không chạm tới, chỉ còn
xử lý dữ liệu cũ.

### 3d. Sau bốc thăm

```
GET /api/races/{raceId}/entries    — starting list công khai
```

Field đóng băng, prediction gate mở.

---

## GIAI ĐOẠN 4 — Ngày đua → vòng sau

```
Referee ghi kết quả  →  Declare Official
   ↓
ApplyProgressionAsync: gán AdvancementStatus cho từng entry
   Qualified / AlsoEligible / Eliminated
   theo AdvancementRule = TopPerRace và AdvancementCount
   ↓
Mọi race trong vòng đã Official/Cancelled  ⇒  Round: Completed
   ↓
Lặp lại 3a cho vòng kế (pool = Qualified/AlsoEligible của vòng vừa xong)
```

```
PATCH /api/races/{id}/cancel    [Admin] — huỷ race: entry → Cancelled + hoàn phí + hoàn điểm dự đoán
```

---

## Bảng trạng thái

**Pairing**

```
Pending ──accept──> Accepted ──nộp phí──> PendingVerification ──verify──> Confirmed
   │                   │                          │
   └──decline──> Declined <──── reject / quá PaymentDeadline
                                                  
(giải miễn phí)  Accepted ──PATCH confirm──> Confirmed
```

**EntryFeePayment**

```
PendingVerification ──verify──> Verified ──rút trong hạn──> RefundPending ──> Refunded
        │
        └──reject──> Rejected   (Owner nộp lại được trước PaymentDeadline)
```

**RaceEntry**

```
Confirmed ──rút trước draw──> Cancelled
    │
    └──rút sau draw────────> Scratched   (giữ PostPosition)
```

---

## Điểm khác so với bản flow trước

| Hạng mục | Bản trước | Code hiện tại |
|---|---|---|
| `RefundDeadline` | Admin nhập tay | Hệ thống suy `max(StartDate−24h, PaymentDeadline)`; form chỉ hiển thị |
| Chọn ai vào field khi dư chỗ | chưa nêu | Thứ tự verify phí sớm; ngẫu nhiên **chỉ** quyết định vào race nào |
| Danh sách chờ | chỉ nằm trong response | Persist bảng `RoundWaitlist` (patch 014), có thứ tự gọi bù |
| Preview trước khi chốt | không có | `POST /api/admin/rounds/{id}/auto-allocate/preview` |
| Sửa tay sau allocate | mô tả là kéo-thả | Dropdown "Chuyển sang cuộc đua" → `PUT /api/admin/race-entries/{id}/move` |
| `PATCH /pairings/{id}/confirm` | đường chính | Chỉ còn cho giải miễn phí; giải thu phí → `422 ENTRY_FEE_REQUIRED` |
| Owner xác nhận tham gia race | có (bước 3b cũ) | **Đã bỏ** — thay bằng quyền rút lui |
| `Race.ConfirmationCutoffHours` | dùng để chốt entry | DEPRECATED, cột vẫn còn để không vỡ dữ liệu cũ |
