# HRTMS-SU26 — Horse Racing Tournament Management System

Dự án SWP391 — Hệ thống quản lý giải đua ngựa.  
Backend: **.NET 8 Clean Architecture** · Frontend: **React 19 + TypeScript + Vite**

---

## Mục lục

1. [Cấu trúc repository](#1-cấu-trúc-repository)
2. [Backend — Kiến trúc 3 tầng](#2-backend--kiến-trúc-3-tầng)
3. [Frontend — Cấu trúc & yêu cầu](#3-frontend--cấu-trúc--yêu-cầu)
4. [Hướng dẫn cài đặt & chạy](#4-hướng-dẫn-cài-đặt--chạy)
5. [Quy trình làm việc với Git](#5-quy-trình-làm-việc-với-git)

---

## 1. Cấu trúc repository

```
HRTMS-SU26/
├── backend/          # .NET 8 Web API (Clean Architecture)
├── frontend/         # React 19 + TypeScript + Vite
├── database/         # SQL Server schema scripts
│   └── hrtms_schema.sql
├── docs/             # Tài liệu dự án
│   ├── SRS.md                    # Software Requirements Specification
│   ├── GIT_GUIDE.md              # Hướng dẫn Git workflow
│   ├── api-contract-auth.md      # API contract module Auth
│   ├── api-contract-jockey.md    # API contract module Jockey
│   └── api-contract-tournament.md
└── README.md
```

---

## 2. Backend — Kiến trúc 3 tầng

### Tại sao dùng Clean Architecture?

Clean Architecture (Onion Architecture) chia backend thành 3 tầng độc lập, giúp:

- **Dễ test** — Core không phụ thuộc database hay framework, test logic thuần
- **Dễ thay thế** — Đổi SQL Server → PostgreSQL chỉ sửa Infrastructure, không đụng Core
- **Dễ phân công** — Mỗi người làm 1 tầng, ít conflict
- **Tránh "Big Ball of Mud"** — Không nhét hết logic vào Controller

### Sơ đồ phụ thuộc

```
HRTMS.API  →  HRTMS.Infrastructure  →  HRTMS.Core
  (ngoài)          (giữa)                (trong)

Mũi tên = "biết đến / phụ thuộc vào"
Core KHÔNG biết đến Infrastructure hay API
```

Quy tắc **bất biến**: **tầng trong không bao giờ import tầng ngoài**.

---

### 2.1 HRTMS.Core — Tầng lõi (không phụ thuộc gì)

```
HRTMS.Core/
├── Entities/           # 25 class ánh xạ trực tiếp từ bảng SQL Server
│   ├── User.cs
│   ├── Horse.cs
│   ├── Tournament.cs
│   ├── Race.cs
│   ├── RaceEntry.cs
│   ├── Wallet.cs
│   ├── VirtualPointsTransaction.cs
│   ├── SpectatorProfile.cs
│   ├── JockeyProfile.cs
│   ├── OwnerProfile.cs
│   ├── RefereeProfile.cs
│   ├── DoctorProfile.cs
│   └── ... (25 files tổng)
│
├── Interfaces/
│   ├── Services/       # IAuthService, ITournamentService, ...
│   └── Repositories/   # IUserRepository, IHorseRepository, ...
│
├── DTOs/
│   └── Auth/           # LoginDto, RegisterDto, AuthResponseDto
│
├── Common/
│   ├── ApiResponse.cs  # Wrapper chuẩn cho mọi response: { success, message, data }
│   ├── PagedResult.cs  # Kết quả phân trang
│   └── JwtSettings.cs  # Config class bind từ appsettings.json
│
└── Enums/              # Các enum dùng chung (nếu có)
```

**Viết vào đây khi:** thêm entity mới, thêm DTO, định nghĩa interface service/repository mới.

---

### 2.2 HRTMS.Infrastructure — Tầng triển khai (biết Core, không biết API)

```
HRTMS.Infrastructure/
├── Data/
│   └── HRTMSDbContext.cs   # EF Core DbContext, Fluent API config cho 25 bảng
│                           # Database-First: KHÔNG có Migrations/
│
├── Services/               # Implement interface từ Core
│   ├── AuthService.cs      # implements IAuthService
│   └── JwtService.cs       # tạo/verify JWT token
│
├── Repositories/           # Implement IRepository (khi cần tách query phức tạp)
│
└── Configuration/          # Fluent API config riêng lẻ (nếu tách ra)
```

**Viết vào đây khi:** implement logic nghiệp vụ, query database, gọi service ngoài (email, SMS...).

> ⚠️ **Database-First**: Khi schema SQL thay đổi, chạy lại `Scaffold-DbContext` để cập nhật
> `HRTMSDbContext` và Entities. **Không tạo Migrations.**

---

### 2.3 HRTMS.API — Tầng trình bày (biết cả Core lẫn Infrastructure)

```
HRTMS.API/
├── Controllers/            # Nhận HTTP request, gọi Service, trả response
│   └── AuthController.cs
│
├── Extensions/             # Tách cấu hình DI ra khỏi Program.cs cho gọn
│   ├── ApplicationServiceExtensions.cs   # Đăng ký Service, Repository
│   ├── DatabaseServiceExtensions.cs      # Đăng ký DbContext + connection string
│   ├── JwtAuthExtensions.cs              # Cấu hình JWT Bearer
│   ├── CorsExtensions.cs                 # CORS policy cho frontend
│   └── SwaggerExtensions.cs              # Swagger + Bearer auth UI
│
├── Middleware/
│   └── ExceptionMiddleware.cs  # Bắt exception toàn cục, trả ApiResponse chuẩn
│
├── Program.cs              # Entry point — chỉ gọi các extension, không viết logic
├── appsettings.json        # Connection string, JwtSettings
└── appsettings.Development.json
```

**Viết vào đây khi:** thêm Controller mới, thêm middleware, cấu hình pipeline.

---

### 2.4 Cách làm việc trên cấu trúc 3 tầng

Khi thêm một tính năng mới (ví dụ: **Quản lý Tournament**), thực hiện theo thứ tự:

#### Bước 1 — Core: Định nghĩa contract

```csharp
// HRTMS.Core/DTOs/Tournament/CreateTournamentDto.cs
public class CreateTournamentDto { ... }

// HRTMS.Core/Interfaces/Services/ITournamentService.cs
public interface ITournamentService
{
    Task<ApiResponse<int>> CreateAsync(CreateTournamentDto dto);
    Task<ApiResponse<PagedResult<TournamentDto>>> GetAllAsync(int page, int size);
}
```

#### Bước 2 — Infrastructure: Implement logic

```csharp
// HRTMS.Infrastructure/Services/TournamentService.cs
public class TournamentService : ITournamentService
{
    private readonly HRTMSDbContext _context;
    // ... query database, business logic
}
```

#### Bước 3 — API: Đăng ký DI + tạo Controller

```csharp
// HRTMS.API/Extensions/ApplicationServiceExtensions.cs
services.AddScoped<ITournamentService, TournamentService>();

// HRTMS.API/Controllers/TournamentController.cs
[ApiController, Route("api/tournaments")]
public class TournamentController : ControllerBase
{
    private readonly ITournamentService _service;
    // ... nhận request → gọi service → trả ApiResponse
}
```

#### Quy tắc quan trọng

| Được phép | Không được phép |
|-----------|-----------------|
| Controller gọi Interface (`IAuthService`) | Controller inject `HRTMSDbContext` trực tiếp |
| Infrastructure dùng Entity từ Core | Core import namespace của Infrastructure |
| API cấu hình DI trong Extensions | Viết SQL raw trong Controller |
| Core chỉ chứa POCO + Interface | Infrastructure chứa DTO của API |

---

### 2.5 Response format chuẩn

Mọi API đều trả về `ApiResponse<T>`:

```json
// Thành công
{ "success": true,  "message": "Success", "data": { ... } }

// Thất bại
{ "success": false, "message": "Email hoặc mật khẩu không đúng.", "data": null }
```

---

## 3. Frontend — Cấu trúc & yêu cầu

### Stack

- **React 19** + **TypeScript** + **Vite**
- **React Router v6** — routing
- **Axios** — HTTP client (đã cấu hình interceptor JWT tự động)
- **Zustand** — state management (auth store)

### Cấu trúc thư mục

```
frontend/src/
├── api/                # Hàm gọi API theo module
│   └── auth.ts         # login(), register()
│
├── components/         # UI components tái sử dụng (Button, Input, Modal...)
│
├── pages/              # Màn hình theo tính năng
│   └── auth/
│       ├── LoginPage.tsx
│       └── RegisterPage.tsx
│
├── store/              # Zustand stores
│   └── authStore.ts    # token, user, setAuth(), logout()
│
├── types/              # TypeScript types/interfaces dùng chung
│   └── index.ts
│
├── utils/
│   └── axios.ts        # Axios instance với interceptor JWT + auto-redirect 401
│
├── App.tsx             # Router setup
└── main.tsx            # Entry point
```

### Quy ước khi thêm module mới (ví dụ: Tournament)

```
src/api/tournament.ts           # các hàm gọi API tournament
src/pages/tournament/           # các màn hình
    TournamentListPage.tsx
    TournamentDetailPage.tsx
src/types/index.ts              # bổ sung Tournament, CreateTournamentRequest...
```

---

### ⚠️ Các điểm FE cần đồng bộ với BE

#### 1. Role names phải khớp với BE

File `src/types/index.ts` hiện dùng `'HorseOwner'` — BE dùng `'Owner'`. Cần sửa:

```typescript
// HIỆN TẠI (sai)
export type Role = 'Admin' | 'HorseOwner' | 'Jockey' | 'RaceReferee' | 'Doctor' | 'Spectator'

// ĐÚNG — khớp với BE
export type Role = 'Admin' | 'Owner' | 'Jockey' | 'Race Referee' | 'Doctor' | 'Spectator'
```

#### 2. LoginResponse không khớp với BE

BE trả về `AuthResponseDto`:
```json
{ "success": true, "message": "Success", "data": { "token": "...", "userId": 1, "role": "Spectator", "fullName": "..." } }
```

FE hiện expect `{ token, user: User }` — cần cập nhật `types/index.ts`:

```typescript
// Sửa lại LoginResponse
export interface LoginResponse {
  success: boolean
  message: string
  data: {
    token: string
    userId: number
    role: Role
    fullName: string
  }
}
```

#### 3. RegisterRequest — bổ sung optional profile fields

BE yêu cầu thêm fields tùy theo `role`:

```typescript
export interface RegisterRequest {
  username: string
  fullName: string
  email: string
  password: string
  role: Role
  // Owner
  phoneNumber?: string
  identityNumber?: string
  // Jockey
  licenseCertificate?: string
  experienceYears?: number
  selfDeclaredWeight?: number
  // Race Referee
  certificationLevel?: string
  // Doctor
  medicalLicenseNumber?: string
}
```

#### 4. Biến môi trường

Tạo file `.env.local` (đã gitignore) với:
```
VITE_API_URL=http://localhost:5000/api
```

---

## 4. Hướng dẫn cài đặt & chạy

### Backend

**Yêu cầu:** .NET 8 SDK, SQL Server

```bash
cd backend

# Cập nhật connection string trong HRTMS.API/appsettings.json
# "DefaultConnection": "Server=...;Database=HRTMS;..."

# Chạy API (port mặc định 5000)
dotnet run --project HRTMS.API
```

Swagger UI: `http://localhost:5000/swagger`

> **Database-First**: Chạy `database/hrtms_schema.sql` để tạo schema trước, không dùng migrations.

### Frontend

**Yêu cầu:** Node.js 20+, pnpm

```bash
cd frontend
pnpm install
pnpm dev       # http://localhost:5173
```

---

## 5. Quy trình làm việc với Git

```bash
# Tạo branch mới từ main
git checkout main
git pull origin main
git checkout -b feat/ten-tinh-nang

# Làm việc, commit thường xuyên
git add .
git commit -m "feat: mô tả ngắn gọn"

# Push và tạo Pull Request
git push origin feat/ten-tinh-nang
# → Vào GitHub tạo PR: feat/ten-tinh-nang → main
# → Chờ review → Merge
```

**Cấu trúc commit message:**

| Prefix | Dùng khi |
|--------|----------|
| `feat:` | thêm tính năng mới |
| `fix:` | sửa bug |
| `chore:` | cleanup, cấu hình, không ảnh hưởng logic |
| `docs:` | cập nhật tài liệu |
| `refactor:` | cải thiện code, không thêm/xóa tính năng |

Chi tiết xem thêm: [`docs/GIT_GUIDE.md`](docs/GIT_GUIDE.md)
