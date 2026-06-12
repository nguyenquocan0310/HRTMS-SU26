# API Contract — Module B: Quản lý Giải đấu

**Phiên bản:** 1.0  
**Base URL:** `http://localhost:5000/api`  
**Auth header:** `Authorization: Bearer <jwt_token>`

---

## Quy ước chung

| Mục | Giá trị |
|-----|---------|
| Content-Type | `application/json` |
| Định dạng thời gian | ISO 8601 — `2026-06-13T10:00:00Z` |
| Kiểu ID | integer |
| Cấu trúc lỗi | `{ "error": "<MÃ_LỖI>", "message": "<mô tả>" }` |

**Trạng thái Tournament:** `Draft` · `Open Registration` · `Closed Registration` · `Pre-Race` · `In-Progress` · `Completed`  
**Trạng thái Round:** `Upcoming` · `In-Progress` · `Completed` · `Cancelled`  
**Trạng thái Race:** `Upcoming` · `Live` · `Unofficial` · `Official` · `Cancelled`

---

## Danh sách Endpoint

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | POST | `/api/tournaments` | Admin | Tạo giải đấu mới |
| 2 | GET | `/api/tournaments` | Mọi role | Danh sách giải đấu |
| 3 | GET | `/api/tournaments/{id}` | Mọi role | Chi tiết giải đấu |
| 4 | PATCH | `/api/tournaments/{id}` | Admin | Cập nhật thông tin giải |
| 5 | PATCH | `/api/tournaments/{id}/publish` | Admin | Chuyển `Draft` → `Open Registration` |
| 6 | POST | `/api/tournaments/{id}/rounds` | Admin | Tạo vòng đấu |
| 7 | POST | `/api/rounds/{id}/races` | Admin | Tạo cuộc đua trong vòng |
| 8 | GET | `/api/rounds/{id}/races` | Mọi role | Danh sách cuộc đua trong vòng |

---
---

## 1. Tạo giải đấu

