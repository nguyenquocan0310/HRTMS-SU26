# API Contract — Module B: Quản lý Giải đấu

**Phiên bản:** 2.0 (cập nhật theo implementation thực tế)
**Base URL:** `http://localhost:5000/api`
**Auth header:** `Authorization: Bearer <jwt_token>`

---

## Quy ước chung

| Mục | Giá trị |
|-----|---------|
| Content-Type | `application/json` |
| Định dạng thời gian | ISO 8601 — `2026-06-13T10:00:00Z` |
| Kiểu ID | integer |
| Cấu trúc response | `{ "success": true/false, "message": "...", "data": {...} }` |

**Trạng thái Tournament:** `Draft` → `Open Registration` → `Closed Registration` → `Pre-Race` → `In-Progress` → `Completed` (một chiều, không lùi lại)
**Trạng thái Round:** `Upcoming` · `In-Progress` · `Completed` · `Cancelled`
**Trạng thái Race:** `Upcoming` · `Live` · `Unofficial` · `Official` · `Cancelled`

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
| 9 | DELETE | `/api/tournament/{id}` | Admin | Hủy giải đấu |

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
| raceDistance | int | 100–10000 (mét) |
| raceCategory | string | `Open` \| `Classic` \| `Maiden` |
| minJockeyExperienceYears | int | 0–50 |
| purseAmount | decimal | ≥ 0 |
| entryFeeAmount | decimal | ≥ 0, mặc định `0` (miễn phí) |
| preRaceWeightThresholdKg | decimal | mặc định `2.0` kg |
| postRaceWeightDiffThresholdKg | decimal | mặc định `1.0` kg |

---

### Business rules

- Tournament được tạo với `status = "Draft"`, `createdAt = UtcNow`.
- `entryFeeAmount = 0`: toàn bộ luồng xác nhận phí bị bỏ qua, `RaceEntry.EntryFeeStatus` tự động `"Paid"`.
- `prizeDistributions` **không** được gửi trong request này — cấu hình riêng ở endpoint 2.

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
    "entryFeeAmount":                5000000,
    "preRaceWeightThresholdKg":      2.0,
    "postRaceWeightDiffThresholdKg": 1.0,
    "status":                        "Draft",
    "createdAt":                     "2026-06-15T07:57:57Z",
    "rounds":                        [],
    "prizeDistributions":            []
  }
}
```

---

### Lỗi

| HTTP | Khi nào xảy ra | Loại |
|------|----------------|------|
| 400 | Thiếu field bắt buộc (`name`, `startDate`, `endDate`, v.v.) | 🟡 Data Annotation |
| 400 | `name` > 200 ký tự | 🟡 Data Annotation |
| 400 | `maxHorses` < 1 | 🟡 Data Annotation |
| 400 | `raceDistance` ngoài 100–10000 | 🟡 Data Annotation |
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
- Round được tạo với `status = "Upcoming"`, `races = []`.

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "roundId":       1,
    "name":          "Vòng loại",
    "sequenceOrder": 1,
    "scheduledDate": "2026-07-03T08:00:00Z",
    "status":        "Upcoming",
    "races":         []
  }
}
```

---

### Test cases — 1 tournament nhiều rounds

| # | Request body | Expected |
|---|-------------|----------|
| ✅ Round 1 hợp lệ | `name="Vòng loại"`, `sequenceOrder=1`, `scheduledDate` trong khoảng giải | 200 |
| ✅ Round 2 hợp lệ | `name="Chung kết"`, `sequenceOrder=2`, `scheduledDate` trong khoảng giải | 200 |
| ✅ Round 3 hợp lệ | `name="Bán kết"`, `sequenceOrder=3`, `scheduledDate` trong khoảng giải | 200 |
| ❌ sequenceOrder trùng | `sequenceOrder=1` lần 2 | 400 — đã tồn tại |
| ❌ scheduledDate trước startDate giải | `"scheduledDate": "2026-06-01T00:00:00Z"` | 400 — ngoài khoảng |
| ❌ scheduledDate sau endDate giải | `"scheduledDate": "2026-08-01T00:00:00Z"` | 400 — ngoài khoảng |
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
  "protestDeadlineMinutes":  30
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| raceNumber | int | ≥ 1, không trùng trong round |
| scheduledTime | datetime | Phải ở tương lai, trong `[round.scheduledDate, tournament.endDate]` |
| purseAmount | decimal | ≥ 0; tổng tất cả race ≤ `tournament.purseAmount` |
| trackTypeOverride | string \| null | Tuỳ chọn — override trackType của tournament |
| raceDistanceOverride | int \| null | Tuỳ chọn — override raceDistance |
| confirmationCutoffHours | int | mặc định `24` nếu không truyền |
| protestDeadlineMinutes | int | mặc định `30` nếu không truyền |

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
    "protestDeadlineMinutes":  30
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
        "roundId":       1,
        "name":          "Vòng loại",
        "sequenceOrder": 1,
        "scheduledDate": "2026-07-03T08:00:00Z",
        "status":        "Upcoming",
        "races": [
          {
            "raceId":                  1,
            "raceNumber":              1,
            "scheduledTime":           "2026-07-03T09:00:00Z",
            "purseAmount":             30000000,
            "trackTypeOverride":       null,
            "status":                  "Upcoming",
            "confirmationCutoffHours": 24,
            "protestDeadlineMinutes":  30
          },
          {
            "raceId":                  2,
            "raceNumber":              2,
            "scheduledTime":           "2026-07-03T11:00:00Z",
            "purseAmount":             30000000,
            "trackTypeOverride":       null,
            "status":                  "Upcoming",
            "confirmationCutoffHours": 24,
            "protestDeadlineMinutes":  30
          },
          {
            "raceId":                  3,
            "raceNumber":              3,
            "scheduledTime":           "2026-07-03T14:00:00Z",
            "purseAmount":             30000000,
            "trackTypeOverride":       "Dirt",
            "status":                  "Upcoming",
            "confirmationCutoffHours": 24,
            "protestDeadlineMinutes":  30
          }
        ]
      },
      {
        "roundId":       2,
        "name":          "Chung kết",
        "sequenceOrder": 2,
        "scheduledDate": "2026-07-10T08:00:00Z",
        "status":        "Upcoming",
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

- Chỉ được cập nhật khi `status ∈ {Draft, Open Registration, Closed Registration}`.
- Không cho sửa khi `status ∈ {Pre-Race, In-Progress, Completed, Cancelled}`.

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

Chỉ cho phép transition theo đúng thứ tự:

```
Draft → Open Registration → Closed Registration → Pre-Race → In-Progress → Completed
```

- Để chuyển sang `Open Registration`: bắt buộc phải có đủ 5 `prizeDistributions`.
- Không thể nhảy cóc, không thể lùi lại.
- Trạng thái `Completed` không có đường đi tiếp.

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
| ✅ | Closed Registration | Pre-Race | — | 200 |
| ✅ | Pre-Race | In-Progress | — | 200 |
| ✅ | In-Progress | Completed | — | 200 |
| ❌ | Draft | Open Registration | Chưa có prize distributions | 400 |
| ❌ | Draft | Completed | Nhảy cóc | 400 |
| ❌ | Draft | Pre-Race | Nhảy cóc | 400 |
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

### Business rules

- Không xóa khỏi DB — chuyển `status = "Cancelled"`.
- Không thể hủy giải đã `Completed`.
- Hoàn điểm dự đoán (`PointsPlaced`) vào `Wallet.Balance` của Spectator nếu có Prediction chưa giải quyết.
- Toàn bộ thao tác trong transaction — rollback nếu có lỗi.

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
