# API Contract — Module A: Xác thực & Quản lý người dùng

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

**Roles:** Admin · Owner · Jockey · Doctor · Referee · Spectator  
**Trạng thái tài khoản:** Active · Pending · Suspended

---

## Danh sách Endpoint

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | POST | `/api/auth/register` | Không | Đăng ký tài khoản mới |
| 2 | POST | `/api/auth/login` | Không | Đăng nhập, nhận JWT |
| 3 | GET | `/api/users/me` | Mọi role | Lấy thông tin user hiện tại |
| 4 | GET | `/api/admin/users` | Admin | Danh sách users, có filter |
| 5 | PATCH | `/api/admin/users/{id}/status` | Admin | Duyệt / khóa tài khoản |

---
---

## 1. Đăng ký tài khoản

```
POST /api/auth/register
```

Không yêu cầu token.

---

### Request body

```json
{
  "username": "john_doe",
  "fullName": "Nguyen Van A",
  "email":    "john@example.com",
  "password": "Secret123!",
  "role":     "Owner"
}
```

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| username | string | 3–50 ký tự, chỉ `[a-zA-Z0-9_]` |
| fullName | string | 2–100 ký tự |
| email | string | Đúng format email, chưa tồn tại trong hệ thống |
| password | string | Tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số |
| role | string | Một trong: `Owner`, `Jockey`, `Doctor`, `Referee`, `Spectator` |

> Role `Admin` không được tự đăng ký — chỉ tạo qua seed.

---

### Business rules

- Password được hash bằng BCrypt (cost factor 12).
- `Referee` và `Doctor` được tạo với `Status = Pending`. Các role còn lại → `Status = Active`.
- Với `Spectator`: tạo `Wallet` và ghi `VirtualPointsTransactions` loại `'Sign Up Bonus'` (+1000 điểm) **trong cùng một transaction** với user (EC-47). Nếu bất kỳ bước nào lỗi → ROLLBACK toàn bộ.
- Với `Jockey` và `Referee`: bắt buộc khai báo quan hệ gia đình ruột thịt ngay tại bước đăng ký (EC-18). Khai báo lưu vào bảng `FamilyRelationshipDeclarations`. Thiếu cam kết → từ chối đăng ký. `Doctor` không khai báo ở bước này — khai báo sau khi tài khoản được duyệt `Active`.

---

### Response — 201 Created

