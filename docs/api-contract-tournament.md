# API Contract — Module B: Quản lý Giải đấu

**Phiên bản:** 3.1 — đồng bộ SRS v2 (TRN.8 state machine cấp giải, TRN.10 cancellation flow, TRN.11 roster screening) + validate tính liên tục thời gian giữa các Round và field tính toán quỹ thưởng
**Base URL:** `http://localhost:5000/api`
**Auth header:** `Authorization: Bearer <jwt_token>`

> **Thay đổi quan trọng so với v2.0 (FE phải đọc):**
> - State machine giải đấu **bỏ `Pre-Race` và `In-Progress`** — đây là trạng thái cấp **Race**, không còn ở Tournament. Tournament chỉ còn `Draft → Open Registration → Closed Registration → Completed` (+ `Cancelled`).
> - Endpoint cập nhật giải (PUT) chỉ cho sửa khi `Draft` hoặc `Open Registration`.
> - Bổ sung nhóm endpoint **Tournament Participants (roster)** — TRN.11.
>
> **Thay đổi mới trong v3.1:**
> - `TournamentResponseDto` có thêm `allocatedPurse` (tổng quỹ đã phân bổ cho Race) và `remainingPurse` (`purseAmount - allocatedPurse`); `RoundResponseDto` có thêm `allocatedPurse` cấp vòng. Áp dụng cho endpoint 1, 3, 5, 6, 7, 8.
> - Tạo vòng đấu (endpoint 3) giờ validate thêm **tính liên tục thời gian giữa các Round**: vòng sau phải diễn ra sau race cuối của vòng trước và trước ngày của vòng kế tiếp (nếu đã tồn tại).

---

## Quy ước chung

| Mục | Giá trị |
|-----|---------|
| Content-Type | `application/json` |
| Định dạng thời gian | ISO 8601 — `2026-06-13T10:00:00Z` |
| Kiểu ID | integer |
| Cấu trúc response | `{ "success": true/false, "message": "...", "data": {...} }` |

**Trạng thái Tournament (cấp giải):** `Draft` → `Open Registration` → `Closed Registration` → `Completed` (một chiều, không lùi lại); nhánh `Cancelled` qua endpoint hủy giải.
**Trạng thái Round:** `Upcoming` · `In-Progress` · `Completed` · `Cancelled`
**Trạng thái Race (cấp cuộc đua, độc lập với giải):** `Upcoming` · `Pre-Race` · `Live` · `Unofficial` · `Official` · `Cancelled`

> ⚠️ `Pre-Race`/`Live`/`Unofficial`/`Official` **chỉ tồn tại ở Race**, không bao giờ là trạng thái Tournament. Trạng thái "giải đang diễn ra" được suy ra từ trạng thái các Race con. FE không được hiển thị/gửi các giá trị này cho Tournament.

---

## Danh sách Endpoint (theo thứ tự thực hiện)

> ⚠️ Thứ tự bắt buộc khi setup giải mới: **Tạo giải (1) → Cấu hình thưởng (2) → Tạo round (3) → Tạo race (4)** → rồi mới chuyển trạng thái.

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | POST | `/api/tournament` | Admin | Tạo giải đấu mới |
| 2 | PUT | `/api/tournament/{id}/prize-distributions` | Admin | Cấu hình tỷ lệ thưởng |
| 3 | POST | `/api/tournament/{id}/rounds` | Admin | Tạo vòng đấu |
| 4 | POST | `/api/rounds/{id}/races` | Admin | Tạo cuộc đua trong vòng |
| 5 | GET | `/api/tournament` | Public | Danh sách giải đấu |
| 6 | GET | `/api/tournament/{id}` | Public | Chi tiết giải đấu |
| 7 | PUT | `/api/tournament/{id}` | Admin | Cập nhật thông tin giải |
| 8 | PATCH | `/api/tournament/{id}/status` | Admin | Chuyển trạng thái |
| 9 | DELETE | `/api/tournament/{id}` | Admin | Hủy giải đấu (cancellation flow) |

### Nhóm Roster — Tournament Participants (TRN.11)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 10 | POST | `/api/tournament/{tournamentId}/participants` | Owner/Jockey/Doctor/Referee | Tự đăng ký tham gia giải |
| 11 | GET | `/api/tournament/{tournamentId}/participants` | Admin | Xem roster (lọc theo role/status) |
| 12 | GET | `/api/my/tournament-participations` | Authenticated | Các giải user đã đăng ký |
| 13 | PATCH | `/api/admin/tournament-participants/{participantId}/approve` | Admin | Duyệt tham gia |
| 14 | PATCH | `/api/admin/tournament-participants/{participantId}/reject` | Admin | Từ chối (reason ≥ 10 ký tự) |

