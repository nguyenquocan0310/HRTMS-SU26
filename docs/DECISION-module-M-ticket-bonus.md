# Decision Checkpoint — Module M: Ticket Code Bonus & Reward 200

> Trạng thái: **ĐÃ IMPLEMENT** (Ticket Code Bonus — nhóm chốt build). Reward 200: đã xác nhận, không cần sửa.
> Người audit: An | Ngày: 2026-07-10 | Branch: `feat/module-m-wallet-closing`
> Phạm vi: chỉ backend Module M. Không sửa FE. Không sửa trực tiếp `database/hrtms_schema.sql`.

## CHỐT — Ticket Code Bonus đã triển khai

Nhóm quyết định implement. Đã giao (không cần SQL patch — table `TicketRewardCodes` sẵn trong schema gốc):

| Thành phần | File |
| --- | --- |
| DTO request/response | `backend/HRTMS.Core/DTOs/Wallet/RedeemTicketCodeDto.cs` |
| Interface | `backend/HRTMS.Core/Interfaces/Services/IWalletService.cs` |
| Service (redeem logic) | `backend/HRTMS.Infrastructure/Services/WalletService.cs` |
| Controller endpoint | `backend/HRTMS.API/Controllers/WalletController.cs` — `POST /api/wallet/ticket-codes/redeem` (role Spectator) |
| DI | `backend/HRTMS.API/Extensions/ApplicationServiceExtensions.cs` |
| Tests (6, SQLite in-memory) | `backend/HRTMS.Tests/WalletServiceTicketCodeTests.cs` |

**Đảm bảo nghiệp vụ:** hash mã (SHA-256 → CodeHash VARBINARY(32)); validate tồn tại / Active / chưa hết hạn; claim nguyên tử bằng `ExecuteUpdateAsync ... WHERE Status='Active' AND ExpiresAt > now` (affected==1) → chống double-redeem kể cả đồng thời; cộng ví + ghi VPT `Type='Ticket Code Bonus'`, `ReferenceType='TicketRewardCode'` cùng transaction; lỗi/không có ví → rollback (code không bị đánh dấu Redeemed). Test bao: success, không tồn tại, hết hạn, đã dùng, redeem hai lần (chỉ cộng một lần), rollback.

Phần bên dưới là audit gốc (giữ lại làm evidence).

---

---

## 1. Ticket Code Bonus

### 1.1 SRS có bắt buộc không? → CÓ

| Bằng chứng | Vị trí | Nội dung |
| --- | --- | --- |
| BR-63 | `docs/SRS.md:552` | "Spectator nhập mã vé trước prediction để nhận điểm; mỗi code dùng một lần; cộng điểm qua VPT `Ticket Code Bonus`; không update balance nếu không có ledger" |
| REQ-F-PRD.5 | `docs/SRS.md:3301` | "...Spectator **có thể** nhập ticket reward code mua trực tiếp tại trường đua để nhận thêm điểm qua `Ticket Code Bonus`" |
| Data model — bảng TicketRewardCodes | `docs/SRS.md:4194` | Định nghĩa entity: CodeHash UNIQUE, Points>0, Status IN (Active/Redeemed/Expired/Disabled), một code chỉ redeem một lần |
| VPT Type | `docs/SRS.md:320`, `:4205` | `Ticket Code Bonus` là một trong các loại giao dịch hợp lệ |
| Phase 5 rule | `docs/SRS.md:1208-1215` | Ledger phải tạo VPT Type=`Ticket Code Bonus`; code gắn Tournament/Race optional, có hạn dùng, có trạng thái |
| Use case UC-33 | `docs/SRS.md:5786` | "Spectator nhập ticket reward code" — actor Spectator |

**Kết luận:** Không phải nghiệp vụ tự suy đoán — SRS định nghĩa đầy đủ entity, business rule, ledger contract, use case. Priority của PRD.5 = High; từ khoá "**có thể** nhập" cho thấy đây là luồng **tuỳ chọn** của Spectator (không chặn prediction nếu không nhập code — xác nhận tại `docs/SRS.md:1528`).

### 1.2 Code hiện tại đã có gì? → Infra scaffold 100%, thiếu redeem flow