```
POST /api/tournaments
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
  "allowedBreed":                  "Thoroughbred",
  "trackType":                     "Turf",
  "raceDistance":                  1600,
  "raceCategory":                  "Open",
  "maxHorses":                     12,
  "minJockeyExperienceYears":      2,
  "purseAmount":                   500000000,
  "entryFeeAmount":                5000000,
  "preRaceWeightThresholdKg":      2.0,
  "postRaceWeightDiffThresholdKg": 1.0,
  "prizeDistributions": [
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
| name | string | Bắt buộc, tối đa 150 ký tự |
| description | string | Tuỳ chọn |
| startDate | datetime | Phải sau thời điểm tạo |
| endDate | datetime | Phải sau `startDate` |
| allowedBreed | string | `Thoroughbred` \| `Arabian` \| `Quarter Horse` \| `Mixed` |
| trackType | string | `Turf` \| `Dirt` \| `Synthetic` |
| raceDistance | int | `1200` \| `1600` \| `2000` \| `2400` (mét) |
| raceCategory | string | `Open` \| `Classic` \| `Maiden` |
| maxHorses | int | > 0 — số ngựa tối đa mỗi Race (EC-46) |
| minJockeyExperienceYears | int | >= 0 |
| purseAmount | decimal | > 0, đơn vị VNĐ |
| entryFeeAmount | decimal | >= 0 (mặc định `0` = miễn phí) |
| preRaceWeightThresholdKg | decimal | > 0, mặc định `2.0` kg (EC-39) |
| postRaceWeightDiffThresholdKg | decimal | > 0, mặc định `1.0` kg (EC-39) |
| prizeDistributions | array | Đúng 5 phần tử (position 1–5), tổng `percentage` = 100 |

---

### Business rules

- Tournament được tạo với `Status = Draft`.
- `prizeDistributions` validate tổng = 100% ngay khi lưu (EC-33).
- Tổng `Race.PurseAmount` không được vượt `Tournament.PurseAmount` — kiểm tra lại mỗi khi tạo Race (EC-34).
- `entryFeeAmount = 0`: toàn bộ luồng xác nhận phí bị bỏ qua, `RaceEntry.EntryFeeStatus` tự động `Paid`.

---

### Response — 201 Created

```json
{
  "tournamentId": 10,
  "name":         "Giải Đua Mùa Hè 2026",
  "status":       "Draft",
  "createdAt":    "2026-06-13T09:00:00Z"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu field hoặc sai ràng buộc. Kèm `fields: [{ field, message }]` |
| 400 | `INVALID_DATE_RANGE` | `endDate` không sau `startDate` |
| 400 | `INVALID_BREED` | `allowedBreed` không hợp lệ |
| 400 | `INVALID_DISTANCE` | `raceDistance` không phải 1200/1600/2000/2400 |
| 400 | `PRIZE_SUM_INVALID` | Tổng `percentage` ≠ 100 |
| 403 | `FORBIDDEN` | Không phải Admin |

---
---

## 2. Danh sách giải đấu

```
GET /api/tournaments
```

**Auth:** Mọi role (đã đăng nhập)

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| status | string | — | Lọc theo trạng thái |
| breed | string | — | Lọc theo `allowedBreed` |
| page | int | 1 | |
| pageSize | int | 20 | Tối đa 100 |

---

### Response — 200 OK

```json
{
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
      "purseAmount":   500000000,
      "status":        "Open Registration"
    }
  ],
  "pagination": {
    "page":       1,
    "pageSize":   20,
    "total":      5,
    "totalPages": 1
  }
}
```

---
---

## 3. Chi tiết giải đấu

```
GET /api/tournaments/{id}
```

**Auth:** Mọi role (đã đăng nhập)

**Path param:** `id` — tournamentId (integer)

---

### Response — 200 OK

```json
{
  "tournamentId":                  10,
  "name":                          "Giải Đua Mùa Hè 2026",
  "description":                   "Giải đấu khu vực phía Nam",
  "startDate":                     "2026-07-01T08:00:00Z",
  "endDate":                       "2026-07-15T18:00:00Z",
  "allowedBreed":                  "Thoroughbred",
  "trackType":                     "Turf",
  "raceDistance":                  1600,
  "raceCategory":                  "Open",
  "maxHorses":                     12,
  "minJockeyExperienceYears":      2,
  "purseAmount":                   500000000,
  "entryFeeAmount":                5000000,
  "preRaceWeightThresholdKg":      2.0,
  "postRaceWeightDiffThresholdKg": 1.0,
  "status":                        "Open Registration",
  "createdAt":                     "2026-06-13T09:00:00Z",
  "prizeDistributions": [
    { "position": 1, "percentage": 50 },
    { "position": 2, "percentage": 25 },
    { "position": 3, "percentage": 15 },
    { "position": 4, "percentage": 6 },
    { "position": 5, "percentage": 4 }
  ],
  "rounds": [
    {
      "roundId":       3,
      "name":          "Vòng loại",
      "sequenceOrder": 1,
      "scheduledDate": "2026-07-01T08:00:00Z",
      "status":        "Upcoming",
      "raceCount":     2
    }
  ]
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 404 | `TOURNAMENT_NOT_FOUND` | `id` không tồn tại |

---
---

## 4. Cập nhật giải đấu

```
PATCH /api/tournaments/{id}
```

**Auth:** Admin

**Path param:** `id` — tournamentId (integer)

---

### Request body

Chỉ gửi các trường cần cập nhật.

```json
{
  "name":        "Giải Đua Mùa Hè 2026 (Cập nhật)",
  "description": "Mô tả mới",
  "purseAmount": 600000000
}
```

---

### Business rules

- Chỉ được cập nhật khi `Status = Draft`.
- Không thay đổi `allowedBreed` sau khi đã có Horse entry (BR-01).
- Giảm `purseAmount` xuống thấp hơn tổng `Race.PurseAmount` hiện có → từ chối (EC-34).

---

### Response — 200 OK

```json
{
  "tournamentId": 10,
  "message":      "Cập nhật thành công"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Sai ràng buộc field |
| 400 | `PURSE_BELOW_COMMITTED` | `purseAmount` mới nhỏ hơn tổng purse các Race đã tạo |
| 403 | `FORBIDDEN` | Không phải Admin |
| 404 | `TOURNAMENT_NOT_FOUND` | `id` không tồn tại |
| 409 | `INVALID_STATUS` | Tournament không ở trạng thái `Draft` |

---
---

## 5. Công bố giải đấu

```
PATCH /api/tournaments/{id}/publish
```

Chuyển `Draft` → `Open Registration`, mở đăng ký ngựa.

**Auth:** Admin

**Path param:** `id` — tournamentId (integer)

**Request body:** Không có

---

### Business rules

- Tournament phải có ít nhất 1 Round và 1 Race trước khi publish.
- `prizeDistributions` phải hợp lệ (5 position, tổng = 100%).
- Sau khi publish, các trường `allowedBreed`, `startDate`, `endDate` bị khóa, không chỉnh sửa được.
- Ghi `AuditLog` action `Publish_Tournament`.

---

### Response — 200 OK

```json
{
  "tournamentId": 10,
  "status":       "Open Registration",
  "message":      "Giải đấu đã được công bố"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 403 | `FORBIDDEN` | Không phải Admin |
| 404 | `TOURNAMENT_NOT_FOUND` | `id` không tồn tại |
| 409 | `INVALID_STATUS` | Tournament không ở trạng thái `Draft` |
| 422 | `NO_RACE_DEFINED` | Chưa có Race nào trong tournament |
| 422 | `PRIZE_CONFIG_INCOMPLETE` | `prizeDistributions` chưa đủ hoặc tổng ≠ 100 |

---
---

## 6. Tạo vòng đấu

```
POST /api/tournaments/{id}/rounds
```

**Auth:** Admin

**Path param:** `id` — tournamentId (integer)

---

### Request body

```json
{
  "name":          "Vòng loại",
  "sequenceOrder": 1,
  "scheduledDate": "2026-07-01T08:00:00Z"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| name | string | Bắt buộc, tối đa 100 ký tự |
| sequenceOrder | int | > 0, unique trong tournament |
| scheduledDate | datetime | Trong `[Tournament.startDate, Tournament.endDate]` |

---

### Business rules

- `scheduledDate` phải nằm trong khoảng `[Tournament.startDate, Tournament.endDate]` (EC-35).
- `sequenceOrder` không được trùng trong cùng một tournament.

---

### Response — 201 Created

```json
{
  "roundId":       3,
  "name":          "Vòng loại",
  "sequenceOrder": 1,
  "scheduledDate": "2026-07-01T08:00:00Z",
  "status":        "Upcoming"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu field hoặc sai ràng buộc |
| 400 | `SCHEDULE_OUT_OF_RANGE` | `scheduledDate` ngoài khoảng tournament |
| 404 | `TOURNAMENT_NOT_FOUND` | `id` không tồn tại |
| 409 | `SEQUENCE_CONFLICT` | `sequenceOrder` đã tồn tại trong tournament |

---
---

## 7. Tạo cuộc đua

```
POST /api/rounds/{id}/races
```

**Auth:** Admin

**Path param:** `id` — roundId (integer)

---

### Request body

```json
{
  "raceNumber":             1,
  "scheduledTime":          "2026-07-01T09:00:00Z",
  "purseAmount":            50000000,
  "trackTypeOverride":      null,
  "raceDistanceOverride":   null,
  "confirmationCutoffHours": 24,
  "protestDeadlineMinutes":  120
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| raceNumber | int | > 0, unique trong round |
| scheduledTime | datetime | Trong `[Round.scheduledDate, Tournament.endDate]`, không ở quá khứ |
| purseAmount | decimal | > 0; tổng tất cả Race ≤ `Tournament.purseAmount` |
| trackTypeOverride | string \| null | Tuỳ chọn — override `trackType` của tournament. `Turf`/`Dirt`/`Synthetic` |
| raceDistanceOverride | int \| null | Tuỳ chọn — override `raceDistance`. Phải là `1200`/`1600`/`2000`/`2400` |
| confirmationCutoffHours | int | > 0, mặc định `24` |
| protestDeadlineMinutes | int | > 0, mặc định `120` |

---

### Business rules

- `SUM(tất cả Race.PurseAmount trong tournament) + purseAmount mới ≤ Tournament.PurseAmount` (EC-34). Vượt → từ chối.
- `scheduledTime` nằm trong `[Round.scheduledDate, Tournament.endDate]` và không ở quá khứ (EC-35).
- Sau khi `IsPostPositionDrawn = true` hoặc đã có Prediction, các trường `scheduledTime`, `trackTypeOverride`, `raceDistanceOverride` bị **khóa** (EC-48). Muốn thay đổi phải hủy race, hoàn toàn bộ điểm dự đoán.

---

### Response — 201 Created

```json
{
  "raceId":                 15,
  "raceNumber":             1,
  "scheduledTime":          "2026-07-01T09:00:00Z",
  "purseAmount":            50000000,
  "status":                 "Upcoming",
  "isPostPositionDrawn":    false,
  "isPredictionGateClosed": false
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu field hoặc sai ràng buộc |
| 400 | `PURSE_EXCEEDED` | Tổng purse vượt ngân sách tournament |
| 400 | `SCHEDULE_OUT_OF_RANGE` | `scheduledTime` ngoài khoảng hợp lệ |
| 400 | `INVALID_DISTANCE_OVERRIDE` | `raceDistanceOverride` không phải 1200/1600/2000/2400 |
| 404 | `ROUND_NOT_FOUND` | `id` không tồn tại |
| 409 | `RACE_NUMBER_CONFLICT` | `raceNumber` đã tồn tại trong round |

---
---

## 8. Danh sách cuộc đua trong vòng

```
GET /api/rounds/{id}/races
```

**Auth:** Mọi role (đã đăng nhập)

**Path param:** `id` — roundId (integer)

---

### Response — 200 OK

```json
{
  "roundId": 3,
  "races": [
    {
      "raceId":                  15,
      "raceNumber":              1,
      "scheduledTime":           "2026-07-01T09:00:00Z",
      "purseAmount":             50000000,
      "trackTypeOverride":       null,
      "raceDistanceOverride":    null,
      "status":                  "Upcoming",
      "isPostPositionDrawn":     false,
      "isPredictionGateClosed":  false,
      "currentEntries":          4
    }
  ]
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 404 | `ROUND_NOT_FOUND` | `id` không tồn tại |
