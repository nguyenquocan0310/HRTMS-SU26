# API Contract — Module C: Đăng ký Ngựa & Duyệt Hồ sơ

**Phiên bản:** 3.0 — Schema v3: tách "kho ngựa" khỏi giải đấu. Hồ sơ ngựa (`Horse`) là kho vĩnh viễn của Owner; việc tham gia từng giải tách sang **enrollment** (`HorseTournamentEntry`) với screening + AdminApproval **theo từng giải** (duyệt lại mỗi giải).\
**Base URL:** `http://localhost:5000/api`\
**Auth header:** `Authorization: Bearer <jwt_token>`

> **Thay đổi so với v2.0 (FE + BE đọc):**
> - `POST /api/horses` **không còn nhận `tournamentId`** — chỉ tạo hồ sơ ngựa vào kho. Screening breed/doping-theo-giải chuyển sang bước enroll.
> - **Mới:** `POST /api/horses/{horseId}/enrollments` để Owner "đẩy" một con ngựa trong kho vào một giải. Response trả `screeningStatus` ∈ `AutoEligible | ManualReview | AutoRejected` cho **enrollment** đó.
> - Admin duyệt/từ chối nay thao tác trên **enrollment** (`/api/admin/horse-entries/{enrollmentId}/...`) thay vì trên hồ sơ ngựa.
> - `Horse` vẫn giữ `screeningStatus`/`adminApprovalStatus` ở mức **baseline hồ sơ** (chỉ chặn doping `Failed`); gate thật sự để vào giải là enrollment.

---

## Quy ước chung

| Mục | Giá trị |
| --- | --- |
| Content-Type | `application/json` |
| Định dạng thời gian | ISO 8601 — `2026-06-20T10:00:00Z` |
| Định dạng ngày | `YYYY-MM-DD` — dùng cho `dopingTestDate` |
| Kiểu ID | integer |
| Cấu trúc lỗi | `{ "error": "<MÃ_LỖI>", "message": "<mô tả>" }` |

**Trạng thái AdminApprovalStatus (Horse):** `Pending` · `Approved` · `Rejected`\
**Trạng thái ScreeningStatus (Horse):** `NotScreened` · `AutoEligible` · `ManualReview` · `AutoRejected` *(triage tự động; `AutoRejected` đánh dấu auto-reject cứng — Admin không override)*\
**Trạng thái Status (Horse):** `Declared` · `Active` · `Retired` *(theo CHECK constraint DB)*\
**DopingTestResult:** `Clean` · `Pending` · `Failed`\
**Gender:** `Male` · `Female` · `Gelding` *(theo CHECK constraint DB — Male = ngựa đực nguyên, Female = ngựa cái, Gelding = ngựa đực đã thiến)*\
**Breed:** `Mixed` · `Quarter Horse` · `Arabian` · `Thoroughbred` *(theo CHECK constraint DB)* — so khớp với `Horse.Tournament.AllowedBreed` ngay khi screening (submit + approve hồ sơ).\
**EntryFeeStatus (RaceEntry):** `Unpaid` · `Paid` · `Refund Pending` · `Refunded`\
**Trạng thái RaceEntry:** `Pending` · `Confirmed` · `Cancelled` · `Disqualified`

> **Lưu ý kiến trúc:** `RaceEntry` không link thẳng vào `Horse` mà link qua `Pairing` (Horse + Jockey).\
> Chuỗi quan hệ: `Race → RaceEntry → Pairing → Horse`. Việc tạo RaceEntry yêu cầu `Pairing` đã `Confirmed` (xem Module D/E).\
> Auto-reject theo breed so khớp `Horse.Breed` với `Tournament.AllowedBreed` tại **thời điểm enroll** (schema v3: hồ sơ ngựa không gắn giải; mỗi enrollment `HorseTournamentEntry` gắn đúng 1 giải).

---

## Danh sách Endpoint