| Thành phần | Trạng thái | Vị trí |
| --- | --- | --- |
| Bảng `TicketRewardCodes` | ✅ Đã có trong schema | `database/hrtms_schema.sql:539-554` |
| Entity `TicketRewardCode` | ✅ Đã có | `backend/HRTMS.Core/Entities/TicketRewardCode.cs` |
| DbSet + Fluent config (index, UNIQUE CodeHash, FK) | ✅ Đã có | `backend/HRTMS.Infrastructure/Data/HRTMSDbContext.cs:57, 723-741` |
| Nav `SpectatorProfile.TicketRewardCodes` | ✅ Đã có | `backend/HRTMS.Core/Entities/SpectatorProfile.cs:16` |
| VPT hỗ trợ Type=`Ticket Code Bonus`, ReferenceType=`TicketRewardCode` | ✅ CHECK constraint đã có | `database/hrtms_schema.sql:568-569` |
| Redeem service / method | ❌ CHƯA CÓ | — (grep `redeem` = 0 kết quả logic) |
| Endpoint `POST /api/wallet/ticket-codes/redeem` | ❌ CHƯA CÓ | Không có `WalletController` / `TicketController` |
| DTO request/response | ❌ CHƯA CÓ | — |
| Test project | ❌ KHÔNG TỒN TẠI | Chỉ 3 csproj: API, Core, Infrastructure — 0 project test |

**Lưu ý lệch tên nhỏ giữa SRS và code (không chặn, chỉ ghi nhận):**
- SRS gọi PK là `RewardCodeId` + cột `Points`, `ValidFrom/ValidUntil`, có `TournamentId/RaceId`. Code thực tế: PK `TicketRewardCodeId`, cột `PointAmount`, chỉ có `ExpiresAt` (không có ValidFrom, không có Tournament/Race FK). → Code là bản **rút gọn** của SRS. Nếu implement, dùng schema thực tế (code) làm chuẩn; hoặc bổ sung cột nếu nhóm muốn gắn code theo giải/cuộc đua.

### 1.3 Vì sao DEFER (chưa implement)

1. **Rule 10 (task):** không implement nghiệp vụ Ticket Code Bonus khi nhóm chưa quyết định scope. Context task ghi rõ "chưa rõ là bắt buộc... hay có thể xin giảm scope".
2. **Không có test project:** yêu cầu "viết test cho success / code sai / hết hạn / đã dùng / redeem đồng thời / rollback" không thể thoả nếu không dựng mới hạ tầng test (xUnit project + EF InMemory/SQLite). Đây là quyết định scope riêng.
3. Luồng là **tuỳ chọn** (không chặn end-to-end prediction) → deprioritize hợp lý so với Module L/P đang thiếu hẳn endpoint.

### 1.4 Plan implement (sẵn sàng chạy khi nhóm duyệt)

Chi phí ước tính: ~0.5 ngày (infra đã có sẵn).

1. **DTO** `HRTMS.Core/DTOs/Wallet/RedeemTicketCodeDto.cs`: request `{ string Code }`; response `{ int PointsAdded, int NewBalance }`.
2. **Service** `IWalletService.RedeemTicketCodeAsync(int spectatorId, string rawCode)`:
   - Hash `rawCode` (SHA-256 → 32 byte, khớp `CodeHash VARBINARY(32)`).
   - `BeginTransaction` (Serializable) bao toàn bộ.
   - Load code theo `CodeHash`; validate: tồn tại, `Status=='Active'`, `ExpiresAt > now` → nếu không, trả lỗi rõ ("mã không tồn tại / đã dùng / hết hạn / vô hiệu").
   - **Chống double-redeem đồng thời:** `UPDATE TicketRewardCodes SET Status='Redeemed', RedeemedBySpectatorId=@s, RedeemedAt=@now WHERE TicketRewardCodeId=@id AND Status='Active'` — kiểm tra rows-affected == 1; nếu 0 → có request khác đã redeem, abort. (UNIQUE CodeHash + conditional update = idempotent-safe.)
   - Cộng `Wallet.Balance += PointAmount`; thêm 1 dòng VPT `Type='Ticket Code Bonus'`, `ReferenceType='TicketRewardCode'`, `ReferenceId=TicketRewardCodeId`, `Amount=PointAmount` (dương). Giữ bất biến `Balance = SUM(VPT)`.
   - Commit. Lỗi bất kỳ → rollback (không cộng điểm rời rạc).
