# HRTMS-SU26 — Horse Racing Tournament Management System

SWP391 university project. Backend: .NET 8 Clean Architecture. Frontend: React 19 + TypeScript + Vite.

---

## Repository Structure

```
HRTMS-SU26/
  backend/
    HRTMS.Core/                  Domain layer — no external dependencies
      Entities/                  25 classes mapped 1:1 to DB tables (Database-First)
      Interfaces/
        Services/                Service contracts (IAuthService, ...)
        Repositories/            Repository contracts (IUserRepository, ...)
      DTOs/                      Request/response data shapes per module
      Common/                    ApiResponse<T>, PagedResult<T>, JwtSettings
      Enums/                     Shared enums
    HRTMS.Infrastructure/        Implementation layer
      Data/
        HRTMSDbContext.cs        EF Core DbContext, Fluent API config for all tables
      Services/                  Implements IService interfaces (AuthService, JwtService)
      Repositories/              Implements IRepository interfaces
      Configuration/             Optional Fluent API split files
    HRTMS.API/                   Presentation layer
      Controllers/               HTTP endpoints — call services, return ApiResponse
      Extensions/                DI registration split by concern (DB, JWT, CORS, Swagger)
      Middleware/
        ExceptionMiddleware.cs   Global exception handler
      Program.cs                 App entry point — calls extensions only
      appsettings.json           Connection string, JwtSettings
    HRTMS.slnx                   Solution file
  frontend/
    src/
      api/                       Axios call functions per module (auth.ts, ...)
      components/                Reusable UI components
      pages/                     Screens organized by feature
      store/                     Zustand state stores (authStore.ts)
      types/
        index.ts                 Shared TypeScript interfaces and types
      utils/
        axios.ts                 Axios instance — JWT interceptor, 401 redirect
      App.tsx                    Router setup
    index.html
    package.json
    vite.config.ts
  database/
    hrtms_schema.sql             SQL Server schema — run once to create DB, no Migrations
  docs/
    SRS.md                       Software Requirements Specification (source of truth)
    GIT_GUIDE.md                 Git workflow guide
    api-contract-*.md            API contracts per module
  README.md
```

---

## Backend — Clean Architecture (3 Layers)

### Dependency Rule

```
HRTMS.API  ->  HRTMS.Infrastructure  ->  HRTMS.Core
```

Inner layers never import outer layers. Core has zero external dependencies.

---

### HRTMS.Core

Contains domain logic and contracts only. No database, no framework dependencies.

```
HRTMS.Core/
  Entities/          25 classes mapped 1:1 to SQL Server tables (Database-First)
  Interfaces/
    Services/        IAuthService, ITournamentService, ...
    Repositories/    IUserRepository, IHorseRepository, ...
  DTOs/
    Auth/            LoginDto, RegisterDto, AuthResponseDto
  Common/
    ApiResponse.cs   Unified response wrapper: { success, message, data }
    PagedResult.cs   Pagination result
    JwtSettings.cs   Config class bound from appsettings.json
  Enums/
```

Write here when: adding entities, DTOs, or defining new service/repository interfaces.

---

### HRTMS.Infrastructure

Implements interfaces defined in Core. Knows Core, does not know API.

```
HRTMS.Infrastructure/
  Data/
    HRTMSDbContext.cs    EF Core DbContext with Fluent API config for all 25 tables
  Services/
    AuthService.cs       implements IAuthService
    JwtService.cs        JWT token generation
  Repositories/          implements IRepository interfaces
  Configuration/         optional Fluent API split files
```

Write here when: implementing business logic, querying the database, calling external services.

Database-First: schema changes require re-running `Scaffold-DbContext`. Do not create Migrations.

---

### HRTMS.API

Entry point. Handles HTTP, DI registration, middleware. Knows both Core and Infrastructure.

```
HRTMS.API/
  Controllers/           Receive requests, call services, return responses
  Extensions/
    ApplicationServiceExtensions.cs   Register services and repositories
    DatabaseServiceExtensions.cs      Register DbContext + connection string
    JwtAuthExtensions.cs              JWT Bearer configuration
    CorsExtensions.cs                 CORS policy for frontend origins
    SwaggerExtensions.cs              Swagger + Bearer auth UI
  Middleware/
    ExceptionMiddleware.cs            Global exception handler -> ApiResponse
  Program.cs             Calls extensions only, no logic
  appsettings.json       ConnectionStrings, JwtSettings
```

