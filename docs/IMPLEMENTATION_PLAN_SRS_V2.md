# Implementation Plan theo SRS

Ngày cập nhật: 2026-06-28

| Module | Mảng | Controller/Service chính | Trạng thái | Chủ |
| --- | --- | --- | --- | --- |
| A | Auth/Account | `AuthController`, `AdminController`, `AuthService`, `ProfileService` | \~85% — thiếu Admin create account, update profile chung | Hào |
| B | Tournament | `TournamentController`, `TournamentSevice` (580d) | \~90% — cần rà cancellation flow ACID (TRN.10) | An |
| C | Horse | `HorseController`, `AdminController`, `HorseService` (543d) | \~85% — rà auto-reject (HRS.4), re-validate (HRS.6), refund (HRS.8) | An |
| D | Jockey/Pairing | `JockeyController`, `PairingController`, `PairingService` (368d) | \~80% — **thiếu Owner confirm pairing (JOC.6)** | Phong |
| E | Scheduling/Draw | `SchedulingController`, `RaceEntryService` (535d) | \~85% — rà double-booking (SCH.8), MaxHorses (SCH.7), freeze config (SCH.9) | An |
| F | Referee COI | `RefereeAssignmentController`, `RefereeAssignmentService` | \~90% — rà re-run COI (REF.5), 1 Lead Referee (REF.3) | Phong |
| G | Pre-race checks | `DoctorAssignmentController`, `MedicalCheckController`, `IndependenceCheckController`, `StartingListController` | \~85% — thiếu post-race weigh-out | Phong |
| H | Race live/violations | **KHÔNG có controller** | **\~20%** — thiếu transition Live, Violations, Unofficial | Phong |
| I | Protest | Entity có; **KHÔNG có** `ProtestController` | **\~10%** — thiếu toàn bộ submit/investigate/rule | Phong |
| J | Declare Official | `ResultController`, `ResultService` (500d) | \~85% — đã có ACID + guard, rà refund Protest-DQ | An |
| K | Purse/Prize | `PursePayoutController`, `PursePayoutService` | \~80% — rà remainder (PRZ.4), internal split (PRZ.3) | An |
| L | Leaderboard | `ResultService.UpdateLeaderboardPoints` (ghi điểm) nhưng **KHÔNG có controller đọc** | **\~30%** — thiếu API leaderboard + standings + polling | An |
| M | Prediction | `PredictionController`, `PredictionService` (318d) | \~85% — rà gate chỉ mở sau draw (PRD.2), server gate (PRD.6) | An |
| N | Reconciliation | `ReconciliationController` (read), reward trong `ResultService` | \~80% — đủ read; rà reward +200 & email (REC.2, REC.5) | An |
| O | Notification | `NotificationController`, `NotificationService` | \~70% — **thiếu SMTP email (NOTI.2)**, rà đủ event (NOTI.3) | Hào |
| P | Reports | **KHÔNG có controller** | **0%** — thiếu CSV/PDF export | Hào (hoặc An) |
| Q | Security/Audit | `AuditLogService`, `TokenBlacklistService`, `JwtService` | \~80% — ✅ append-only DB đã có (trigger `trg_AuditLogs_AppendOnly` + `trg_RaceReports_Immutable` trong `database/hrtms_schema.sql`); còn rà đủ audit event | Hào |

---

## Task chi tiết theo thành viên

### 1 Hào — BE1 — Module A, O, Q (+ P optional)

**Đã có:** đăng ký theo role, login/logout JWT, `/me` + `/profile`, suspend/activate, approve Jockey/Referee/Doctor, list users, pending-approvals, audit-logs GET, SignUp Bonus +1000 nguyên tử (`AuthService` dòng \~152–175), TokenBlacklist + middleware.

**Còn thiếu / cần làm:**

#### Module A — Account

- [ ] **Làm rõ Owner onboarding theo v2.** SRS v2 (ACC.1.6) cho Owner `Active` ngay. Quyết định: bỏ luồng Owner-pending hay giữ. Cập nhật `AuthService.RegisterAsync` cho đúng. (giải quyết dòng "Pending→Active cho Owner" trong ảnh)

- [ ] **ACC.2 — Admin tạo tài khoản:** thêm `POST /api/admin/users` trong `AdminController` (tạo bất kỳ role kể cả Admin), validate như self-register, ghi `AuditLogs`. *Hiện chưa có HttpPost nào trong AdminController.*

