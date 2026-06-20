# API Contract — Module C: Đăng ký Ngựa & Duyệt Hồ sơ

**Phiên bản:** 1.0  
**Base URL:** `http://localhost:5000/api`  
**Auth header:** `Authorization: Bearer <jwt_token>`

---

## Quy ước chung

| Mục | Giá trị |
|-----|---------|
| Content-Type | `application/json` |
| Định dạng thời gian | ISO 8601 — `2026-06-20T10:00:00Z` |
| Định dạng ngày | `YYYY-MM-DD` — dùng cho `dopingTestDate` |
| Kiểu ID | integer |
| Cấu trúc lỗi | `{ "error": "<MÃ_LỖI>", "message": "<mô tả>" }` |

**Trạng thái AdminApprovalStatus (Horse):** `Pending` · `Approved` · `Rejected`  
**Trạng thái Status (Horse):** `Declared` · `Inactive`  
**DopingTestResult:** `Clean` · `Pending` · `Failed`  
**Gender:** `Stallion` · `Colt` · `Mare` · `Filly`  
**EntryFeeStatus (RaceEntry):** `Unpaid` · `Paid` · `Refund Pending` · `Refunded`  
**Trạng thái RaceEntry:** `Pending` · `Confirmed` · `Cancelled` · `Disqualified`

> **Lưu ý kiến trúc:** `RaceEntry` không link thẳng vào `Horse` mà link qua `Pairing` (Horse + Jockey).  
> Chuỗi quan hệ: `Race → RaceEntry → Pairing → Horse`. Việc tạo RaceEntry yêu cầu `Pairing` đã tồn tại (xem Module D).  
> Auto-reject theo breed phải trace: `Race → Round → Tournament → AllowedBreed`.

---

## Danh sách Endpoint

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | POST | `/api/horses` | Owner | Khai báo hồ sơ ngựa mới |
| 2 | GET | `/api/horses/my` | Owner | Danh sách ngựa của Owner |
| 3 | GET | `/api/horses/{id}` | Owner | Chi tiết một con ngựa |
| 4 | PUT | `/api/horses/{id}` | Owner | Cập nhật hồ sơ ngựa (trigger re-validate) |
| 5 | GET | `/api/admin/horses/pending` | Admin | Danh sách hồ sơ ngựa chờ duyệt |
| 6 | GET | `/api/admin/horses/{id}` | Admin | Chi tiết hồ sơ ngựa (Admin view) |
| 7 | PATCH | `/api/admin/horses/{id}/approve` | Admin | Phê duyệt hồ sơ ngựa |
| 8 | PATCH | `/api/admin/horses/{id}/reject` | Admin | Từ chối hồ sơ ngựa |
| 9 | POST | `/api/race-entries` | Owner | Đăng ký ngựa (Pairing) vào Race cụ thể |
| 10 | GET | `/api/race-entries/my` | Owner | Danh sách race entry của Owner |
| 11 | GET | `/api/admin/race-entries/pending-fee` | Admin | Danh sách entries chờ xác nhận phí |
| 12 | PATCH | `/api/admin/race-entries/{id}/confirm-fee` | Admin | Xác nhận đã nhận lệ phí |
| 13 | PATCH | `/api/admin/race-entries/{id}/approve` | Admin | Phê duyệt entry tham gia race |

---
---

## 1. Khai báo hồ sơ ngựa mới

```
POST /api/horses
```

Horse Owner khai báo hồ sơ hành chính và thông số y tế của ngựa. Yêu cầu tích cam kết pháp lý (EC-22).

**Auth:** Owner

---

### Request body