> Endpoint #4, #10–14 dùng route gốc khác: tạo race là `/api/rounds/{id}/races`; participants nằm trên `TournamentParticipantController`.

---
---

## 1. Tạo giải đấu

```
POST /api/tournament
```

**Auth:** Admin

---

### Request body

```json
{
  "name":                          "Giải Đua Mùa Hè 2026",
  "description":                   "Giải đấu khu vực phía Nam",
  "startDate":                     "2026-07-01T08:00:00Z",
  "endDate":                       "2026-07-15T18:00:00Z",
  "maxHorses":                     12,
  "allowedBreed":                  "Thoroughbred",
  "trackType":                     "Turf",
  "raceDistance":                  1600,
  "raceCategory":                  "Open",
  "minJockeyExperienceYears":      2,
  "purseAmount":                   300000000,
  "entryFeeAmount":                5000000,
  "preRaceWeightThresholdKg":      2.0,
  "postRaceWeightDiffThresholdKg": 1.0
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| name | string | Bắt buộc, tối đa 200 ký tự |
| description | string | Tuỳ chọn |
| startDate | datetime | Bắt buộc |
| endDate | datetime | Bắt buộc, phải sau `startDate` |
| maxHorses | int | Bắt buộc, ≥ 1 |
| allowedBreed | string | `Thoroughbred` \| `Arabian` \| `Quarter Horse` \| `Mixed` |
| trackType | string | `Turf` \| `Dirt` \| `Synthetic` |
| raceDistance | int | Số nguyên `>1200` và `<2400` (mét); UI nên gợi ý các mốc phổ biến |
| raceCategory | string | `Open` \| `Classic` \| `Maiden` |
| minJockeyExperienceYears | int | 0–50 |
| purseAmount | decimal | ≥ 0 |
| entryFeeAmount | decimal | ≥ 0, mặc định `0` (miễn phí) |
| preRaceWeightThresholdKg | decimal | mặc định `2.0` kg |
| postRaceWeightDiffThresholdKg | decimal | mặc định `1.0` kg |
| advancementRule | string | tùy chọn; `TopPerRace` (default) / `EarningsBased` / `Hybrid`. Không truyền → `TopPerRace` |
| advancementCount | int | tùy chọn, > 0; số suất đi tiếp mỗi race (Top N). Không truyền → default `5` |

---

### Business rules

- Tournament được tạo với `status = "Draft"`, `createdAt = UtcNow`.
- `entryFeeAmount = 0`: toàn bộ luồng xác nhận phí bị bỏ qua, `RaceEntry.EntryFeeStatus` tự động `"Paid"`.
- `prizeDistributions` **không** được gửi trong request này — cấu hình riêng ở endpoint 2.
- `advancementRule`/`advancementCount`: cấu hình rule đi tiếp chung cho giải. Chỉ `TopPerRace` được tính tự động khi Declare Official (Module J đọc `Tournament.AdvancementCount` để xét Top N); `EarningsBased`/`Hybrid` lưu được nhưng chưa auto-compute (P1). Rule không hợp lệ → 400; `advancementCount <= 0` → 400.

---

### Response — 200 OK

```json
{
  "success": true,
  "message": "Tao giai dau thanh cong",
  "data": {
    "tournamentId":                  10,
    "name":                          "Giải Đua Mùa Hè 2026",
    "description":                   "Giải đấu khu vực phía Nam",
    "startDate":                     "2026-07-01T08:00:00Z",
    "endDate":                       "2026-07-15T18:00:00Z",
    "maxHorses":                     12,
    "allowedBreed":                  "Thoroughbred",
    "trackType":                     "Turf",
    "raceDistance":                  1600,
    "raceCategory":                  "Open",
    "purseAmount":                   300000000,
    "allocatedPurse":                0,
    "remainingPurse":                300000000,
    "entryFeeAmount":                5000000,
    "preRaceWeightThresholdKg":      2.0,
    "postRaceWeightDiffThresholdKg": 1.0,
    "status":                        "Draft",
    "advancementRule":               "TopPerRace",
    "advancementCount":              5,
    "createdAt":                     "2026-06-15T07:57:57Z",
    "rounds":                        [],
    "prizeDistributions":            []
  }
}
```

> `allocatedPurse` = tổng `purseAmount` của mọi Race trong giải (`SUM` qua mọi Round); `remainingPurse = purseAmount - allocatedPurse`. Giải mới tạo chưa có Race nào nên `allocatedPurse = 0`. Hai field này xuất hiện ở **mọi** response trả về `TournamentResponseDto` (endpoint 1, 5, 6, 7, 8).

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | Thiếu field bắt buộc (`name`, `startDate`, `endDate`, v.v.) | 🟡 Data Annotation |
| 400 | `name` > 200 ký tự | 🟡 Data Annotation |
| 400 | `maxHorses` < 1 | 🟡 Data Annotation |
| 400 | `raceDistance` không `>1200` và `<2400` | 🟡 Data Annotation |
| 400 | `allowedBreed` không hợp lệ (vd: `"Pony"`) | 🔴 Business logic |
| 400 | `trackType` không hợp lệ (vd: `"Sand"`) | 🔴 Business logic |
| 400 | `raceCategory` không hợp lệ (vd: `"Premium"`) | 🔴 Business logic |
| 400 | `endDate` không sau `startDate` | 🔴 Business logic |
| 401 | Chưa đăng nhập | 🟡 [Authorize] |
| 403 | Không phải Admin | 🟡 [Authorize(Roles="Admin")] |

> 🟡 = hệ thống tự chặn trước khi vào Service · 🔴 = code trong TournamentService xử lý

---
---

## 2. Cấu hình tỷ lệ thưởng

```
PUT /api/tournament/{id}/prize-distributions
```

**Auth:** Admin · **Path param:** `id` — tournamentId

---

### Request body

```json
{
  "distributions": [
    { "position": 1, "percentage": 50 },
    { "position": 2, "percentage": 25 },
    { "position": 3, "percentage": 15 },
    { "position": 4, "percentage": 6 },
    { "position": 5, "percentage": 4 }
  ]
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| distributions | array | Đúng 5 phần tử |
| position | int | 1–5, không trùng nhau |
| percentage | decimal | > 0, tổng 5 phần tử = 100 |

---

### Business rules

- Gọi nhiều lần được — lần sau overwrite lần trước.
- Bắt buộc phải cấu hình đủ trước khi chuyển sang `Open Registration`.

---

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    { "position": 1, "percentage": 50 },
    { "position": 2, "percentage": 25 },
    { "position": 3, "percentage": 15 },
    { "position": 4, "percentage": 6 },
    { "position": 5, "percentage": 4 }
  ]
}
```

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | `percentage` ≤ 0 | 🟡 Data Annotation |
| 400 | Tổng percentage ≠ 100 | 🔴 Business logic |
| 400 | Không đủ 5 vị trí (1–5) | 🔴 Business logic |
| 400 | Trùng position | 🔴 Business logic |
| 404 | `id` không tồn tại | 🔴 Business logic |

---
---

## 3. Tạo vòng đấu

```
POST /api/tournament/{id}/rounds
```

**Auth:** Admin · **Path param:** `id` — tournamentId

---

### Request body

```json
{
  "name":          "Vòng loại",
  "sequenceOrder": 1,
  "scheduledDate": "2026-07-03T08:00:00Z"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| name | string | Bắt buộc, tối đa 100 ký tự |
| sequenceOrder | int | 1–100, không trùng trong tournament |
| scheduledDate | datetime | Bắt buộc, trong `[tournament.startDate, tournament.endDate]` |

---

### Business rules

- `scheduledDate` phải nằm trong khoảng `[tournament.startDate, tournament.endDate]`.
- `sequenceOrder` không được trùng trong cùng một tournament.
- **Tính liên tục thời gian giữa các vòng** (validate mỗi khi tạo Round mới, không phụ thuộc thứ tự tạo):
  - `scheduledDate` phải **sau** race cuối cùng (`MAX(race.scheduledTime)`) của vòng ngay trước đó (theo `sequenceOrder`); nếu vòng trước chưa có race nào thì so sánh với `scheduledDate` của vòng đó.
  - `scheduledDate` phải **trước** `scheduledDate` của vòng kế tiếp (nếu vòng đó đã tồn tại).
  - Đảm bảo các vòng không chồng chéo thời gian dù Admin tạo Round không theo đúng thứ tự `sequenceOrder`.
- Round được tạo với `status = "Upcoming"`, `allocatedPurse = 0`, `races = []`.

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "roundId":         1,
    "name":            "Vòng loại",
    "sequenceOrder":   1,
    "scheduledDate":   "2026-07-03T08:00:00Z",
    "status":          "Upcoming",
    "allocatedPurse":  0,
    "races":           []
  }
}
```

> `allocatedPurse` = tổng `purseAmount` của các Race thuộc vòng này (`SUM(Races.purseAmount)`). Round mới tạo luôn = 0 vì chưa có Race nào.

---

### Test cases — 1 tournament nhiều rounds

| # | Request body | Expected |
|---|-------------|----------|
| ✅ Round 1 hợp lệ | `name="Vòng loại"`, `sequenceOrder=1`, `scheduledDate` trong khoảng giải | 200 |
| ✅ Round 2 hợp lệ | `name="Chung kết"`, `sequenceOrder=2`, `scheduledDate` sau race cuối Round 1 | 200 |
| ✅ Round 3 hợp lệ | `name="Bán kết"`, `sequenceOrder=3`, `scheduledDate` sau race cuối Round 2 | 200 |
| ❌ sequenceOrder trùng | `sequenceOrder=1` lần 2 | 400 — đã tồn tại |
| ❌ scheduledDate trước startDate giải | `"scheduledDate": "2026-06-01T00:00:00Z"` | 400 — ngoài khoảng |
| ❌ scheduledDate sau endDate giải | `"scheduledDate": "2026-08-01T00:00:00Z"` | 400 — ngoài khoảng |
| ❌ scheduledDate trùng/trước race cuối vòng trước | Round 2 có `scheduledDate` ≤ `MAX(race.scheduledTime)` của Round 1 | 400 — phải sau race cuối vòng trước |
| ❌ scheduledDate sau vòng kế tiếp | Tạo Round có `sequenceOrder` xen giữa 2 round đã tồn tại nhưng `scheduledDate` ≥ vòng kế tiếp | 400 — phải trước ngày vòng kế tiếp |
| ❌ name rỗng | `"name": ""` | 400 — Required |
| ❌ tournamentId không tồn tại | `POST /api/tournament/99999/rounds` | 404 |

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | Thiếu `name` hoặc `scheduledDate` | 🟡 Data Annotation |
| 400 | `name` > 100 ký tự | 🟡 Data Annotation |
| 400 | `sequenceOrder` ngoài 1–100 | 🟡 Data Annotation |
| 400 | `scheduledDate` ngoài khoảng tournament | 🔴 Business logic |
| 400 | `sequenceOrder` đã tồn tại trong tournament | 🔴 Business logic |
| 400 | `scheduledDate` không sau race cuối của vòng trước | 🔴 Business logic |
| 400 | `scheduledDate` không trước `scheduledDate` của vòng kế tiếp | 🔴 Business logic |
| 404 | `id` không tồn tại | 🔴 Business logic |

---
---

## 4. Tạo cuộc đua

```
POST /api/rounds/{id}/races
```

**Auth:** Admin · **Path param:** `id` — roundId

---

### Request body

```json
{
  "raceNumber":              1,
  "scheduledTime":           "2026-07-03T09:00:00Z",
  "purseAmount":             30000000,
  "trackTypeOverride":       null,
  "raceDistanceOverride":    null,
  "confirmationCutoffHours": 24,
  "protestDeadlineMinutes":  120
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| raceNumber | int | ≥ 1, không trùng trong round |
| scheduledTime | datetime | Phải ở tương lai, trong `[round.scheduledDate, tournament.endDate]` |
| purseAmount | decimal | ≥ 0; tổng tất cả race ≤ `tournament.purseAmount` |
| trackTypeOverride | string \| null | Tuỳ chọn — override trackType của tournament |
| raceDistanceOverride | int \| null | Tuỳ chọn — override raceDistance, nếu có phải `>1200` và `<2400` |
| confirmationCutoffHours | int | mặc định `24` nếu không truyền |
| protestDeadlineMinutes | int | mặc định `120` nếu không truyền |

---

### Business rules

- `SUM(tất cả race.purseAmount trong tournament) + purseAmount mới ≤ tournament.purseAmount` — kiểm tra mỗi khi tạo race.
- `scheduledTime` phải trong `[round.scheduledDate, tournament.endDate]` và không ở quá khứ.
- Race được tạo với `status = "Upcoming"`.

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "raceId":                  1,
    "roundId":                 1,
    "raceNumber":              1,
    "scheduledTime":           "2026-07-03T09:00:00Z",
    "purseAmount":             30000000,
    "trackTypeOverride":       null,
    "raceDistanceOverride":    null,
    "status":                  "Upcoming",
    "confirmationCutoffHours": 24,
    "protestDeadlineMinutes":  120
  }
}
```

---

### Test cases — 1 round nhiều races

Giả sử: tournament `purseAmount = 300,000,000` — Round 1 (`roundId=1`) có `scheduledDate = 2026-07-03`.

| # | raceNumber | scheduledTime | purseAmount | trackTypeOverride | Expected |
|---|-----------|--------------|------------|-------------------|----------|
| ✅ Race 1 | 1 | 2026-07-03T09:00:00Z | 30,000,000 | null | 200 |
| ✅ Race 2 | 2 | 2026-07-03T11:00:00Z | 30,000,000 | null | 200 |
| ✅ Race 3 (override trackType) | 3 | 2026-07-03T14:00:00Z | 30,000,000 | `"Dirt"` | 200 |
| ❌ raceNumber trùng | 1 | bất kỳ | bất kỳ | | 400 — đã tồn tại |
| ❌ scheduledTime quá khứ | 4 | 2025-01-01T00:00:00Z | 10,000,000 | | 400 — phải ở tương lai |
| ❌ scheduledTime ngoài round | 4 | 2026-06-01T00:00:00Z | 10,000,000 | | 400 — ngoài khoảng |
| ❌ Không truyền confirmationCutoffHours | 4 | hợp lệ | 10,000,000 | | 200 — hệ thống dùng default 24 |
| ❌ Vượt ngân sách giải | 5 | hợp lệ | 250,000,000 | | 400 — vượt ngân sách |

**Test case vượt ngân sách tuần tự (cùng 1 tournament):**

| Race | Round | purseAmount | Tổng tích lũy | Kết quả |
|------|-------|------------|--------------|---------|
| Race 1-1 | 1 | 30,000,000 | 30,000,000 | ✅ |
| Race 1-2 | 1 | 30,000,000 | 60,000,000 | ✅ |
| Race 1-3 | 1 | 30,000,000 | 90,000,000 | ✅ |
| Race 2-1 | 2 | 50,000,000 | 140,000,000 | ✅ |
| Race 2-2 | 2 | 50,000,000 | 190,000,000 | ✅ |
| Race 2-3 | 2 | 80,000,000 | 270,000,000 | ✅ |
| Race thêm | 2 | 50,000,000 | 320,000,000 > 300,000,000 | ❌ 400 |

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | `raceNumber` < 1 | 🟡 Data Annotation |
| 400 | Thiếu `scheduledTime` | 🟡 Data Annotation |
| 400 | `scheduledTime` trong quá khứ hoặc ngoài khoảng | 🔴 Business logic |
| 400 | Tổng purse vượt ngân sách tournament | 🔴 Business logic |
| 400 | `raceNumber` đã tồn tại trong round | 🔴 Business logic |
| 404 | `id` (roundId) không tồn tại | 🔴 Business logic |

---
---

## 5. Danh sách giải đấu

```
GET /api/tournament
```

**Auth:** Không cần

---

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "tournamentId":  10,
      "name":          "Giải Đua Mùa Hè 2026",
      "startDate":     "2026-07-01T08:00:00Z",
      "endDate":       "2026-07-15T18:00:00Z",
      "allowedBreed":  "Thoroughbred",
      "trackType":     "Turf",
      "raceDistance":  1600,
      "raceCategory":  "Open",
      "purseAmount":   300000000,
      "allocatedPurse": 0,
      "remainingPurse": 300000000,
      "status":        "Draft"
    }
  ]
}
```