- [ ] **ACC.3 — Update profile/đổi mật khẩu chung:** thêm `PATCH /api/auth/me` + `POST /api/auth/change-password` (xác thực mật khẩu hiện tại). Hiện chỉ Jockey có `PATCH /api/jockeys/profile`.

- [ ] **ACC.1 / ACC.1A — Bắt buộc định danh theo nhóm role (KHÔNG phải mọi role giống nhau):**

  - **Owner/Jockey/Referee/Doctor:** bắt buộc đủ `email + phoneNumber + dateOfBirth + identityNumber` → thiếu bất kỳ trường nào thì **chặn đăng ký/hoàn tất profile** (ACC.1A.1).
  - **Spectator:** đăng ký tối giản (email/username/password); chỉ **bổ sung phone + identity khi redeem ticket code / nhận reward** (ACC.1.2). Không ép nhập CCCD lúc đăng ký.
  - **Admin:** không tự đăng ký — do Admin khác tạo (ACC.2).
  - `email` UNIQUE toàn hệ thống; email/phone **normalize** trước khi lưu & trước khi matching.

- [ ] **Lưu CCCD an toàn (Restricted) — schema đã sẵn, code phải dùng đúng:** `hrtms_schema.sql` lưu `Users.IdentityNumberEncrypted VARBINARY(512)` + `Users.IdentityHash VARBINARY(32)` — **KHÔNG có cột plain text**. `AuthService` phải: encrypt CCCD trước khi lưu, set `IdentityHash` (SHA-256 deterministic), KHÔNG bao giờ trả raw identity ra API.

  - Lưu ý: schema mới **gỡ bỏ** `OwnerProfiles.IdentityNumber` (OwnerProfiles chỉ còn `OwnerId`). Identity chỉ ở `Users` (encrypted+hash). Mâu thuẫn trong text SRS (OwnerProfiles.IdentityNumber UNIQUE) đã được schema giải quyết — **dùng theo schema**.

- [ ] **CHỐT: CCCD = đúng 12 số (validate app-layer).** Schema lưu CCCD dạng đã mã hóa (VARBINARY) nên **DB không check được độ dài** → phải validate ở backend trước khi encrypt: regex `^\d{12}$`, từ chối CMND 9 số. Cập nhật data dictionary SRS (AS-D2, dòng 5667) chốt 12 số, bỏ phương án "CMND 9 / CCCD 12".

- [ ] **DB đã cưỡng chế bắt buộc định danh theo role:** constraint `CHK_Users_ProfessionalIdentity` (schema dòng 59–62) đã bắt Owner/Jockey/Referee/Doctor phải có Phone + DOB + IdentityEncrypted + IdentityHash, miễn trừ Admin/Spectator. App-layer validate trùng logic để báo lỗi đẹp, nhưng DB là chốt chặn cuối.

#### Module O — Notification

- [ ] **NOTI.2 — SMTP email:** implement `IEmailService` (hiện `NotificationService` dòng 12, 38 chỉ có TODO). Gửi email cho event 2 kênh; SMTP lỗi không được làm mất bản ghi in-app.

- [ ] **NOTI.3 — Đủ danh mục event:** rà `NotificationService` đảm bảo có notification khi: horse rejected (kèm lý do), jockey invite mới, referee assigned, protest ruling (closed-loop 2 bên), schedule change khẩn, prediction reconciliation. Bổ sung event còn thiếu.

#### Module Q — Security/Audit

- [ ] **SEC.6 — Append-only DB:** apply patch `P009` (đã có file) + thêm DENY UPDATE/DELETE cho app role; verify update/delete `AuditLogs` bị chặn ở DB.

- [ ] **SEC.5 — Đủ audit event:** rà `AuditLogService` được gọi cho: tạo/sửa/hủy giải, duyệt hồ sơ, bốc thăm, phân công Doctor/Referee, đổi lịch, Withdrawal, Emergency DQ, Declare Official, update Paid/Unpaid, `Update_Entry_Fee_Status`.

- [ ] **SEC.2 — Session timeout:** xác nhận JWT có expiry + refresh/timeout theo NFR.

#### Module P — Reports (Low, có thể giao An nếu Hào quá tải)

- [ ] **RPT.1/2/3** — `ReportController`: export CSV + PDF/print, lọc dữ liệu theo RBAC (UI-S18).

**Acceptance:** register role professional thiếu identity → reject; Admin tạo account ghi audit; email gửi đúng event; `AuditLogs` không sửa/xóa được ở DB.