```json
{
  "name":                  "Thunder",
  "birthYear":             2020,
  "gender":                "Stallion",
  "color":                 "Black",
  "pedigree":              "Secretariat x Winning Colors",
  "weight":                520.50,
  "identifyingMarks":      "Sao trắng trán, cẳng chân trái sau trắng",
  "breed":                 "Thoroughbred",
  "vaccinationRecordRef":  "VAC-2024-001",
  "dopingTestDate":        "2024-06-10",
  "dopingTestResult":      "Clean",
  "legalConsentAccepted":  true
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| name | string | Bắt buộc, 1–100 ký tự |
| birthYear | int | Bắt buộc, 1900 ≤ value ≤ năm hiện tại |
| gender | string | Bắt buộc, enum `Stallion` \| `Colt` \| `Mare` \| `Filly` |
| color | string | Bắt buộc, 1–50 ký tự |
| pedigree | string | Tuỳ chọn, tối đa 255 ký tự |
| weight | decimal | Bắt buộc, > 0, tối đa 2 chữ số thập phân |
| identifyingMarks | string | Bắt buộc, 1–255 ký tự |
| breed | string | Bắt buộc, tối đa 30 ký tự — so khớp với `Tournament.AllowedBreed` khi duyệt |
| vaccinationRecordRef | string | Bắt buộc, 1–100 ký tự |
| dopingTestDate | string | Bắt buộc, format `YYYY-MM-DD`, không được ở tương lai |
| dopingTestResult | string | Bắt buộc, enum `Clean` \| `Pending` \| `Failed` |
| legalConsentAccepted | bool | **Bắt buộc phải là `true`** — nếu `false` hoặc thiếu → 400 |

---

### Business rules

- `age` được tính tự động ở backend: `age = currentYear − birthYear`. Frontend không gửi trường này.
- `legalConsentAccepted = false` → từ chối ngay, không tạo record.
- Horse mới được tạo với `AdminApprovalStatus = "Pending"`, `Status = "Declared"`.
- Không chạy auto-reject tại bước tạo — auto-reject chỉ chạy khi Admin click Approve (endpoint 7).

---

### Response — 201 Created

```json
{
  "success":   true,
  "message":   "Hồ sơ ngựa đã được khai báo thành công.",
  "data": {
    "horseId":               1,
    "ownerId":               5,
    "name":                  "Thunder",
    "birthYear":             2020,
    "age":                   6,
    "gender":                "Stallion",
    "color":                 "Black",
    "pedigree":              "Secretariat x Winning Colors",
    "weight":                520.50,
    "identifyingMarks":      "Sao trắng trán, cẳng chân trái sau trắng",
    "breed":                 "Thoroughbred",
    "vaccinationRecordRef":  "VAC-2024-001",
    "dopingTestDate":        "2024-06-10",
    "dopingTestResult":      "Clean",
    "legalConsentAccepted":  true,
    "adminApprovalStatus":   "Pending",
    "rejectionReason":       null,
    "createdAt":             "2026-06-20T10:00:00Z",
    "updatedAt":             "2026-06-20T10:00:00Z"
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu hoặc sai format field. Response kèm `fields: [{ field, message }]` |
| 400 | `LEGAL_CONSENT_REQUIRED` | `legalConsentAccepted` không phải `true` |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner |

---
---

## 2. Danh sách ngựa của Owner

```
GET /api/horses/my
```

Trả danh sách tất cả ngựa thuộc Owner đang đăng nhập, kèm trạng thái duyệt.

**Auth:** Owner

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| adminApprovalStatus | string | — | Lọc theo `Pending` \| `Approved` \| `Rejected` |
| page | int | 1 | |
| pageSize | int | 20 | Tối đa 100 |

---

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "horseId":             1,
      "name":                "Thunder",
      "breed":               "Thoroughbred",
      "age":                 6,
      "gender":              "Stallion",
      "color":               "Black",
      "dopingTestResult":    "Clean",
      "adminApprovalStatus": "Pending",
      "rejectionReason":     null,
      "createdAt":           "2026-06-20T10:00:00Z"
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

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner |

---
---

## 3. Chi tiết một con ngựa

```
GET /api/horses/{id}
```

**Auth:** Owner  
**Path param:** `id` — horseId (integer)

Owner chỉ được xem ngựa thuộc mình.

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "horseId":               1,
    "ownerId":               5,
    "name":                  "Thunder",
    "birthYear":             2020,
    "age":                   6,
    "gender":                "Stallion",
    "color":                 "Black",
    "pedigree":              "Secretariat x Winning Colors",
    "weight":                520.50,
    "identifyingMarks":      "Sao trắng trán, cẳng chân trái sau trắng",
    "breed":                 "Thoroughbred",
    "vaccinationRecordRef":  "VAC-2024-001",
    "dopingTestDate":        "2024-06-10",
    "dopingTestResult":      "Clean",
    "legalConsentAccepted":  true,
    "adminApprovalStatus":   "Approved",
    "rejectionReason":       null,
    "createdAt":             "2026-06-20T10:00:00Z",
    "updatedAt":             "2026-06-20T10:00:00Z"
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `HORSE_NOT_OWNED` | `horseId` không thuộc Owner này |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |

---
---

## 4. Cập nhật hồ sơ ngựa

```
PUT /api/horses/{id}
```

Owner cập nhật thông tin ngựa. Nếu sửa bất kỳ trường nhạy cảm nào, hệ thống tự động đưa hồ sơ về `Pending` và treo các Pairing liên quan (EC-23).

**Auth:** Owner  
**Path param:** `id` — horseId (integer)

---

### Request body

Chỉ gửi các trường cần cập nhật.

```json
{
  "color":               "Dark Bay",
  "weight":              525.00,
  "dopingTestResult":    "Clean",
  "dopingTestDate":      "2026-05-01",
  "vaccinationRecordRef": "VAC-2026-005"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| name | string | 1–100 ký tự |
| birthYear | int | 1900 ≤ value ≤ năm hiện tại |
| gender | string | enum `Stallion` \| `Colt` \| `Mare` \| `Filly` |
| color | string | 1–50 ký tự |
| pedigree | string | Tối đa 255 ký tự |
| weight | decimal | > 0 |
| identifyingMarks | string | 1–255 ký tự |
| breed | string ⚠️ nhạy cảm | Tối đa 30 ký tự |
| vaccinationRecordRef | string ⚠️ nhạy cảm | 1–100 ký tự |
| dopingTestDate | string ⚠️ nhạy cảm | Format `YYYY-MM-DD`, không ở tương lai |
| dopingTestResult | string ⚠️ nhạy cảm | enum `Clean` \| `Pending` \| `Failed` |

> ⚠️ **Trường nhạy cảm:** `breed`, `vaccinationRecordRef`, `dopingTestDate`, `dopingTestResult`.  
> Sửa bất kỳ trường nào trong số này → trigger re-validate (xem Business rules bên dưới).

---

### Business rules

**Re-validate (EC-23):** Nếu ít nhất một trong 4 trường nhạy cảm thay đổi giá trị so với bản ghi hiện tại:
1. `Horse.AdminApprovalStatus` → `"Pending"`.
2. Tất cả `Pairing` liên quan Horse này → `Pairing.Status = "Suspended"`.
3. Chạy lại auto-reject check (breed + doping). Nếu vi phạm → `AdminApprovalStatus = "Rejected"` ngay.
4. Admin bắt buộc duyệt lại trước khi ngựa được đưa vào lịch thi đấu.

---

### Response — 200 OK (không có re-validate)

```json
{
  "success":     true,
  "message":     "Cập nhật hồ sơ thành công.",
  "data":        { "...full horse object như endpoint 3..." },
  "revalidated": false
}
```

### Response — 200 OK (có re-validate, trường nhạy cảm đã đổi)

```json
{
  "success":     true,
  "message":     "Cập nhật thành công. Hồ sơ đã được đưa về trạng thái chờ duyệt lại do thay đổi thông tin y tế.",
  "data":        { "...full horse object, adminApprovalStatus: 'Pending'..." },
  "revalidated": true
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Sai ràng buộc field |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `HORSE_NOT_OWNED` | `horseId` không thuộc Owner này |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |

---
---

## 5. Danh sách hồ sơ ngựa chờ duyệt (Admin)

```
GET /api/admin/horses/pending
```

Admin xem tất cả ngựa có `AdminApprovalStatus = "Pending"`.

**Auth:** Admin

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| page | int | 1 | |
| pageSize | int | 20 | Tối đa 100 |

---

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "horseId":             1,
      "horseName":           "Thunder",
      "breed":               "Thoroughbred",
      "dopingTestResult":    "Clean",
      "adminApprovalStatus": "Pending",
      "owner": {
        "ownerId":  5,
        "fullName": "Nguyen Van A",
        "email":    "owner@example.com"
      },
      "createdAt": "2026-06-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page":       1,
    "pageSize":   20,
    "total":      4,
    "totalPages": 1
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |

---
---

## 6. Chi tiết hồ sơ ngựa (Admin view)

```
GET /api/admin/horses/{id}
```

Admin xem chi tiết đầy đủ hồ sơ bất kỳ để phục vụ quyết định duyệt / từ chối.

**Auth:** Admin  
**Path param:** `id` — horseId (integer)

---

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "horseId":               1,
    "name":                  "Thunder",
    "birthYear":             2020,
    "age":                   6,
    "gender":                "Stallion",
    "color":                 "Black",
    "pedigree":              "Secretariat x Winning Colors",
    "weight":                520.50,
    "identifyingMarks":      "Sao trắng trán, cẳng chân trái sau trắng",
    "breed":                 "Thoroughbred",
    "vaccinationRecordRef":  "VAC-2024-001",
    "dopingTestDate":        "2024-06-10",
    "dopingTestResult":      "Clean",
    "legalConsentAccepted":  true,
    "adminApprovalStatus":   "Pending",
    "rejectionReason":       null,
    "owner": {
      "ownerId":  5,
      "fullName": "Nguyen Van A",
      "email":    "owner@example.com"
    },
    "createdAt": "2026-06-20T10:00:00Z",
    "updatedAt": "2026-06-20T10:00:00Z"
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |

---
---

## 7. Phê duyệt hồ sơ ngựa (Admin)

```
PATCH /api/admin/horses/{id}/approve
```

Admin phê duyệt hồ sơ ngựa. Endpoint này chạy lại auto-reject check trước khi cho phép approve.

**Auth:** Admin  
**Path param:** `id` — horseId (integer)  
**Request body:** Không có

---

### Business rules

Thực hiện theo thứ tự, dừng lại và trả lỗi ngay nếu bước nào fail:

1. **Auto-reject check — breed:** So sánh `Horse.Breed` với tất cả `Tournament.AllowedBreed` của các giải mà ngựa đang đăng ký (trace qua `RaceEntry → Pairing → Race → Round → Tournament`). Nếu bất kỳ giải nào không khớp → từ chối approve, trả 422.
2. **Auto-reject check — doping:** Nếu `Horse.DopingTestResult = "Failed"` → từ chối approve, trả 422. Admin không được override.
3. **Kiểm tra trạng thái:** Nếu `AdminApprovalStatus` đã là `"Approved"` → trả 409.
4. Set `Horse.AdminApprovalStatus = "Approved"`.
5. Ghi `AuditLog`: `action = "Approve_Horse"`, `entityName = "Horse"`, `entityId = horseId`.
6. Gửi Notification đến Owner: `title = "Hồ sơ ngựa được phê duyệt"`, `type = "HorseApproved"`, `relatedEntityType = "Horse"`, `relatedEntityId = horseId`.

---

### Response — 200 OK

```json
{
  "success": true,
  "message": "Hồ sơ ngựa đã được phê duyệt."
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |
| 409 | `ALREADY_APPROVED` | Hồ sơ đã ở trạng thái `Approved` |
| 422 | `AUTO_REJECTED_BREED` | Breed không khớp AllowedBreed của giải — kèm message nêu tên giải và breed mâu thuẫn |
| 422 | `AUTO_REJECTED_DOPING` | `DopingTestResult = Failed` — không thể override |

---
---

## 8. Từ chối hồ sơ ngựa (Admin)

```
PATCH /api/admin/horses/{id}/reject
```

**Auth:** Admin  
**Path param:** `id` — horseId (integer)

---

### Request body

```json
{
  "reason": "Hồ sơ tiêm phòng không hợp lệ, cần bổ sung biên bản xác nhận từ thú y."
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| reason | string | Bắt buộc, 10–500 ký tự |

---

### Business rules

1. Kiểm tra `AdminApprovalStatus` — nếu đã là `"Rejected"` → trả 409.
2. Set `Horse.AdminApprovalStatus = "Rejected"`, `Horse.RejectionReason = reason`.
3. Ghi `AuditLog`: `action = "Reject_Horse"`.
4. Gửi Notification đến Owner: `title = "Hồ sơ ngựa bị từ chối"`, `message` kèm lý do, `type = "HorseRejected"`.

---

### Response — 200 OK

```json
{
  "success": true,
  "message": "Hồ sơ ngựa đã bị từ chối."
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | `reason` thiếu hoặc < 10 ký tự |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |
| 409 | `ALREADY_REJECTED` | Hồ sơ đã ở trạng thái `Rejected` |

---
---

## 9. Đăng ký ngựa vào Race (tạo RaceEntry)

```
POST /api/race-entries
```

Owner đăng ký một Pairing (ngựa + jockey đã ghép) vào một Race cụ thể. Hệ thống tự động tạo `RaceEntry` và khởi tạo luồng Entry Fee.

**Auth:** Owner

> **Tiên quyết:** Pairing (`horseId` + `jockeyId`) phải đã ở trạng thái `Accepted` (Module D).  
> **Tiên quyết:** `Horse.AdminApprovalStatus` phải là `"Approved"`.

---

### Request body

```json
{
  "pairingId": 31,
  "raceId":    12
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| pairingId | int | Pairing phải `Accepted` và Horse thuộc Owner này |
| raceId | int | Race phải tồn tại và còn chỗ (< `Tournament.MaxHorses`) |

---

### Business rules

1. Kiểm tra Pairing thuộc Owner đang gọi (qua `Pairing.Horse.OwnerId`).
2. Kiểm tra `Pairing.Status = "Accepted"` — Pairing chưa accepted → 422.
3. Kiểm tra `Horse.AdminApprovalStatus = "Approved"` — chưa duyệt → 422.
4. Kiểm tra số entry hiện tại của Race < `Tournament.MaxHorses` (EC-46) — đầy chỗ → 422.
5. Kiểm tra chống trùng: không được tạo RaceEntry với cùng `raceId` + `pairingId` (unique constraint DB).
6. Kiểm tra chống một ngựa / một jockey xuất hiện 2 lần trong cùng Race (EC-40).
7. Tạo `RaceEntry`:
   - Nếu `Tournament.EntryFeeAmount = 0` → `EntryFeeStatus = "Paid"` (bỏ qua luồng phí).
   - Ngược lại → `EntryFeeStatus = "Unpaid"`, `Status = "Pending"`.
8. Tái kiểm tra `Jockey.ExperienceYears >= Tournament.MinJockeyExperienceYears` (EC-21) tại đây vì bây giờ mới biết tournament cụ thể.

---

### Response — 201 Created

```json
{
  "success": true,
  "message": "Đăng ký tham gia cuộc đua thành công.",
  "data": {
    "raceEntryId":       42,
    "raceId":            12,
    "pairingId":         31,
    "horse": {
      "horseId": 1,
      "name":    "Thunder"
    },
    "jockey": {
      "jockeyId": 15,
      "fullName": "Nguyen Van B"
    },
    "status":            "Pending",
    "entryFeeStatus":    "Unpaid",
    "entryFeeAmount":    500000,
    "createdAt":         "2026-06-20T11:00:00Z"
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu field |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner hoặc Pairing không thuộc Owner |
| 404 | `PAIRING_NOT_FOUND` | `pairingId` không tồn tại |
| 404 | `RACE_NOT_FOUND` | `raceId` không tồn tại |
| 409 | `ENTRY_ALREADY_EXISTS` | Cặp `raceId` + `pairingId` đã có RaceEntry |
| 422 | `PAIRING_NOT_ACCEPTED` | Pairing chưa ở trạng thái `Accepted` |
| 422 | `HORSE_NOT_APPROVED` | `Horse.AdminApprovalStatus ≠ Approved` |
| 422 | `RACE_FULL` | Số entry đã đạt `Tournament.MaxHorses` |
| 422 | `DUPLICATE_HORSE_IN_RACE` | Ngựa này đã có trong cuộc đua qua Pairing khác (EC-40) |
| 422 | `DUPLICATE_JOCKEY_IN_RACE` | Jockey này đã có trong cuộc đua qua Pairing khác (EC-40) |
| 422 | `JOCKEY_EXPERIENCE_INSUFFICIENT` | `ExperienceYears < Tournament.MinJockeyExperienceYears` (EC-21) |

---
---

## 10. Danh sách race entry (Owner)

```
GET /api/race-entries/my
```

Owner xem tất cả RaceEntry của mình (tất cả ngựa thuộc Owner, tất cả races).

**Auth:** Owner

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| status | string | — | `Pending` \| `Confirmed` \| `Cancelled` \| `Disqualified` |
| entryFeeStatus | string | — | `Unpaid` \| `Paid` \| `Refund Pending` \| `Refunded` |
| page | int | 1 | |
| pageSize | int | 20 | |

---

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "raceEntryId":    42,
      "race": {
        "raceId":        12,
        "raceNumber":    1,
        "scheduledTime": "2026-07-01T08:00:00Z"
      },
      "horse": {
        "horseId": 1,
        "name":    "Thunder"
      },
      "jockey": {
        "jockeyId": 15,
        "fullName": "Nguyen Van B"
      },
      "status":         "Pending",
      "entryFeeStatus": "Unpaid",
      "entryFeeAmount": 500000,
      "createdAt":      "2026-06-20T11:00:00Z"
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

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner |

---
---

## 11. Danh sách entries chờ xác nhận phí (Admin)

```
GET /api/admin/race-entries/pending-fee
```

Admin xem danh sách RaceEntry có `EntryFeeStatus = "Unpaid"` để xác nhận phí sau khi thu tiền ngoài hệ thống.

**Auth:** Admin

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| page | int | 1 | |
| pageSize | int | 20 | |

---

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "raceEntryId":    42,
      "race": {
        "raceId":        12,
        "raceNumber":    1,
        "scheduledTime": "2026-07-01T08:00:00Z",
        "tournamentName": "Giải Đua Mùa Hè 2026"
      },
      "horse": {
        "horseId": 1,
        "name":    "Thunder"
      },
      "owner": {
        "ownerId":  5,
        "fullName": "Nguyen Van A",
        "email":    "owner@example.com"
      },
      "entryFeeAmount": 500000,
      "entryFeeStatus": "Unpaid",
      "createdAt":      "2026-06-20T11:00:00Z"
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

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |

---
---

## 12. Xác nhận đã nhận lệ phí (Admin)

```
PATCH /api/admin/race-entries/{id}/confirm-fee
```

Admin xác nhận đã nhận tiền lệ phí ngoài hệ thống, cập nhật `EntryFeeStatus = "Paid"`.

**Auth:** Admin  
**Path param:** `id` — raceEntryId (integer)  
**Request body:** Không có

---

### Business rules

1. Load RaceEntry, kiểm tra `EntryFeeStatus = "Unpaid"` — nếu đã `"Paid"` → 409.
2. Set `EntryFeeStatus = "Paid"`, `EntryFeeConfirmedBy = currentAdminId`, `EntryFeeConfirmedAt = UTC now`.
3. Ghi `AuditLog`: `action = "Update_Entry_Fee_Status"`, `oldValue = "Unpaid"`, `newValue = "Paid"`.
4. Gửi Notification đến Owner: `title = "Lệ phí đã được xác nhận"`, `type = "EntryFeeConfirmed"`.

---

### Response — 200 OK

```json
{
  "success": true,
  "message": "Lệ phí đã được xác nhận.",
  "data": {
    "raceEntryId":     42,
    "entryFeeStatus":  "Paid",
    "confirmedBy":     "admin_username",
    "confirmedAt":     "2026-06-20T14:30:00Z"
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `RACE_ENTRY_NOT_FOUND` | `raceEntryId` không tồn tại |
| 409 | `FEE_ALREADY_CONFIRMED` | `EntryFeeStatus` đã là `Paid` |

---
---

## 13. Phê duyệt entry tham gia race (Admin)

```
PATCH /api/admin/race-entries/{id}/approve
```

Admin phê duyệt entry vào race cụ thể. **Đây là gate bị khoá cứng bởi EntryFeeStatus (Node 2.5 trong SRS).**

**Auth:** Admin  
**Path param:** `id` — raceEntryId (integer)  
**Request body:** Không có

---

### Business rules

Thực hiện theo thứ tự:

1. **Gate cứng — EntryFeeStatus:** Nếu `RaceEntry.EntryFeeStatus ≠ "Paid"` → **400, không thể override**. Admin phải xác nhận phí trước (endpoint 12).
2. Kiểm tra `Horse.AdminApprovalStatus = "Approved"` (qua `RaceEntry → Pairing → Horse`) — nếu không → 422.
3. Kiểm tra `RaceEntry.Status = "Pending"` — nếu đã `"Confirmed"` → 409.
4. Set `RaceEntry.Status = "Confirmed"`.
5. Ghi `AuditLog`: `action = "Approve_RaceEntry"`.
6. Gửi Notification đến Owner: `title = "Đăng ký race được xác nhận"`, `type = "RaceEntryApproved"`.

---

### Response — 200 OK

```json
{
  "success": true,
  "message": "Đăng ký tham gia cuộc đua đã được xác nhận."
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `ENTRY_FEE_NOT_PAID` | `EntryFeeStatus ≠ Paid` — gate cứng, không được override |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `RACE_ENTRY_NOT_FOUND` | `raceEntryId` không tồn tại |
| 409 | `ENTRY_ALREADY_CONFIRMED` | `RaceEntry.Status` đã là `Confirmed` |
| 422 | `HORSE_NOT_APPROVED` | Horse chưa được Admin duyệt hồ sơ |

---
---

## Ghi chú — Auto-reject logic (REQ-F-HRS.4)

Auto-reject được chạy tại **hai thời điểm**:

1. Khi Admin click **Approve hồ sơ ngựa** (endpoint 7) — chạy trước khi set `Approved`.
2. Khi Owner **cập nhật trường nhạy cảm** sau khi đã `Approved` (endpoint 4) — chạy lại ngay trong cùng request.

**Điều kiện auto-reject (Admin không được override):**

| Điều kiện | Hành động |
|-----------|-----------|
| `Horse.Breed ≠ Tournament.AllowedBreed` của bất kỳ giải nào đang đăng ký | Set `AdminApprovalStatus = "Rejected"`, trả lỗi `AUTO_REJECTED_BREED` |
| `Horse.DopingTestResult = "Failed"` | Set `AdminApprovalStatus = "Rejected"`, trả lỗi `AUTO_REJECTED_DOPING` |

**Chain query để lấy AllowedBreed:**
```
Horse → Pairings → RaceEntries → Race → Round → Tournament → AllowedBreed
```

---

## Ghi chú — Hoàn phí tự động (REQ-F-HRS.8, EC-32)

Khi một entry đã `Paid` bị huỷ bởi các luồng bên ngoài Module C, hệ thống **tự động** (không cần Admin) chuyển `EntryFeeStatus: Paid → Refund Pending` trong cùng transaction.

| Luồng kích hoạt | Module | Trigger |
|-----------------|--------|---------|
| Withdrawal (Owner rút lui hoặc quá hạn xác nhận) | E | `RaceEntry.IsWithdrawn = true` |
| Emergency Disqualification (Doctor đánh Unfit / vi phạm Independence) | G | `RaceEntry.Status = "Disqualified"` |
| Tournament Cancellation | B | Admin cancel tournament |

Sau khi hệ thống set `Refund Pending`, Admin xử lý hoàn trả ngoài hệ thống rồi cập nhật `Refunded` thủ công (endpoint riêng của Module tương ứng, không thuộc Module C).

---

## Ghi chú — Field `LegalConsentAccepted`

Field này **chưa có trong DB hiện tại** — cần thêm migration:

```sql
ALTER TABLE Horses
ADD LegalConsentAccepted BIT NOT NULL DEFAULT 0;
```

Và thêm vào `Horse.cs` entity:
```csharp
public bool LegalConsentAccepted { get; set; }
```