---
---

## 6. Chi tiết giải đấu

```
GET /api/tournament/{id}
```

**Auth:** Không cần · **Path param:** `id` — tournamentId

---

### Response — 200 OK

Trả về đầy đủ nested: tournament → rounds → races + prizeDistributions.

```json
{
  "success": true,
  "data": {
    "tournamentId":                  10,
    "name":                          "Giải Đua Mùa Hè 2026",
    "description":                   "Giải đấu khu vực phía Nam",
    "startDate":                     "2026-07-01T08:00:00Z",
    "endDate":                       "2026-07-15T18:00:00Z",
    "maxHorses":                     12,
    "allowedBreed":                  "Thoroughbred",
    "trackType":                     "Turf",
    "raceDistance":                  1600,
    "raceCategory":                  "Open",
    "purseAmount":                   300000000,
    "allocatedPurse":                270000000,
    "remainingPurse":                30000000,
    "entryFeeAmount":                5000000,
    "preRaceWeightThresholdKg":      2.0,
    "postRaceWeightDiffThresholdKg": 1.0,
    "status":                        "Draft",
    "createdAt":                     "2026-06-15T07:57:57Z",
    "prizeDistributions": [
      { "position": 1, "percentage": 50 },
      { "position": 2, "percentage": 25 },
      { "position": 3, "percentage": 15 },
      { "position": 4, "percentage": 6 },
      { "position": 5, "percentage": 4 }
    ],
    "rounds": [
      {
        "roundId":         1,
        "name":            "Vòng loại",
        "sequenceOrder":   1,
        "scheduledDate":   "2026-07-03T08:00:00Z",
        "status":          "Upcoming",
        "allocatedPurse":  90000000,
        "races": [
          {
            "raceId":                  1,
            "raceNumber":              1,
            "scheduledTime":           "2026-07-03T09:00:00Z",
            "purseAmount":             30000000,
            "trackTypeOverride":       null,
            "status":                  "Upcoming",
            "confirmationCutoffHours": 24,
            "protestDeadlineMinutes":  120
          },
          {
            "raceId":                  2,
            "raceNumber":              2,
            "scheduledTime":           "2026-07-03T11:00:00Z",
            "purseAmount":             30000000,
            "trackTypeOverride":       null,
            "status":                  "Upcoming",
            "confirmationCutoffHours": 24,
            "protestDeadlineMinutes":  120
          },
          {
            "raceId":                  3,
            "raceNumber":              3,
            "scheduledTime":           "2026-07-03T14:00:00Z",
            "purseAmount":             30000000,
            "trackTypeOverride":       "Dirt",
            "status":                  "Upcoming",
            "confirmationCutoffHours": 24,
            "protestDeadlineMinutes":  120
          }
        ]
      },
      {
        "roundId":         2,
        "name":            "Chung kết",
        "sequenceOrder":   2,
        "scheduledDate":   "2026-07-10T08:00:00Z",
        "status":          "Upcoming",
        "allocatedPurse":  180000000,
        "races": [
          { "raceId": 4, "raceNumber": 1, "purseAmount": 50000000, "status": "Upcoming" },
          { "raceId": 5, "raceNumber": 2, "purseAmount": 50000000, "status": "Upcoming" },
          { "raceId": 6, "raceNumber": 3, "purseAmount": 80000000, "status": "Upcoming" }
        ]
      }
    ]
  }
}
```

