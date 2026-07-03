# API Contract — Module D: Quản lý Nài ngựa (Jockey)

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

**Trạng thái JockeyProfile:** `Pending` · `Active` · `Suspended` · `Rejected`  
**Trạng thái Pairing:** `Pending` · `Accepted` · `Declined`  
**HealthStatus:** `Good` · `Fair` · `Under Treatment`

---

## Danh sách Endpoint

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | GET | `/api/jockeys/profile` | Jockey | Xem profile bản thân |
| 2 | PATCH | `/api/jockeys/profile` | Jockey | Cập nhật profile |
| 3 | GET | `/api/jockeys/available` | Owner | Danh sách Jockey khả dụng |
| 4 | POST | `/api/pairings` | Owner | Gửi lời mời ghép cặp |
| 5 | PATCH | `/api/pairings/{id}/accept` | Jockey | Chấp nhận lời mời |
| 6 | PATCH | `/api/pairings/{id}/decline` | Jockey | Từ chối lời mời |
| 7 | GET | `/api/jockeys/invitations` | Jockey | Danh sách lời mời đang chờ |
| 8 | GET | `/api/owner/pairings` | Owner | Danh sách cặp ghép của Owner |
| 9 | GET | `/api/admin/pairings` | Admin | Danh sách pairing để allocate vào Race (filter `tournamentId`/`status` mặc định `Confirmed`/`unallocatedOnly`) → `PagedResult<AdminPairingDto>` |

---
---

## 1. Xem profile Jockey

```
GET /api/jockeys/profile
```

Trả profile của Jockey đang đăng nhập.

**Auth:** Jockey

---

### Response — 200 OK