Write here when: adding controllers, middleware, or DI configuration.

---

### How to Add a New Feature

Follow this order strictly:

**Step 1 — Core: define the contract**
```
HRTMS.Core/DTOs/Tournament/CreateTournamentDto.cs
HRTMS.Core/Interfaces/Services/ITournamentService.cs
```

**Step 2 — Infrastructure: implement the logic**
```
HRTMS.Infrastructure/Services/TournamentService.cs
```

**Step 3 — API: register DI + add controller**
```
HRTMS.API/Extensions/ApplicationServiceExtensions.cs   -> AddScoped<ITournamentService, TournamentService>()
HRTMS.API/Controllers/TournamentController.cs
```

---

### Rules

- Controllers must inject interfaces (IAuthService), never DbContext directly.
- Core must never reference Infrastructure or API namespaces.
- All API responses must use ApiResponse<T>.
- Business logic belongs in Infrastructure Services, not Controllers.

---

### API Response Format

```json
{ "success": true,  "message": "Success", "data": { ... } }
{ "success": false, "message": "Error description.", "data": null }
```

---

## Frontend — Structure and Requirements

### Stack

React 19, TypeScript, Vite, React Router v6, Axios, Zustand

### Directory Structure

```
frontend/src/
  api/           API call functions per module (auth.ts, tournament.ts, ...)
  components/    Reusable UI components
  pages/         Screens organized by feature (auth/, tournament/, ...)
  store/         Zustand stores (authStore.ts)
  types/         Shared TypeScript types and interfaces (index.ts)
  utils/
    axios.ts     Axios instance with JWT interceptor and 401 auto-redirect
```

When adding a new module (e.g. Tournament):
```
src/api/tournament.ts
src/pages/tournament/TournamentListPage.tsx
src/pages/tournament/TournamentDetailPage.tsx
src/types/index.ts              add Tournament, CreateTournamentRequest types
```

---

### FE Issues to Fix

**1. Role names must match BE exactly**

```typescript
// Current (wrong)
type Role = 'Admin' | 'HorseOwner' | 'Jockey' | 'RaceReferee' | 'Doctor' | 'Spectator'

// Correct
type Role = 'Admin' | 'Owner' | 'Jockey' | 'Race Referee' | 'Doctor' | 'Spectator'
```

**2. LoginResponse must match BE ApiResponse wrapper**

BE returns:
```json
{ "success": true, "message": "Success", "data": { "token": "...", "userId": 1, "role": "Spectator", "fullName": "..." } }
```

Update `types/index.ts`:
```typescript
interface LoginResponse {
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

**3. RegisterRequest missing optional profile fields**

BE requires additional fields depending on role:
```typescript
interface RegisterRequest {
  username: string
  fullName: string
  email: string
  password: string
  role: Role
  phoneNumber?: string         // Owner
  identityNumber?: string      // Owner
  licenseCertificate?: string  // Jockey
  experienceYears?: number     // Jockey
  selfDeclaredWeight?: number  // Jockey
  certificationLevel?: string  // Race Referee
  medicalLicenseNumber?: string // Doctor
}
```

**4. Environment variable**

Create `.env.local`:
```
VITE_API_URL=http://localhost:5000/api
```

---

## Setup

### Backend

Requires: .NET 8 SDK, SQL Server

1. Run `database/hrtms_schema.sql` against SQL Server to create the database.
2. Update `backend/HRTMS.API/appsettings.json` — set `ConnectionStrings.DefaultConnection`.
3. Run:

```bash
cd backend
dotnet run --project HRTMS.API
```

Swagger: `http://localhost:5000/swagger`

### Frontend

Requires: Node.js 20+, pnpm

```bash
cd frontend
pnpm install
pnpm dev
```

Runs at `http://localhost:5173`

---

## Git Workflow

```bash
git checkout main && git pull origin main
git checkout -b feat/feature-name

# work, commit
git add .
git commit -m "feat: description"

git push origin feat/feature-name
# open Pull Request on GitHub: feat/feature-name -> main
```

Commit prefix: `feat` `fix` `chore` `docs` `refactor`

See `docs/GIT_GUIDE.md` for details.