---

### Lỗi

| HTTP | Khi nào xảy ra |
|------|----------------|
| 404 | `id` không tồn tại |

---
---

## 7. Cập nhật giải đấu

```
PUT /api/tournament/{id}
```

**Auth:** Admin · **Path param:** `id` — tournamentId

---

### Request body

Chỉ gửi các trường cần cập nhật (partial update).

```json
{
  "name":        "Giải Đua Mùa Hè 2026 (Cập nhật)",
  "purseAmount": 400000000
}
```

---

### Business rules

- Chỉ được cập nhật khi `status ∈ {Draft, Open Registration}`.
- Không cho sửa khi `status ∈ {Closed Registration, Completed, Cancelled}`.
- Cho phép sửa `advancementRule`/`advancementCount` (partial). Riêng cấu hình đi tiếp còn bị chặn thêm nếu giải đã có bất kỳ cuộc đua nào `Official` (progression có thể đã tính) → 400. Rule không hợp lệ hoặc `advancementCount <= 0` → 400.

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "tournamentId": 10,
    "name":         "Giải Đua Mùa Hè 2026 (Cập nhật)",
    "status":       "Draft"
  }
}
```

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | `name` > 200 ký tự | 🟡 Data Annotation |
| 400 | Tournament đang ở trạng thái không cho sửa | 🔴 Business logic |
| 404 | `id` không tồn tại | 🔴 Business logic |

---
---

## 8. Chuyển trạng thái

```
PATCH /api/tournament/{id}/status
```

**Auth:** Admin · **Path param:** `id` — tournamentId

---

### Request body

```json
{ "targetStatus": "Open Registration" }
```

---

### Business rules

Chỉ cho phép transition theo đúng thứ tự (TRN.8):

```
Draft → Open Registration → Closed Registration → Completed
```

- Để chuyển sang `Open Registration`: bắt buộc phải có đủ 5 `prizeDistributions`.
- Để chuyển sang `Closed Registration`: giải phải có **ít nhất 1 Round** và **ít nhất 1 Pairing `Confirmed`** — không áp minimum cứng theo gate capacity (REQ-F-SCH.7: không có ngưỡng tối thiểu). Sau khi đóng, Admin allocate race động theo số pairing thực tế; số race mỗi round điều chỉnh được, không cần chốt từ lúc tạo giải.
- Để chuyển sang `Completed`: **mọi Race** thuộc giải phải đã ở `Official` hoặc `Cancelled` (TRN.8 AC#3) — nếu còn race chưa kết thúc → 400.
- **Không nhận** `targetStatus` là trạng thái cấp Race (`Pre-Race`, `Live`, `In-Progress`, `Unofficial`, `Official`) → 400 (TRN.8 AC#2).
- Không thể nhảy cóc, không thể lùi lại.
- Trạng thái `Completed` không có đường đi tiếp; `Cancelled` đi qua endpoint hủy giải (#9), không qua endpoint này.
- Mỗi lần chuyển trạng thái thành công đều ghi `AuditLogs` (action `Change_Tournament_Status`).

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "tournamentId": 10,
    "status":       "Open Registration"
  }
}
```