| \# | Method | Endpoint | Auth | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/horses` | Owner | Tạo hồ sơ ngựa vào **kho** (không gắn giải) |
| 2 | GET | `/api/horses/my` | Owner | Danh sách ngựa trong kho của Owner |
| 3 | GET | `/api/horses/{id}` | Owner | Chi tiết một con ngựa |
| 4 | PUT | `/api/horses/{id}` | Owner | Cập nhật hồ sơ ngựa (trigger re-screen enrollment) |
| 5 | POST | `/api/horses/{horseId}/enrollments` | Owner | **Đẩy ngựa vào một giải** (screening theo giải) |
| 6 | GET | `/api/horses/{horseId}/enrollments` | Owner | Danh sách enrollment của một con ngựa |
| 7 | GET | `/api/horses/my/enrollments` | Owner | Tất cả enrollment của Owner (lọc theo `tournamentId`) |
| 7b | DELETE | `/api/horses/{horseId}/enrollments/{id}` | Owner | **Rút ngựa khỏi giải** (soft-withdraw, chỉ khi chưa pairing) |
| 8 | GET | `/api/admin/horse-entries` | Admin | Danh sách enrollment theo filter `tournamentId`/`status` (trống = tất cả) |
| 8b | GET | `/api/admin/horse-entries/pending` | Admin | **Alias tương thích ngược** của #8 với `status=Pending` cố định |
| 9 | GET | `/api/admin/horses/{id}` | Admin | Chi tiết hồ sơ ngựa (Admin view) |
| 10 | PATCH | `/api/admin/horse-entries/{id}/approve` | Admin | Phê duyệt enrollment (ngựa vào giải) |
| 11 | PATCH | `/api/admin/horse-entries/{id}/reject` | Admin | Từ chối enrollment |
| 12 | GET | `/api/race-entries/my` | Owner | Danh sách race entry của Owner |
| 13 | GET | `/api/admin/entries/pending-fee` | Admin | Danh sách entries chờ xác nhận phí |
| 14 | PATCH | `/api/admin/entries/{id}/fee-status` | Admin | Xác nhận đã nhận lệ phí (Unpaid → Paid) |
| 15 | PATCH | `/api/admin/entries/{id}/approve` | Admin | Phê duyệt entry tham gia race (gate EntryFeeStatus + enrollment Approved) |
| 16 | PATCH | `/api/admin/entries/{id}/reject` | Admin | Từ chối entry (→ Cancelled) |
| 17 | GET | `/api/admin/entries` | Admin | Danh sách MỌI race entry theo filter `status`/`feeStatus`/`tournamentId`/`raceId` (không khóa Unpaid như #13) |
| 18 | PATCH | `/api/admin/entries/{id}/refund-complete` | Admin | Đóng vòng hoàn phí: `Refund Pending` → `Refunded` (in-app + email) |

> **Tạo RaceEntry KHÔNG thuộc Module C.** RaceEntry do **Admin allocate** Pairing `Confirmed` vào Race qua **Module E (SCH.1)** — không có endpoint `POST /api/race-entries` cho Owner. Owner chỉ **xem** entry của mình (#9).

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
  "gender":                "Male",
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
| --- | --- | --- |
| name | string | Bắt buộc, 1–100 ký tự |
| birthYear | int | Bắt buộc, 1900 ≤ value ≤ năm hiện tại |
| gender | string | Bắt buộc, enum `Male` | `Female` | `Gelding` |
| color | string | Bắt buộc, 1–50 ký tự |
| pedigree | string | Tuỳ chọn, tối đa 255 ký tự |
| weight | decimal | Bắt buộc, &gt; 0, tối đa 2 chữ số thập phân |
| identifyingMarks | string | Bắt buộc, 1–255 ký tự |
| breed | string | Bắt buộc, enum `Mixed` | `Quarter Horse` | `Arabian` | `Thoroughbred` — so khớp với `Tournament.AllowedBreed` khi Admin duyệt RaceEntry |
| vaccinationRecordRef | string | Bắt buộc, 1–100 ký tự |
| dopingTestDate | string | Bắt buộc, format `YYYY-MM-DD`, không được ở tương lai |
| dopingTestResult | string | Bắt buộc, enum `Clean` | `Pending` | `Failed` |
| legalConsentAccepted | bool | **Bắt buộc phải là** `true` — nếu `false` hoặc thiếu → 400 |

---

### Business rules

- `age` được tính tự động ở backend: `age = currentYear − birthYear`. Frontend không gửi trường này.
- `legalConsentAccepted = false` → từ chối ngay, không tạo record.
- **Schema v3:** tạo hồ sơ vào **kho — KHÔNG cần roster/giải**. Không screening breed tại đây (chưa biết giải).
- **Baseline profile screen:** chỉ chặn doping `Failed` → `screeningStatus = "AutoRejected"`, `adminApprovalStatus = "Rejected"`. Còn lại hồ sơ `adminApprovalStatus = "Approved"` (mức hồ sơ); gate thật sự để vào giải là **enrollment** (endpoint 5).

---

### Response — 201 Created

```json
{
  "success":   true,
  "message":   "Hồ sơ ngựa hợp lệ và đã được hệ thống tự động phê duyệt.",
  "data": {
    "horseId":               1,
    "ownerId":               5,
    "name":                  "Thunder",
    "birthYear":             2020,
    "age":                   6,
    "gender":                "Male",
    "color":                 "Black",
    "pedigree":              "Secretariat x Winning Colors",
    "weight":                520.50,
    "identifyingMarks":      "Sao trắng trán, cẳng chân trái sau trắng",
    "breed":                 "Thoroughbred",
    "vaccinationRecordRef":  "VAC-2024-001",
    "dopingTestDate":        "2024-06-10",
    "dopingTestResult":      "Clean",
    "legalConsentAccepted":  true,
    "screeningStatus":       "AutoEligible",
    "screeningReason":       null,
    "adminApprovalStatus":   "Approved",
    "rejectionReason":       null,
    "createdAt":             "2026-06-20T10:00:00Z",
    "updatedAt":             "2026-06-20T10:00:00Z"
  }
}
```

> `message` và `screeningStatus`/`adminApprovalStatus` thay đổi theo kết quả screening:
> - `AutoEligible` → message "…tự động phê duyệt.", `adminApprovalStatus = "Approved"`.
> - `ManualReview` → message "…chờ Admin duyệt. Lý do cần xem xét: …", `adminApprovalStatus = "Pending"`.
> - `AutoRejected` → message "Hồ sơ ngựa bị tự động từ chối: …", `adminApprovalStatus = "Rejected"`, `screeningReason` có lý do.

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Thiếu hoặc sai format field. Response kèm `fields: [{ field, message }]` |
| 400 | `LEGAL_CONSENT_REQUIRED` | `legalConsentAccepted` không phải `true` |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner |

---

## 1b. Đẩy ngựa vào giải — Enrollment

```
POST /api/horses/{horseId}/enrollments
```

Owner "đẩy" một con ngựa **đã có trong kho** vào một giải cụ thể. Hệ thống screen breed/doping theo rule của giải và tạo bản ghi enrollment (`HorseTournamentEntry`) với AdminApproval **riêng cho giải đó**.

**Auth:** Owner

### Request body

```json
{ "tournamentId": 3 }
```

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| tournamentId | int | Bắt buộc, ≥ 1 — giải phải đang `Open Registration` |

### Business rules

- Ngựa phải thuộc Owner đang đăng nhập (`HORSE_NOT_OWNED`) và tồn tại (`HORSE_NOT_FOUND`).
- Giải phải tồn tại (`TOURNAMENT_NOT_FOUND`) và đang `Open Registration`.
- Owner phải đã `Approved` trong roster giải (`TournamentParticipants`) — nếu không → chặn enroll.
- Không cho enroll **trùng** một con ngựa vào cùng một giải.
- **Screening theo giải** → set `screeningStatus` cho enrollment:
  - **AutoEligible** (breed khớp `Tournament.AllowedBreed` + doping `Clean`) → `adminApprovalStatus = "Approved"` tự động.
  - **ManualReview** (doping `Pending`) → `adminApprovalStatus = "Pending"`, vào hàng đợi Admin.
  - **AutoRejected** (doping `Failed` HOẶC breed mismatch) → `adminApprovalStatus = "Rejected"`, `screeningReason` nêu lý do; Admin không override.

### Response — 201 Created

```json
{
  "success": true,
  "message": "Ngựa hợp lệ và đã được hệ thống tự động phê duyệt vào giải.",
  "data": {
    "enrollmentId":        10,
    "horseId":             1,
    "horseName":           "Thunder",
    "tournamentId":        3,
    "tournamentName":      "Giải Mùa Hè 2026",
    "status":              "Enrolled",
    "screeningStatus":     "AutoEligible",
    "screeningReason":     null,
    "adminApprovalStatus": "Approved",
    "rejectionReason":     null,
    "createdAt":           "2026-06-30T10:00:00Z",
    "updatedAt":           "2026-06-30T10:00:00Z"
  }
}
```

### Lỗi

| HTTP | error | Khi nào |
| --- | --- | --- |
| 404 | `HORSE_NOT_FOUND` / `TOURNAMENT_NOT_FOUND` | Không tìm thấy ngựa/giải |
| 403 | `HORSE_NOT_OWNED` | Ngựa không thuộc Owner |
| 400 | — | Giải không `Open Registration`, chưa `Approved` roster, hoặc enroll trùng |

> `GET /api/horses/{horseId}/enrollments` và `GET /api/horses/my/enrollments` trả về danh sách enrollment với cùng cấu trúc `data` (mảng).

### Query params (2 endpoint GET enrollment)

| Tham số | Kiểu | Áp dụng cho | Ghi chú |
| --- | --- | --- | --- |
| tournamentId | int | chỉ `GET /api/horses/my/enrollments` | Lọc theo giải |
| adminApprovalStatus | string | cả 2 endpoint | `Pending` \| `Approved` \| `Rejected` — **bắt buộc dùng `Approved`** khi lấy danh sách ngựa hợp lệ để mời Jockey (JockeyInvite), tránh lẫn enrollment `Rejected`/`Pending` |
| page, pageSize | int | cả 2 endpoint | Mặc định 1 / 20 |

---

## 1c. Rút ngựa khỏi giải — Withdraw enrollment

```
DELETE /api/horses/{horseId}/enrollments/{enrollmentId}
```

Owner rút một con ngựa khỏi một giải **trước khi pairing**. Soft-withdraw: `enrollment.Status` `Enrolled` → `Withdrawn` (không xóa cứng, vì `FK_Pairings_HorseTournament` trỏ vào row này). Ngựa quay về kho, có thể enroll giải khác.

**Auth:** Owner

### Business rules

- Enrollment phải tồn tại và `horseId` khớp (`ENROLLMENT_NOT_FOUND`).
- Enrollment phải thuộc Owner đang đăng nhập (`ENROLLMENT_NOT_OWNED` → 403).
- Đã `Withdrawn` rồi → `ALREADY_WITHDRAWN`.
- **Chặn nếu đã có pairing active** (`Pending`/`Accepted`/`Confirmed`) của ngựa trong đúng giải đó → `PAIRING_EXISTS`; phải hủy pairing trước.
- Ghi `AuditLog` `Withdraw_Enrollment` + Notification cho Owner.

### Response — 200 OK

```json
{ "success": true, "message": "Đã rút ngựa khỏi giải." }
```

### Lỗi

| HTTP | error | Khi nào |
| --- | --- | --- |
| 404 | `ENROLLMENT_NOT_FOUND` | Không thấy enrollment hoặc `horseId` không khớp |
| 403 | `ENROLLMENT_NOT_OWNED` | Enrollment không thuộc Owner |
| 400 | `ALREADY_WITHDRAWN` / `PAIRING_EXISTS` | Đã rút rồi, hoặc còn pairing active |

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
| --- | --- | --- | --- |
| adminApprovalStatus | string | — | Lọc theo `Pending` | `Approved` | `Rejected` |
| page | int | 1 |  |
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
      "gender":              "Male",
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
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner |

---

---

## 3. Chi tiết một con ngựa

```
GET /api/horses/{id}
```

**Auth:** Owner\
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
    "gender":                "Male",
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
| --- | --- | --- |
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

**Auth:** Owner\
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
| --- | --- | --- |
| name | string | 1–100 ký tự |
| birthYear | int | 1900 ≤ value ≤ năm hiện tại |
| gender | string | enum `Male` | `Female` | `Gelding` |
| color | string | 1–50 ký tự |
| pedigree | string | Tối đa 255 ký tự |
| weight | decimal | &gt; 0 |
| identifyingMarks | string | 1–255 ký tự |
| breed | string ⚠️ nhạy cảm | Tối đa 30 ký tự |
| vaccinationRecordRef | string ⚠️ nhạy cảm | 1–100 ký tự |
| dopingTestDate | string ⚠️ nhạy cảm | Format `YYYY-MM-DD`, không ở tương lai |
| dopingTestResult | string ⚠️ nhạy cảm | enum `Clean` | `Pending` | `Failed` |

> ⚠️ **Trường nhạy cảm:** `breed`, `vaccinationRecordRef`, `dopingTestDate`, `dopingTestResult`.\
> Sửa bất kỳ trường nào trong số này → trigger re-validate (xem Business rules bên dưới).

---

### Business rules

**Re-validate (EC-23):** Chỉ kích hoạt khi hồ sơ **đang `Approved`** và ít nhất một trong 4 trường nhạy cảm thay đổi giá trị so với bản ghi hiện tại:

1. Tất cả `Pairing` liên quan Horse này đang ở `Pending/Accepted/Confirmed` → `Pairing.Status = "Cancelled"` (DB không hỗ trợ `Suspended`; ghi `ResponseReason` nêu lý do EC-23).
2. Chạy lại screening (breed + doping):
   - Vi phạm cứng (breed mismatch / doping `Failed`) → `screeningStatus = "AutoRejected"`, `adminApprovalStatus = "Rejected"`.
   - Còn lại → `adminApprovalStatus = "Pending"` (bắt buộc Admin duyệt lại trước khi vào lịch).
3. Sửa trường KHÔNG nhạy cảm, hoặc hồ sơ chưa `Approved` → không re-validate.

---

> Trạng thái re-validate được phản ánh qua `message` và `data.adminApprovalStatus` / `data.screeningStatus` (không có field `revalidated` riêng).

### Response — 200 OK (không có re-validate)

```json
{
  "success": true,
  "message": "Cập nhật hồ sơ thành công.",
  "data":    { "...full horse object như endpoint 3..." }
}
```

### Response — 200 OK (có re-validate, trường nhạy cảm đã đổi)

```json
{
  "success": true,
  "message": "Cập nhật thành công. Hồ sơ đã được đưa về trạng thái chờ duyệt lại do thay đổi thông tin y tế.",
  "data":    { "...full horse object, adminApprovalStatus: 'Pending', screeningStatus: 'ManualReview'/'AutoEligible'..." }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Sai ràng buộc field |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `HORSE_NOT_OWNED` | `horseId` không thuộc Owner này |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |

---

---

## 5. Danh sách enrollment theo filter (Admin)

```
GET /api/admin/horse-entries
```

Admin xem **enrollment** (`HorseTournamentEntry`) lọc theo giải và/hoặc trạng thái duyệt. Mỗi phần tử `data` theo cấu trúc `HorseEnrollmentResponseDto` (xem §1b).

**Auth:** Admin

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| tournamentId | int? | (trống) | Trống = lấy enrollment của **mọi** giải |
| status | string? | (trống) | `Pending` \| `Approved` \| `Rejected`, case-insensitive. **Trống = lấy tất cả trạng thái** (không mặc định `Pending`) |
| page | int | 1 |  |
| pageSize | int | 20 | Tối đa 100 |

### Alias tương thích ngược

```
GET /api/admin/horse-entries/pending
```

Tương đương `GET /api/admin/horse-entries?status=Pending` (luôn `tournamentId=null`, `status="Pending"` cố định — không nhận query `status`/`tournamentId`). Giữ nguyên để không phá client cũ; dùng chung logic/service với route #8, không duplicate query.

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
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `status` không thuộc `Pending`/`Approved`/`Rejected` |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |

---

---

## 6. Chi tiết hồ sơ ngựa (Admin view)

```
GET /api/admin/horses/{id}
```

Admin xem chi tiết đầy đủ hồ sơ bất kỳ để phục vụ quyết định duyệt / từ chối.

**Auth:** Admin\
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
    "gender":                "Male",
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
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |

---

---

## 7. Phê duyệt enrollment (Admin)

```
PATCH /api/admin/horse-entries/{id}/approve
```

Admin phê duyệt **enrollment ManualReview**. Endpoint chạy lại screening theo giải trước khi cho phép approve (auto-reject cứng không override được).

**Auth:** Admin\
**Path param:** `id` — enrollmentId (integer)\
**Request body:** Không có

> Chỉ áp dụng cho hồ sơ `ManualReview` (đang `Pending`). Hồ sơ `AutoEligible` đã được hệ thống tự duyệt; hồ sơ `AutoRejected` không thể duyệt.

---

### Business rules

Thực hiện theo thứ tự, dừng lại và trả lỗi ngay nếu bước nào fail:

1. **Kiểm tra trạng thái:** Nếu enrollment `AdminApprovalStatus` đã là `"Approved"` → trả 409.
2. **Khóa override auto-reject cứng:** Nếu enrollment `ScreeningStatus = "AutoRejected"` → trả 422, Admin không được override.
3. **Re-screen:** chạy lại screening theo giải (breed khớp `Tournament.AllowedBreed` + doping). Nếu kết quả `AutoRejected` → set enrollment `Rejected` + trả 422.
4. Set enrollment `AdminApprovalStatus = "Approved"`.
5. Ghi `AuditLog`: `action = "Approve_Enrollment"`, `entityName = "HorseTournamentEntry"`, `entityId = enrollmentId`.
6. Gửi Notification đến Owner **(in-app + email)**: `title = "Ngựa được phê duyệt vào giải"`, `relatedEntityType = "HorseTournamentEntry"`, `relatedEntityId = enrollmentId`.

> **Breed check dùng `Tournament.AllowedBreed` của giải enrollment** (schema v3: hồ sơ ngựa không gắn giải; screening theo từng enrollment).

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
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |
| 409 | `ALREADY_APPROVED` | Hồ sơ đã ở trạng thái `Approved` |
| 422 | `AUTO_REJECTED` | `ScreeningStatus = "AutoRejected"` hoặc re-screen ra vi phạm cứng (breed mismatch / doping `Failed`) — không thể override; message kèm `screeningReason` |

---

---

## 8. Từ chối enrollment (Admin)

```
PATCH /api/admin/horse-entries/{id}/reject
```

**Auth:** Admin\
**Path param:** `id` — enrollmentId (integer)

---

### Request body

```json
{
  "reason": "Hồ sơ tiêm phòng không hợp lệ, cần bổ sung biên bản xác nhận từ thú y."
}
```

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| reason | string | Bắt buộc, 10–500 ký tự |

---

### Business rules

1. Kiểm tra `AdminApprovalStatus` — nếu đã là `"Rejected"` → trả 409.
2. Set `Horse.AdminApprovalStatus = "Rejected"`, `Horse.RejectionReason = reason`.
3. Ghi `AuditLog`: `action = "Reject_Horse"`.
4. Gửi Notification đến Owner **(in-app + email)**: `title = "Hồ sơ ngựa bị từ chối"`, `message` kèm lý do.

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
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `reason` thiếu hoặc &lt; 10 ký tự |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `HORSE_NOT_FOUND` | `horseId` không tồn tại |
| 409 | `ALREADY_REJECTED` | Hồ sơ đã ở trạng thái `Rejected` |

---

---

## (Module E) Tạo RaceEntry — KHÔNG thuộc Module C

RaceEntry **không** do Owner tự tạo. Admin allocate Pairing đã `Confirmed` vào Race qua **Module E (REQ-F-SCH.1)**; lúc đó hệ thống khởi tạo `EntryFeeStatus` (`Unpaid`, hoặc `Paid` nếu `EntryFeeAmount = 0`). Xem `api-contract-scheduling.md`. Module C chỉ phụ trách: Owner xem entry (#9) và Admin xử lý lệ phí / duyệt / từ chối entry (#10–13).

---

## 9. Danh sách race entry (Owner)

```
GET /api/race-entries/my
```

Owner xem tất cả RaceEntry của mình (tất cả ngựa thuộc Owner, tất cả races).

**Auth:** Owner

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| status | string | — | `Pending` | `Confirmed` | `Cancelled` | `Disqualified` |
| entryFeeStatus | string | — | `Unpaid` | `Paid` | `Refund Pending` | `Refunded` |
| page | int | 1 |  |
| pageSize | int | 20 |  |

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
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Owner |

---

---

## 10. Danh sách entries chờ xác nhận phí (Admin)

```
GET /api/admin/entries/pending-fee
```

Admin xem danh sách RaceEntry có `EntryFeeStatus = "Unpaid"` để xác nhận phí sau khi thu tiền ngoài hệ thống.

**Auth:** Admin

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| page | int | 1 |  |
| pageSize | int | 20 |  |

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
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |

---

---

## 11. Xác nhận đã nhận lệ phí (Admin)

```
PATCH /api/admin/entries/{id}/fee-status
```

Admin xác nhận đã nhận tiền lệ phí ngoài hệ thống, cập nhật `EntryFeeStatus = "Paid"`.

**Auth:** Admin\
**Path param:** `id` — raceEntryId (integer)\
**Request body:** Không có

---

### Business rules

1. Load RaceEntry, kiểm tra `EntryFeeStatus = "Unpaid"` — nếu đã `"Paid"` → 409.
2. Set `EntryFeeStatus = "Paid"`, `EntryFeeConfirmedBy = currentAdminId`, `EntryFeeConfirmedAt = UTC now`.
3. Ghi `AuditLog`: `action = "Update_Entry_Fee_Status"`, `oldValue = "Unpaid"`, `newValue = "Paid"`.
4. Gửi Notification đến Owner **(in-app + email)**: `title = "Lệ phí tham gia đã được xác nhận"`.

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
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `RACE_ENTRY_NOT_FOUND` | `raceEntryId` không tồn tại |
| 409 | `FEE_ALREADY_CONFIRMED` | `EntryFeeStatus` đã là `Paid` |

---

---

## 12. Phê duyệt entry tham gia race (Admin)

```
PATCH /api/admin/entries/{id}/approve
```

Admin phê duyệt entry vào race cụ thể. **Đây là gate bị khoá cứng bởi EntryFeeStatus (Node 2.5 trong SRS).**

**Auth:** Admin\
**Path param:** `id` — raceEntryId (integer)\
**Request body:** Không có

---

### Business rules

Thực hiện theo thứ tự:

1. **Gate cứng — EntryFeeStatus:** Nếu `RaceEntry.EntryFeeStatus ≠ "Paid"` → **400, không thể override**. Admin phải xác nhận phí trước (endpoint 11).
2. Kiểm tra **enrollment** của ngựa trong ĐÚNG giải đã `Approved` (`HorseTournamentEntry` theo `Pairing.HorseId` + `Pairing.TournamentId`) — nếu không → 422 `HORSE_ENROLLMENT_NOT_APPROVED`.
3. Kiểm tra `RaceEntry.Status = "Pending"` — nếu đã `"Confirmed"` → 409.
4. Set `RaceEntry.Status = "Confirmed"`.
5. Ghi `AuditLog`: `action = "Approve_RaceEntry"`.
6. Gửi Notification đến Owner **(in-app + email)**: `title = "Đăng ký race được xác nhận"`.

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
| --- | --- | --- |
| 400 | `ENTRY_FEE_NOT_PAID` | `EntryFeeStatus ≠ Paid` — gate cứng, không được override |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `RACE_ENTRY_NOT_FOUND` | `raceEntryId` không tồn tại |
| 409 | `ENTRY_ALREADY_CONFIRMED` | `RaceEntry.Status` đã là `Confirmed` |
| 422 | `HORSE_ENROLLMENT_NOT_APPROVED` | Enrollment của ngựa trong giải này chưa được Admin duyệt |

---

---

## 13. Từ chối entry (Admin)

```
PATCH /api/admin/entries/{id}/reject
```

Admin từ chối một RaceEntry. Entry chuyển `Cancelled` (DB chỉ cho phép `Pending/Confirmed/Cancelled/Disqualified` — không có `Rejected`).

**Auth:** Admin\
**Path param:** `id` — raceEntryId (integer)

---

### Request body

```json
{ "reason": "Hồ sơ ngựa không đạt yêu cầu kiểm tra bổ sung của ban tổ chức." }
```

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| reason | string | Bắt buộc, ≥ 10 ký tự |

---

### Business rules

1. `reason` < 10 ký tự → 400.
2. Nếu `RaceEntry.Status` đã là `"Cancelled"` → 409 `ALREADY_CANCELLED`.
3. Set `RaceEntry.Status = "Cancelled"`.
4. Ghi `AuditLog`: `action = "Reject_RaceEntry"`, `newValue = "Cancelled: <reason>"`.
5. Gửi Notification đến Owner **(in-app + email)** kèm lý do.

---

### Response — 200 OK

```json
{ "success": true, "message": "Đã từ chối đăng ký." }
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `reason` < 10 ký tự |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Role không phải Admin |
| 404 | `RACE_ENTRY_NOT_FOUND` | `raceEntryId` không tồn tại |
| 409 | `ALREADY_CANCELLED` | Entry đã ở trạng thái `Cancelled` |

---

---

## Ghi chú — Screening & Auto-reject logic (REQ-F-HRS.4 + Pha 3)

Screening được chạy tại **ba thời điểm**:

1. Khi Owner **submit hồ sơ ngựa** (endpoint 1) — phân loại ngay AutoEligible/ManualReview/AutoRejected.
2. Khi Admin click **Approve** (endpoint 7) — re-screen trước khi set `Approved`.
3. Khi Owner **cập nhật trường nhạy cảm** sau khi đã `Approved` (endpoint 4) — re-screen trong cùng request.

**Phân loại screening:**

| Điều kiện | `screeningStatus` | `adminApprovalStatus` |
| --- | --- | --- |
| `Horse.DopingTestResult = "Failed"` | `AutoRejected` | `Rejected` (Admin không override) |
| `Horse.Breed ≠ Horse.Tournament.AllowedBreed` | `AutoRejected` | `Rejected` (Admin không override) |
| `Horse.DopingTestResult = "Pending"` | `ManualReview` | `Pending` (chờ Admin) |
| Breed khớp + doping `Clean` + consent | `AutoEligible` | `Approved` (tự động) |

**Breed check (schema v2):** dùng `Horse.TournamentId` trực tiếp — mỗi hồ sơ ngựa gắn đúng 1 giải; không trace qua chuỗi `RaceEntry → … → Tournament`.

---

## Ghi chú — Hoàn phí tự động (REQ-F-HRS.8, EC-32)

Khi một entry đã `Paid` bị huỷ bởi các luồng bên ngoài Module C, hệ thống **tự động** (không cần Admin) chuyển `EntryFeeStatus: Paid → Refund Pending` trong cùng transaction.

| Luồng kích hoạt | Module | Trigger |
| --- | --- | --- |
| Withdrawal (Owner rút lui hoặc quá hạn xác nhận) | E | `RaceEntry.IsWithdrawn = true` |
| Emergency Disqualification (Doctor đánh Unfit / vi phạm Independence) | G | `RaceEntry.Status = "Disqualified"` |
| Tournament Cancellation | B | Admin cancel tournament |

Sau khi hệ thống set `Refund Pending`, Admin xử lý hoàn trả ngoài hệ thống rồi cập nhật `Refunded` thủ công (endpoint riêng của Module tương ứng, không thuộc Module C).

---

## Ghi chú — Field `LegalConsentAccepted`

Field này đã được thêm vào DB qua patch `P001_add_legal_consent_to_horses.sql` và entity `Horse.cs`. Không cần migration thêm.