---

### 2 An — BE2 — Module B, C, E, J, K, L, M, N

**Đã có:** Tournament CRUD + status + prize-distributions + rounds/races (`TournamentController` 248d, service 580d); Horse CRUD + admin approve/reject + fee-status; RaceEntry tạo/draw/confirm/withdraw (`SchedulingController` + `RaceEntryService` 535d); Declare Official ACID 6 bước + idempotent guard + check pending protests (`ResultService` 500d); Purse payout (`PursePayoutController`); Prediction gate/place/form-score (`PredictionService` 318d); Reconciliation read (`ReconciliationController`).

**Còn thiếu / cần rà:**

#### Module B — Tournament

- [ ] **TRN.10 — Cancellation flow ACID:** xác nhận `DELETE /api/tournament/{id}` (hoặc cancel) thực hiện trong 1 transaction: hủy RaceEntry, refund prediction Pending, entry Paid → `Refund Pending`, vô hiệu Pairing/PursePayout, notify, audit. Nếu `DELETE` hiện chỉ xóa cứng → viết lại thành cancel-flow.

- [ ] **TRN.8 — State machine:** chặn transition sai thứ tự; chặn set Tournament sang `Pre-Race/Live`; chỉ `Completed` khi mọi Race `Official/Cancelled`.

- [ ] **TRN.11 — Roster screening:** rà `TournamentParticipantService` set `ScreeningStatus` (AutoEligible/ManualReview/AutoRejected) đúng; Owner Active → Approved ngay, không vào queue.

#### Module C — Horse

- [ ] **HRS.4 — Auto-reject:** verify `HorseService` auto-reject khi `Breed ≠ Tournament.AllowedBreed` hoặc `DopingTestResult = Failed`; Admin không override được auto-reject cứng.

- [ ] **HRS.6 — Re-validate sau Approved:** sửa field nhạy cảm (Doping/Breed/Vaccination/DopingDate) → đưa về `Pending`, treo Pairing, chạy lại auto-reject.

- [ ] **HRS.5/7 — Khóa duyệt khi chưa Paid:** nút approve hồ sơ khóa cứng khi `EntryFeeStatus ≠ Paid`; reason reject ≥ 10 ký tự.

- [ ] **HRS.8 — Auto Refund Pending:** khi withdraw/emergency DQ/cancel → entry Paid tự `Refund Pending` cùng transaction.

#### Module E — Scheduling

- [ ] **SCH.2 — Draw atomic:** verify `POST /admin/races/{id}/draw` gán trong 1 transaction, đảm bảo `UNIQUE(RaceId, PostPosition)`, set `IsPostPositionDrawn = true`.

- [ ] **SCH.7 — MaxHorses:** chặn tạo entry khi đạt `Tournament.MaxHorses`; không áp số tối thiểu.

- [ ] **SCH.8 — Double-booking:** chặn cùng ngựa/jockey ở 2 race chồng giờ, và trùng trong cùng race.

- [ ] **SCH.9 — Freeze config:** sau draw / có prediction → khóa sửa `ScheduledTime/RaceDistanceOverride/TrackTypeOverride`; muốn đổi → hủy race + refund prediction.

#### Module J — Results (đã mạnh)

- [ ] **RES.3 bước 3:** rà refund Prediction Pending trên cặp DQ/Cancelled nằm trong transaction Declare Official.

#### Module K — Purse

- [ ] **PRZ.2/4 — Remainder:** phân bổ nạp từ `PrizeDistributions` (không hard-code), xử lý đồng hạng chia trung bình %, phần dư ghi `Remainder` không thất thoát.

- [ ] **PRZ.3 — Internal split:** Jockey 10% nhất / 5% nhì–tư / phí cố định ngoài top; Owner phần còn lại.

#### Module L — Leaderboard (THIẾU CONTROLLER)

- [ ] **LDR.1/2 —** `LeaderboardController`**:** `GET /api/leaderboard/horses?tournamentId=&mode=points|earnings`, `GET /api/leaderboard/jockeys` (wins, top, win-rate, earnings). Đọc từ `RaceEntries.PointsAwarded` + `PursePayouts` (chỉ race `Official`).

- [ ] **LDR.3/4 — Polling:** đảm bảo endpoint read `READ COMMITTED`, FE polling ≥ 30s (không WebSocket).

#### Module M — Prediction