---

### Test cases — chuỗi transition

| # | Từ | Sang | Điều kiện | Expected |
|---|----|------|-----------|----------|
| ✅ | Draft | Open Registration | Có đủ 5 prize distributions | 200 |
| ✅ | Open Registration | Closed Registration | — | 200 |
| ✅ | Closed Registration | Completed | Mọi Race đã Official/Cancelled | 200 |
| ❌ | Closed Registration | Completed | Còn Race chưa kết thúc | 400 |
| ❌ | Draft | Open Registration | Chưa có prize distributions | 400 |
| ❌ | Closed Registration | Pre-Race | Trạng thái cấp Race | 400 |
| ❌ | Open Registration | In-Progress | Trạng thái cấp Race | 400 |
| ❌ | Draft | Completed | Nhảy cóc | 400 |
| ❌ | Open Registration | Draft | Lùi lại | 400 |
| ❌ | Completed | bất kỳ | Đã hoàn thành | 400 |

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | `targetStatus` không được phép từ trạng thái hiện tại | 🔴 Business logic |
| 400 | Chuyển sang `Open Registration` khi chưa có prize distributions | 🔴 Business logic |
| 404 | `id` không tồn tại | 🔴 Business logic |

---
---

## 9. Hủy giải đấu

```
DELETE /api/tournament/{id}
```