```json
{
  "jockeyId":           15,
  "username":           "jockey_01",
  "fullName":           "Nguyen Van B",
  "email":              "jockey01@example.com",
  "licenseCertificate": "JOC-2021-0042",
  "experienceYears":    3,
  "selfDeclaredWeight": 55.5,
  "bloodType":          "O+",
  "healthStatus":       "Good",
  "status":             "Active",
  "createdAt":          "2026-06-10T08:00:00Z"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Jockey |

---
---

## 2. Cập nhật profile Jockey

```
PATCH /api/jockeys/profile
```

**Auth:** Jockey

---

### Request body

Chỉ gửi các trường cần cập nhật.

```json
{
  "selfDeclaredWeight": 56.0,
  "bloodType":          "O+",
  "healthStatus":       "Good",
  "licenseCertificate": "JOC-2021-0042"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| selfDeclaredWeight | decimal | > 0 kg — dùng làm baseline cho EC-39 (pre-race weight check) |
| bloodType | string | Tuỳ chọn, tối đa 5 ký tự |
| healthStatus | string | `Good` \| `Fair` \| `Under Treatment` |
| licenseCertificate | string | Unique trong hệ thống |

---

### Business rules

- `selfDeclaredWeight` là giá trị baseline. Doctor so sánh với `PreRaceJockeyWeight` tại Weigh-In; chênh lệch vượt `Tournament.PreRaceWeightThresholdKg` → cảnh báo (EC-39).
- Thay đổi `licenseCertificate` ghi `AuditLog`.

---

### Response — 200 OK

```json
{
  "jockeyId": 15,
  "message":  "Cập nhật profile thành công"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Sai ràng buộc field |
| 403 | `FORBIDDEN` | Role không phải Jockey |
| 409 | `LICENSE_ALREADY_EXISTS` | `licenseCertificate` đã được dùng bởi Jockey khác |

---
---

## 3. Danh sách Jockey khả dụng

```
GET /api/jockeys/available
```

Trả danh sách Jockey `Active` đủ điều kiện kinh nghiệm cho tournament.

**Auth:** Owner

---

### Query params

| Tham số | Kiểu | Bắt buộc | Ghi chú |
|---------|------|----------|---------|
| tournamentId | int | Bắt buộc | Lọc theo `MinJockeyExperienceYears` của tournament |
| page | int | — | Mặc định 1 |
| pageSize | int | — | Mặc định 20, tối đa 100 |

---

### Business rules

- Chỉ trả Jockey có `Status = Active` (EC-37).
- Lọc `Jockey.ExperienceYears >= Tournament.MinJockeyExperienceYears` (BR-05).
- Không trả Jockey đã bị Owner này gửi lời mời đang `Pending`.

---

### Response — 200 OK

```json
{
  "data": [
    {
      "jockeyId":           15,
      "fullName":           "Nguyen Van B",
      "licenseCertificate": "JOC-2021-0042",
      "experienceYears":    3,
      "healthStatus":       "Good"
    }
  ],
  "pagination": {
    "page":       1,
    "pageSize":   20,
    "total":      8,
    "totalPages": 1
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `MISSING_TOURNAMENT_ID` | `tournamentId` không được cung cấp |
| 403 | `FORBIDDEN` | Role không phải Owner |
| 404 | `TOURNAMENT_NOT_FOUND` | `tournamentId` không tồn tại |

---
---

## 4. Gửi lời mời ghép cặp

```
POST /api/pairings
```

**Auth:** Owner

---

### Request body

```json
{
  "horseId":        8,
  "jockeyId":       15,
  "requestMessage": "Mời tham gia cuộc đua vòng loại ngày 01/07"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| horseId | int | Ngựa phải thuộc Owner này và `AdminApprovalStatus = Approved` |
| jockeyId | int | Jockey phải `Active` |
| requestMessage | string | Tuỳ chọn, tối đa 255 ký tự |

---

### Business rules

- Ngựa (`horseId`) phải thuộc Owner đang gọi.
- Jockey phải `Active` — Jockey `Pending` hoặc `Suspended` không thể nhận lời mời.
- Không cho phép tạo Pairing trùng (cùng `horseId` + `jockeyId`) nếu đã có Pairing `Pending` hoặc `Accepted`.
- Gửi notification đến Jockey qua `INotificationService` **(in-app + email)** — lời mời ghép cặp (SRS Module O).

---

### Response — 201 Created

```json
{
  "pairingId": 31,
  "horseId":   8,
  "jockeyId":  15,
  "status":    "Pending",
  "createdAt": "2026-06-13T10:00:00Z"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu field |
| 403 | `FORBIDDEN` | Role không phải Owner |
| 403 | `HORSE_NOT_OWNED` | `horseId` không thuộc Owner này |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |
| 404 | `JOCKEY_NOT_FOUND` | `jockeyId` không tồn tại |
| 409 | `PAIRING_ALREADY_EXISTS` | Đã có Pairing `Pending`/`Accepted` giữa cặp này |
| 422 | `JOCKEY_NOT_ACTIVE` | Jockey không ở trạng thái `Active` |
| 422 | `HORSE_NOT_APPROVED` | Ngựa chưa được Admin duyệt |

---
---

## 5. Chấp nhận lời mời

```
PATCH /api/pairings/{id}/accept
```

**Auth:** Jockey

**Path param:** `id` — pairingId (integer)

**Request body:** Không có

---

### Business rules

- Pairing phải đang ở trạng thái `Pending`.
- Chỉ Jockey trong pairing đó mới được accept.
- Khi accept: `Status → Accepted`, gửi notification đến Owner **(in-app + email)** để vào xác nhận cuối.

---

### Response — 200 OK

```json
{
  "pairingId": 31,
  "status":    "Accepted",
  "message":   "Đã chấp nhận lời mời ghép cặp"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 403 | `FORBIDDEN` | Role không phải Jockey hoặc không phải Jockey trong pairing này |
| 404 | `PAIRING_NOT_FOUND` | `id` không tồn tại |
| 409 | `INVALID_STATUS` | Pairing không ở trạng thái `Pending` |

---
---

## 6. Từ chối lời mời

```
PATCH /api/pairings/{id}/decline
```

**Auth:** Jockey

**Path param:** `id` — pairingId (integer)

---

### Request body

```json
{
  "responseReason": "Lịch trùng với giải đấu khác"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| responseReason | string | Tuỳ chọn, tối đa 255 ký tự |

---

### Business rules

- Pairing phải đang ở trạng thái `Pending`.
- Chỉ Jockey trong pairing đó mới được decline.
- Khi decline: `Status → Declined`, gửi notification đến Owner **(in-app + email)**.

---

### Response — 200 OK

```json
{
  "pairingId": 31,
  "status":    "Declined",
  "message":   "Đã từ chối lời mời ghép cặp"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 403 | `FORBIDDEN` | Role không phải Jockey hoặc không phải Jockey trong pairing này |
| 404 | `PAIRING_NOT_FOUND` | `id` không tồn tại |
| 409 | `INVALID_STATUS` | Pairing không ở trạng thái `Pending` |

---
---

## 7. Danh sách lời mời (Jockey)

```
GET /api/jockeys/invitations
```

Trả danh sách Pairing gửi đến Jockey đang đăng nhập.

**Auth:** Jockey

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| status | string | — | `Pending` \| `Accepted` \| `Declined` |
| page | int | 1 | |
| pageSize | int | 20 | |

---

### Response — 200 OK

```json
{
  "data": [
    {
      "pairingId":      31,
      "horse": {
        "horseId":  8,
        "name":     "Thunder Storm",
        "breed":    "Thoroughbred"
      },
      "owner": {
        "ownerId":  5,
        "fullName": "Le Van C"
      },
      "requestMessage": "Mời tham gia cuộc đua vòng loại ngày 01/07",
      "status":         "Pending",
      "createdAt":      "2026-06-13T10:00:00Z"
    }
  ],
  "pagination": {
    "page":       1,
    "pageSize":   20,
    "total":      2,
    "totalPages": 1
  }
}
```

---
---

## 8. Danh sách cặp ghép (Owner)

```
GET /api/owner/pairings
```

Trả danh sách Pairing do Owner đang đăng nhập tạo.

**Auth:** Owner

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| status | string | — | `Pending` \| `Accepted` \| `Declined` |
| horseId | int | — | Lọc theo ngựa cụ thể |
| page | int | 1 | |
| pageSize | int | 20 | |

---

### Response — 200 OK

```json
{
  "data": [
    {
      "pairingId": 31,
      "horse": {
        "horseId":  8,
        "name":     "Thunder Storm",
        "breed":    "Thoroughbred"
      },
      "jockey": {
        "jockeyId":           15,
        "fullName":           "Nguyen Van B",
        "licenseCertificate": "JOC-2021-0042",
        "experienceYears":    3
      },
      "status":    "Accepted",
      "createdAt": "2026-06-13T10:00:00Z"
    }
  ],
  "pagination": {
    "page":       1,
    "pageSize":   20,
    "total":      3,
    "totalPages": 1
  }
}
```

---
---

## Ghi chú — Kiểm tra kinh nghiệm (EC-21)

Kiểm tra `Jockey.ExperienceYears >= Tournament.MinJockeyExperienceYears` được thực hiện tại **hai thời điểm**:

1. Khi Owner tìm kiếm Jockey (`GET /api/jockeys/available`) — lọc ngay danh sách.
2. Khi đưa Pairing vào RaceEntry (Module E) — tái kiểm tra bắt buộc vì Pairing là độc lập với giải đấu; lúc tạo RaceEntry mới xác định được tournament cụ thể.

Không kiểm tra ở bước gửi lời mời vì Pairing chưa gắn với tournament nào.

---

## Ghi chú — Khai báo quan hệ gia đình (EC-18)

Jockey **bắt buộc** khai báo quan hệ gia đình ruột thịt tại bước đăng ký. Dữ liệu lưu trong bảng `FamilyRelationshipDeclarations`:

| Trường | Giá trị hợp lệ |
|--------|----------------|
| relationType | `Spouse` \| `Parent` \| `Child` \| `Sibling` |
| relatedUserId | userId trong hệ thống (nullable nếu người thân chưa có tài khoản) |
| industryRole | Role trong ngành đua ngựa (Owner, Jockey, ...) |

Dữ liệu này được dùng tại Module G (Jockey Independence Check) và Module F (Referee COI Check).