- [ ] **PRD.2 — Gate chỉ mở sau draw:** chặn mở gate khi `IsPostPositionDrawn = false`.

- [ ] **PRD.5 — Ticket reward code:** thêm `TicketRewardCode` entity/DbSet/service + redeem (cộng `Ticket Code Bonus` vào VPT). *Schema v2 có bảng mới này.*

- [ ] **PRD.6 — Server gate:** chặn nhận prediction khi gate đóng hoặc race ≠ `Upcoming` (server-side).

#### Module N — Reconciliation

- [ ] **REC.2/5:** verify reward +200 `Prediction Win Reward` ghi sổ cái trong transaction Official; gửi notification (in-app + email) sau commit.

**Acceptance:** Declare Official idempotent (bấm 2 lần không nhân đôi thưởng); leaderboard chỉ tính race Official; gate đóng khi Live; cancel giải hoàn điểm + refund pending trong 1 transaction.

---

### 3 Phong — BE3 — Module D, F, G, H, I

**Đã có:** Jockey profile/available/invitations (`JockeyController`); Pairing create/accept/decline (`PairingController` 294d, service 368d); Referee assign/get/remove + COI (`RefereeAssignmentController` + service 227d); Doctor assign/get/remove (`DoctorAssignmentController` + service 214d); Medical pre-race-weight/horse-identity/clinical-check (`MedicalCheckController` 297d); Independence check (`IndependenceCheckController`); Confirm starting list (`StartingListController`); Emergency DQ (`EmergencyDisqualificationService` 194d).

**Còn thiếu / cần làm:**

#### Module D — Pairing

- [ ] **JOC.6 — Owner confirm pairing (THỰC SỰ THIẾU):** thêm `PATCH /api/pairings/{id}/confirm` (Role Owner) trong `PairingController` + method trong `PairingService`. Flow: Jockey accept → status `Accepted` → Owner confirm lần cuối → `Confirmed`. Chỉ `Confirmed` mới được allocate vào RaceEntry (SCH.1). (đúng dòng critical trong ảnh)

- [ ] **JOC.7 — Re-check experience:** verify `ExperienceYears ≥ MinJockeyExperienceYears` lúc gửi invite VÀ re-check lúc tạo RaceEntry.

- [ ] Chuẩn hóa status pairing: `Pending/Accepted/Declined/Confirmed/Cancelled`.

#### Module F — Referee COI

- [ ] **REF.3 — Đúng 1 Lead Referee:** verify filtered UNIQUE chặn Lead thứ hai (service đã có `LEAD_REFEREE_ALREADY_EXISTS`).

- [ ] **REF.5 — Re-run COI:** khi family declaration của Referee đổi → tự chạy lại COI cho assignment active, đình chỉ nếu xung đột mới.

#### Module G — Pre-race

- [ ] **MED.1 — Doctor COI gate:** verify backend chỉ chấp nhận thao tác cân/khám/Unfit của Doctor đã assigned + COI `Passed`.

- [ ] **Post-race weigh-out (THIẾU):** thêm endpoint Doctor ghi `PostRaceJockeyWeight` (ví dụ `PATCH /api/doctor/race-entries/{id}/post-race-weight`) — `ResultService` đã check `IsPostRaceWeighInComplete` nhưng chưa có chỗ ghi. Gắn cờ chênh lệch &gt; `PostRaceWeightDiffThresholdKg`.

#### Module H — Race operation (THIẾU CONTROLLER — ưu tiên cao)

- [ ] **RACE.1 —** `RaceController` **transition Live:** `PATCH /api/referee/races/{id}/go-live`: auto-cancel entry `Pending` đồng bộ, verify mọi cặp còn lại `Confirmed` + có PreRaceWeight + Fit + identity matched + Independence Passed; thiếu → chặn.

- [ ] **RACE.2 — Đóng gate khi Live:** set `IsPredictionGateClosed = true` khi chuyển Live (phối hợp An/PredictionService).

- [ ] **RACE.4/5 —** `ViolationController`**:** ghi vi phạm bằng dropdown ≥ 7 mã (seed); sửa/xóa chỉ trước khi chốt sơ bộ. Cần entity `Violation` + DbSet (entity đã tồn tại).

- [ ] **RACE.7 — Post-race weigh-out:** (xem Module G) chặn chốt biên bản nếu còn cặp chưa cân.