**Auth:** Admin · **Path param:** `id` — tournamentId

---

### Business rules (TRN.10 — Cancellation Flow, toàn bộ trong 1 transaction)

- Không xóa khỏi DB (soft-delete) — chuyển `Tournament.status = "Cancelled"`.
- Không thể hủy giải đã `Completed`.
- Cascade trong cùng transaction (lỗi bất kỳ bước → ROLLBACK toàn bộ):
  1. Mọi `Race` → `Cancelled`.
  2. Mọi `RaceEntry` → `Cancelled`; entry đang `Paid` → `EntryFeeStatus = "Refund Pending"`, kèm **Notification cho Owner** + `AuditLogs` (action `Update_Entry_Fee_Status`).
  3. Mọi `Prediction` đang `Pending` → `Refunded`; hoàn `PointsPlaced` vào `Wallet.Balance` của Spectator + ghi sổ cái `VirtualPointsTransactions` (type `Prediction Refund`) + Notification.
  4. Mọi `Pairing` của giải (chưa `Cancelled`/`Declined`) → `Cancelled`.
  5. Ghi `AuditLogs` action `Cancel_Tournament`.

> FE: sau khi hủy thành công, các màn hình roster/pairing/entry/prediction của giải nên refetch — trạng thái đã đổi hàng loạt.