3. **Controller** `WalletController` (`[Route("api/wallet")]`, `[Authorize(Roles="Spectator")]`): `POST ticket-codes/redeem`.
4. **DI** đăng ký `IWalletService` trong `Program.cs`.
5. **Test** (cần dựng test project trước): success, code sai, hết hạn, đã dùng, redeem đồng thời (2 task song song → đúng 1 thành công), rollback khi lỗi ledger.
6. **Không cần SQL patch** — bảng đã tồn tại trong schema gốc. (Nếu nhóm muốn thêm `TournamentId/RaceId/ValidFrom` theo SRS đầy đủ → tạo `database/patches/003_ticket_reward_code_scope.sql`, KHÔNG sửa `hrtms_schema.sql`.)

### 1.5 Nếu xin giảm scope

Đề xuất câu chữ cho nhóm: "Ticket Code Bonus (BR-63/PRD.5) là luồng tuỳ chọn của Spectator, không nằm trên đường end-to-end của giải đấu. Đề xuất **defer sang sau demo Phase 1**; hạ tầng DB/entity giữ nguyên, chỉ chưa mở endpoint redeem." → nếu duyệt, cập nhật mapping SRS đánh dấu PRD.5 (phần ticket) = Deferred.

---

## 2. Reward 200 điểm

### 2.1 Đối chiếu SRS → ĐÚNG

| Bằng chứng | Vị trí | Nội dung |
| --- | --- | --- |
| VPT catalog | `docs/SRS.md:320` | `Prediction Win Reward` (**+200 điểm**) |
| REQ-F-REC.2 | `docs/SRS.md:3333` | "tự động cộng **+200 điểm ảo** (`Prediction Win Reward`) vào ví Spectator dự đoán đúng Win" |
| Data model VPT | `docs/SRS.md:4205` | Type list gồm `Prediction Win Reward` |

**Áp dụng cho:** đúng 1 nghiệp vụ — cộng thưởng khi Spectator dự đoán `Win` đúng, trong transaction Declare Official (Module N/REC.2).

### 2.2 Vị trí hardcode → 1 nơi duy nhất, đã là named constant

- `backend/HRTMS.Infrastructure/Services/ResultService.cs:19` — `private const int PredictionWinRewardPoints = 200;`
- Dùng tại `:278` (`rewardPoints = PredictionWinRewardPoints`) → `:309, :311, :323`. **Single source of truth.**
- Grep `\b200\b` toàn backend: các hit còn lại là `[MaxLength(200)]` (DTO Tournament) và HTTP 200 (AuthController) — **không liên quan reward**. Không có hardcode trùng lặp.

### 2.3 Kết luận

- Giá trị 200 **đúng SRS**, đã centralize thành 1 constant, không có nguồn trùng gây lệch. **Không cần thay đổi code.**
- Comment tại `:19` ("fallback — thực tế đọc từ race.Round.Tournament.PredictionRewardPoints") hơi **cũ**: schema v2 đã bỏ cột `Tournament.PredictionRewardPoints` (xác nhận comment `:277`). Đây là cosmetic, không phải bug — có thể dọn câu chữ khi tiện, không bắt buộc trong phase này.
- **Không đổi thành config** trừ khi nhóm muốn Admin cấu hình reward theo giải (SRS hiện KHÔNG yêu cầu; REC.2 cố định +200). → giữ constant.

---

## 3. Tóm tắt hành động

| Hạng mục | Quyết định | Cần nhóm? |
| --- | --- | --- |
| Ticket Code Bonus | **Deferred** — infra sẵn sàng, plan sẵn (mục 1.4) | ✅ Chốt scope: implement now / defer |
| Reward 200 | **Đúng, giữ nguyên** — đã single-source | ❌ Không |

**Blocker duy nhất:** nhóm quyết định có implement Ticket Code Bonus trong phase này không. Trước khi có quyết định, KHÔNG viết redeem logic.