```json
{
  "userId":  42,
  "message": "Đăng ký thành công"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu hoặc sai format field. Response kèm `fields: [{ field, message }]` |
| 409 | `EMAIL_ALREADY_EXISTS` | Email đã được dùng |
| 409 | `USERNAME_ALREADY_EXISTS` | Username đã được dùng |
| 422 | `INVALID_ROLE` | Role không hợp lệ hoặc là `Admin` |
| 500 | `REGISTRATION_FAILED` | Transaction rollback — lỗi phía server |

---
---

## 2. Đăng nhập

```
POST /api/auth/login
```

Không yêu cầu token.

---

### Request body

```json
{
  "email":    "john@example.com",
  "password": "Secret123!"
}
```

---

### Business rules

- Xác minh password qua BCrypt hash.
- Tài khoản `Suspended` → trả `403` ngay, không cấp token.
- Tài khoản `Pending` → trả `403` kèm thông báo chờ duyệt.
- JWT payload gồm: `userId`, `role`, `status`, `iat`, `exp`. Thời hạn cấu hình trong `appsettings.json`.
- Login sai mật khẩu làm tăng `FailedLoginAttempts`. Khi đạt ngưỡng cấu hình, hệ thống set `LockoutEnd` và trả `423 ACCOUNT_LOCKED` cho đến khi hết thời gian khóa.

---

### Response — 200 OK

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId":   42,
    "username": "john_doe",
    "fullName": "Nguyen Van A",
    "email":    "john@example.com",
    "role":     "Owner",
    "status":   "Active"
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu field |
| 401 | `INVALID_CREDENTIALS` | Email không tồn tại hoặc sai mật khẩu |
| 403 | `ACCOUNT_SUSPENDED` | Tài khoản bị khóa |
| 403 | `ACCOUNT_PENDING` | Referee / Doctor chờ Admin duyệt |
| 423 | `ACCOUNT_LOCKED` | Quá số lần đăng nhập sai, tài khoản tạm khóa |

---
---

## 3. Lấy thông tin người dùng hiện tại

```
GET /api/users/me
```

Trả thông tin của user đang đăng nhập, lấy từ JWT claim.

**Auth:** Bất kỳ role nào (đã đăng nhập)

---

### Response — 200 OK

```json
{
  "userId":    42,
  "username":  "john_doe",
  "fullName":  "Nguyen Van A",
  "email":     "john@example.com",
  "role":      "Owner",
  "status":    "Active",
  "createdAt": "2026-06-13T08:00:00Z"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu, hết hạn hoặc không hợp lệ |
| 403 | `ACCOUNT_SUSPENDED` | Middleware phát hiện tài khoản bị khóa trong DB |

---
---

## 4. Danh sách người dùng (Admin)

```
GET /api/admin/users
```

**Auth:** Admin

---

### Query params

| Tham số | Kiểu | Mặc định | Ghi chú |
|---------|------|----------|---------|
| role | string | — | Lọc theo role |
| status | string | — | `Active`, `Pending`, hoặc `Suspended` |
| page | int | 1 | |
| pageSize | int | 20 | Tối đa 100 |

---

### Response — 200 OK

```json
{
  "data": [
    {
      "userId":    5,
      "username":  "referee_01",
      "fullName":  "Tran Thi B",
      "email":     "referee01@example.com",
      "role":      "Referee",
      "status":    "Pending",
      "createdAt": "2026-06-12T10:00:00Z"
    }
  ],
  "pagination": {
    "page":       1,
    "pageSize":   20,
    "total":      35,
    "totalPages": 2
  }
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Không phải Admin |

---
---

## 5. Cập nhật trạng thái tài khoản (Admin)

```
PATCH /api/admin/users/{id}/status
```

Duyệt tài khoản Pending hoặc khóa / mở khóa user. (EC-29)

**Auth:** Admin

**Path param:** `id` — userId (integer)

---

### Request body

```json
{
  "status": "Suspended",
  "reason": "Vi phạm quy định thi đấu"
}
```

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| status | string | `Active` hoặc `Suspended` |
| reason | string | Bắt buộc khi `status = Suspended` |

---

### Business rules

- Admin không thể thay đổi trạng thái tài khoản của chính mình.
- Khi khóa (`Suspended`): JWT hiện tại của user bị blacklist trên Redis, từ chối ngay lập tức (EC-29).
- Khi duyệt Referee / Doctor (`Pending → Active`): gửi notification qua `INotificationService`.

---

### Response — 200 OK

```json
{
  "userId":  5,
  "status":  "Suspended",
  "message": "Cập nhật trạng thái thành công"
}
```

---

### Lỗi

| HTTP | Mã lỗi | Khi nào xảy ra |
|------|--------|----------------|
| 400 | `VALIDATION_ERROR` | Thiếu `reason` khi suspend |
| 403 | `FORBIDDEN` | Admin tự tác động vào tài khoản mình |
| 404 | `USER_NOT_FOUND` | `id` không tồn tại |
| 409 | `STATUS_UNCHANGED` | Trạng thái đã là giá trị yêu cầu |

---
---

## Middleware kiểm tra trạng thái

Mọi request có JWT đều qua middleware này trước khi vào controller:

```
Request đến
  → Xác minh chữ ký và hạn JWT
  → Lấy trạng thái user từ DB (hoặc Redis cache, TTL 30 giây)
  → Kiểm tra status
       Active    → tiếp tục xử lý
       Pending   → 403 ACCOUNT_PENDING
       Suspended → 401 ACCOUNT_SUSPENDED
```

> Cache `userId → status` trong Redis với TTL 30s để tránh query DB mỗi request.

---
---

## JWT Payload

```json
{
  "userId": 42,
  "role":   "Owner",
  "status": "Active",
  "iat":    1749801600,
  "exp":    1749805200
}
```

Ánh xạ sang C# ClaimTypes:

| JWT field | C# ClaimType |
|-----------|--------------|
| userId | `ClaimTypes.NameIdentifier` |
| role | `ClaimTypes.Role` |
| status | custom — `"status"` |

---
---

## Seed data bắt buộc

Chạy một lần trước demo ngày 17/06.

```sql
-- Tài khoản Admin (thay <bcrypt_hash> bằng hash thực)
INSERT INTO Users (Username, FullName, Email, PasswordHash, Role, Status, CreatedAt)
VALUES ('admin', 'System Admin', 'admin@hrtms.local', '<bcrypt_hash>', 'Admin', 'Active', GETUTCDATE());

-- 7 mã vi phạm
INSERT INTO ViolationCodes (Code, Description, DefaultPenaltyPoints) VALUES
  ('VC-01', 'Thiết bị không hợp lệ',           10),
  ('VC-02', 'Xuất phát sai',                    5),
  ('VC-03', 'Cản trở đối thủ',                  15),
  ('VC-04', 'Sai lệch cân nặng',                20),
  ('VC-05', 'Hành vi không phù hợp',            25),
  ('VC-06', 'Vi phạm doping',                   50),
  ('VC-07', 'Không thực hiện cân sau đua',      10);
```