---

### Response — 200 OK

```json
{
  "success": true,
  "message": "Huy giai dau thanh cong"
}
```

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | Tournament đã `Completed` | 🔴 Business logic |
| 404 | `id` không tồn tại | 🔴 Business logic |

---
---

## 10. Đăng ký tham gia giải (Roster — TRN.11)

> Roster là danh sách thành viên (Owner/Jockey/Doctor/Referee) tham gia **một giải cụ thể**. Việc duyệt chứng chỉ/bằng cấp là GLOBAL (Module A) — roster chỉ quản lý việc tham gia giải này.

### 10.1 — Tự đăng ký tham gia giải

```
POST /api/tournament/{tournamentId}/participants
```

**Auth:** `Owner` | `Jockey` | `Doctor` | `Referee` (userId lấy từ JWT, không gửi trong body) · **Body:** không có

#### Business rules (auto-screening)

- Giải phải đang ở `Open Registration` → nếu không: 400.
- Mỗi user chỉ 1 bản ghi/giải (UNIQUE `TournamentId + UserId`) → đăng ký lại: 400.
- Profile phải hợp lệ: Owner cần `OwnerProfile`; Jockey/Doctor/Referee cần profile `Status = Active` (đã duyệt global) → nếu chưa: 400.
- **Kết quả screening:**
  - **Owner Active** → `screeningStatus = "AutoEligible"`, `status = "Approved"` ngay (KHÔNG vào queue duyệt).
  - **Jockey/Doctor/Referee Active** → `screeningStatus = "AutoEligible"`, `status = "Pending"` → vào **bulk approval queue** chờ Admin duyệt.