- [ ] **RACE.8 — Chốt Unofficial:** `PATCH /api/referee/races/{id}/finalize-unofficial`: validate `FinishPosition` standard ranking (cho đồng hạng `1,1,3`), mọi cặp có PostRaceWeight → chuyển `Unofficial` + tạo `RaceReport`.

#### Module I — Protest (THIẾU CONTROLLER — ưu tiên cao)

- [ ] **PRT.1/2 —** `ProtestController` **submit:** `POST /api/protests` chỉ Owner/Jockey của cặp hợp lệ trong chính race đó; chỉ khi race `Unofficial`, trong `ProtestDeadlineMinutes` (default 120), giới hạn số lần; sau Official chặn.

- [ ] **PRT.3 — Investigate & rule:** `PATCH /api/protests/{id}/ruling` (Referee): `Disqualified/PlaceBehind/Warning/Scratch`, cập nhật thứ hạng.

- [ ] **PRT.4 — Closed-loop notify:** notify in-app + email cả 2 bên kèm phán quyết + thứ hạng mới.

- [ ] **PRT.5 — Re-check ranking:** sau điều chỉnh chạy lại standard-ranking integrity, áp "kéo lên", chặn Declare nếu chưa chuẩn hóa.

- [ ] **PRT.6/7 — RaceReport:** lập biên bản đầy đủ; sau `IsLocked = true` (lúc Official) chặn UPDATE/DELETE ở DB (phối hợp Hào — trigger).

**Acceptance:** Owner phải confirm pairing trước khi vào entry; race không Live được nếu thiếu điều kiện; protest chỉ nộp được trong cửa sổ Unofficial; biên bản khóa sau Official không sửa được.

---

### 4 Thiện — FE1 — Admin workspace (+ tích hợp role khác)

**Đã có:** `AdminLayout` + `AdminSidebar`; routes `/admin` (index Dashboard, approval-center, users, tournaments, tournament-builder, tournament-builder/:id); `AdminDashboard` (207d), `ApprovalCenter` (257d), `UserManagement` (306d), `TournamentBuilder` + 4 tab (BasicInfo, RoundsRaces, PrizeDistribution, PostPositionDraw); services `adminService`, `approvalService`, `raceEntryService`, `tournamentService`, `apiClient`.

**Còn thiếu / cần làm (theo Screen Inventory v2):**

- [ ] **UI-S10 Approval Center — đồng bộ API v2:** đảm bảo dùng API thật BE1/BE2 (approve/reject Jockey/Referee/Doctor/Horse, reason ≥ 10 ký tự, nút duyệt horse khóa khi chưa Paid). Hiển thị duplicate/COI warnings (ACC.8).

- [ ] **UI-S11 Race detail (Admin) — THIẾU:** trang chi tiết Race với actions: Post Position Draw, Assign Referee (1 Lead), Assign Doctor, xem trạng thái medical/COI từng entry. Map `RefereeAssignmentController` + `DoctorAssignmentController` + `SchedulingController/draw`.

- [ ] **UI-S13 Declare Official — THIẾU:** danh sách race `Unofficial` (`GET /api/races/unofficial`) + modal xác nhận → `POST /api/races/{id}/declare-official`. Disable biên bản sau Official.

- [ ] **UI-S14 Purse Payout — THIẾU:** xem payout theo race (`GET /api/races/{raceId}/payouts`), cập nhật Paid/Unpaid (`PUT /api/payouts/{id}/status`), earnings history.

- [ ] **UI-S06 Leaderboard — THIẾU (mọi role):** trang leaderboard ngựa + jockey standings, polling ≥ 30s, đợi `LeaderboardController` của An.

- [ ] **UI-S17 Audit Log viewer — THIẾU:** bảng đọc `GET /api/admin/audit-logs` (đã có API), filter theo action/actor/time.

- [ ] **UI-S18 Reports — THIẾU:** export CSV/PDF (đợi `ReportController`).

- [ ] **Status badge v2:** cập nhật `StatusBadge` cho Tournament (`Draft/Open Registration/Closed Registration/Completed/Cancelled`) và Race (`Upcoming/Pre-Race/Live/Unofficial/Official/Cancelled`).

- [ ] **Integration rule:** ưu tiên API thật; mock phải đánh dấu rõ trong code; BE merge xong → gỡ mock; lỗi API hiển thị message rõ.

**Acceptance:** Admin thao tác trọn workflow race (draw → assign → go-live đợi referee → declare official) từ UI; không còn mock im lặng cho feature đã có API; badge hiển thị đúng status v2.