#### Response — 200 OK

```json
{
  "success": true,
  "message": "Đăng ký tham gia giải thành công, chờ Admin duyệt.",
  "data": {
    "participantId":   5,
    "tournamentId":    10,
    "tournamentName":  "Giải Đua Mùa Hè 2026",
    "userId":          42,
    "fullName":        "Nguyễn Văn A",
    "email":           "a@example.com",
    "role":            "Jockey",
    "status":          "Pending",
    "screeningStatus": "AutoEligible",
    "screeningReason": "Hồ sơ Active → đủ điều kiện sơ bộ, chờ Admin duyệt cuối.",
    "rejectionReason": null,
    "registeredAt":    "2026-06-28T09:00:00Z",
    "approvedAt":      null
  }
}
```

> Với Owner: `status = "Approved"`, `approvedAt` có giá trị, `message` báo đã tự động phê duyệt.

#### Lỗi

| HTTP | Khi nào xảy ra |
|------|----------------|
| 400 | Giải không ở `Open Registration` / đã đăng ký rồi / profile chưa Active |
| 401 | Chưa đăng nhập |
| 403 | Role không thuộc Owner/Jockey/Doctor/Referee |
| 404 | `tournamentId` không tồn tại |

---

### 10.2 — Admin xem roster

```
GET /api/tournament/{tournamentId}/participants?role=Jockey&status=Pending
```

**Auth:** Admin · **Query (tuỳ chọn):** `role`, `status`

- FE dùng `status=Pending` để dựng **bulk approval queue**.
- Trả về mảng `ParticipantResponseDto` (cấu trúc như 10.1), sắp xếp theo `role` rồi `registeredAt` giảm dần.

---

### 10.3 — User xem các giải mình đã đăng ký

```
GET /api/my/tournament-participations
```

**Auth:** Authenticated (mọi role) — trả về mọi bản ghi roster của user hiện tại (mọi trạng thái).

---

### 10.4 — Admin duyệt tham gia

```
PATCH /api/admin/tournament-participants/{participantId}/approve
```

**Auth:** Admin · **Body:** không có → set `status = "Approved"`, `approvedBy`, `approvedAt`.

- Gửi Notification đến người đăng ký **(in-app + email)**: `title = "Đăng ký tham gia giải được duyệt"`, `relatedEntityType = "TournamentParticipant"`.

| HTTP | Khi nào xảy ra |
|------|----------------|
| 400 | Đã `Approved` trước đó |
| 404 | `participantId` không tồn tại |

---

### 10.5 — Admin từ chối tham gia

```
PATCH /api/admin/tournament-participants/{participantId}/reject
```

**Auth:** Admin

```json
{ "reason": "Hồ sơ chưa đủ điều kiện tham gia giải này" }
```

- `reason` bắt buộc, **≥ 10 ký tự** → set `status = "Rejected"`, `rejectionReason`.
- Gửi Notification đến người đăng ký **(in-app + email)** kèm lý do: `title = "Đăng ký tham gia giải bị từ chối"`, `relatedEntityType = "TournamentParticipant"`.

| HTTP | Khi nào xảy ra |
|------|----------------|
| 400 | `reason` < 10 ký tự / đã `Rejected` |
| 404 | `participantId` không tồn tại |