---

### 5 Vinh — FE2 — Owner / Jockey / Doctor / Spectator workspaces

**Đã có:** layout + page khung cho cả 4 role (Owner: `MyHorses`, `RegisterHorse`, `HorseDetail`, `RaceEntries`, `TournamentList`, `ScheduleConfirm`, `JockeyInvite`; Jockey: `InvitationList`, `MyRaces`, `RaceHistory`, `ProfileDeclaration`; Doctor: `DoctorDashboard`, `PaddockConsole`; Spectator: `SpectatorHome`, `PredictionPage`, `WalletTransactions`, `MyPredictions`). Nhiều page UI đã đẹp nhưng **còn chạy mock**, và `jockeyService.ts` có URL sai.

> Đối chiếu ảnh ↔ code (đã verify 2026-06-28): một số mục trong ảnh đã cũ — ghi lại đúng trạng thái bên dưới.

**Còn thiếu / cần làm:**

- [ ] **fix URL — `services/jockeyService.ts` (verify lại từng dòng):**
  - `getMyProfile` / `updateProfile`: **đã đúng** `…/api/jockeys/profile` (ảnh ghi "my-profile → profile" — đã fix sẵn, chỉ cần verify).
  - `getMyInvitations`: **đã đúng** `…/api/jockeys/invitations` (verify).
  - **SAI — phải sửa:** `respondToInvitation` đang gọi `PUT /api/jockey-invitations/{id}/respond` (endpoint không tồn tại) → đổi sang `PATCH /api/pairings/{id}/accept` và `PATCH /api/pairings/{id}/decline` (Role Jockey).
  - **SAI — endpoint chưa có ở BE:** `getMyRaces` gọi `/api/race-entries/jockey/my`, `getMyRaceHistory` gọi `/api/race-results/jockey/my` → chốt với Phong/An tạo endpoint hoặc đổi URL cho khớp BE.
  - Bỏ hard-code `http://localhost:5222` → dùng `apiClient` baseURL chung.
- [ ] **fix route — `App.tsx`:** route Owner mời jockey hiện là `path="jockey-invite"` (đã có, render `JockeyInvite`). Ảnh đề xuất `/owner/invite-jockey` → thống nhất 1 tên route + cập nhật link điều hướng cho khớp (chỉ là đổi tên/verify, không phải thiếu hẳn).
- [ ] **build — JockeyDashboard:** route `/jockey` index đang render `<div>Jockey Dashboard</div>` (App.tsx dòng ~124). File `pages/jockey/JockeyDashboard.tsx` **đã tồn tại** → chỉ cần import và wire vào route thay placeholder (không phải build từ đầu).
- [ ] **wire — `MyHorses.tsx`** → `GET /api/horses/my` (Owner) thật. (Verify: file này không bị grep mock — có thể đã wire, cần xác nhận.)
- [ ] **wire — `InvitationList.tsx`** (đang mock) → `GET /api/jockeys/invitations` thật; nút accept/decline → `PATCH /api/pairings/{id}/accept|decline`.
- [ ] **wire — `ScheduleConfirm.tsx`** (đang mock) → `PATCH /api/race-entries/{id}/confirm` (Owner) thật; xử lý lỗi quá hạn cut-off (SCH.4/5).
- [ ] **wire — `PredictionPage.tsx`** (đang mock) → `GET /api/predictions/races/{raceId}/gate-status`, `GET …/form-scores`, `POST /api/predictions` (Spectator). Disable đặt cược khi gate đóng / race ≠ Upcoming (PRD.6).
- [ ] **wire — `PaddockConsole.tsx`** (đang mock, UI đẹp sẵn) → `PATCH /api/doctor/race-entries/{id}/pre-race-weight`, `…/horse-identity`, `…/clinical-check`. **Lưu ý:** endpoint **post-race weigh-out chưa có ở BE** (Phong cần tạo) — nếu console có phần cân sau đua thì chờ endpoint đó.
- [ ] **Integration rule:** ưu tiên API thật; mock phải đánh dấu rõ; BE merge xong → gỡ mock; lỗi API hiển thị message rõ cho user.

**Acceptance:** 4 workspace (Owner/Jockey/Doctor/Spectator) chạy bằng API thật, không còn mock im lặng cho feature đã có endpoint; `jockeyService` không còn URL sai/hard-code host; JockeyDashboard hiển thị nội dung thật thay vì placeholder.

---