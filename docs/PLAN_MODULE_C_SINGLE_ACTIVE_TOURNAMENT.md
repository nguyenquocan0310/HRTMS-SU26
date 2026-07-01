# Plan — Module C: 1 con ngựa chỉ tham gia 1 giải CHƯA kết thúc tại một thời điểm

> **Quyết định (user):** Một con ngựa chỉ được tham gia **tối đa 1 giải đang hoạt động**. Muốn
> đẩy vào giải mới thì giải cũ phải `Completed`/`Cancelled`. Reuse ngựa qua nhiều giải vẫn được
> — chỉ chặn **chồng chéo giữa các giải chưa kết thúc**.

---

## Phase 0 — Findings (đã verify, không cần làm lại)

- **Không phải bug:** ngựa enroll 2 giải khác nhau là **tính năng kho ngựa** ([[module-c-horse-stable-v3]]).
- **Đã chặn sẵn:** cùng ngựa vào **cùng 1 giải** 2 lần → app check `already`
  ([HorseService.cs:122-125](../backend/HRTMS.Infrastructure/Services/HorseService.cs#L122)) + DB
  `UQ_HTE_HorseTournament UNIQUE (HorseId, TournamentId)` ([patch:83](../database/patches/001_horse_stable_decoupling.sql#L83)).
- **Lỗ hổng thật:** KHÔNG có check chặn ngựa tham gia 2 giải **chưa kết thúc** cùng lúc
  (grep `overlap/StartDate/EndDate` trong HorseService = none).
- **Giá trị `Tournament.Status`** (DB CHECK `CHK_Tournaments_Status`): `Draft` · `Open Registration`
  · `Closed Registration` · `Completed` · `Cancelled`.
  - **Đang hoạt động** = `Open Registration` + `Closed Registration`.
  - **Đã xong** = `Completed` + `Cancelled`.
- **Nơi tạo enrollment duy nhất:** `EnrollHorseAsync` → chỉ cần guard ở 1 chỗ.
- **Chưa có withdraw:** giá trị enrollment `Status='Withdrawn'` tồn tại nhưng không endpoint nào set
  → rule "đợi giải cũ xong" khả thi; (withdraw là follow-up tùy chọn, xem cuối).

**Allowed APIs (đã verify tồn tại):**
- `_context.HorseTournamentEntries` (DbSet) — query enrollment.
- `HorseTournamentEntry.Status` ('Enrolled'/'Withdrawn'), `.AdminApprovalStatus` ('Pending'/'Approved'/'Rejected'), nav `.Tournament`.
- `Tournament.Status`.
- `ApiResponse<HorseEnrollmentResponseDto>.Fail(string)`.

**Anti-pattern guards:**
- ❌ Đừng cố enforce ở DB-level (rule xuyên bảng Tournaments theo Status — filtered index/unique không làm được; chỉ trigger mới được, KHÔNG dùng). Enforce ở **app-layer**.
- ❌ Đừng tính enrollment `Withdrawn` hoặc `Rejected` là "đang tham gia".
- ❌ Đừng đụng `RaceEntryService`/Module E, FE, hay schema.

---

## Phase 1 — Thêm guard "single active tournament" vào EnrollHorseAsync

**What to implement** ([HorseService.cs](../backend/HRTMS.Infrastructure/Services/HorseService.cs)):

Chèn **ngay sau** block check `already` (sau dòng 125, trước `var entry = new HorseTournamentEntry`):

```csharp
        // Mỗi con ngựa chỉ tham gia 1 giải CHƯA kết thúc tại một thời điểm.
        // Giải 'Open Registration'/'Closed Registration' = đang diễn ra; 'Completed'/'Cancelled' = đã xong.
        // Enrollment đã 'Withdrawn' hoặc bị 'Rejected' không tính là đang tham gia.
        var activeElsewhere = await _context.HorseTournamentEntries
            .Include(e => e.Tournament)
            .AnyAsync(e =>
                e.HorseId == horseId &&
                e.Status == "Enrolled" &&
                e.AdminApprovalStatus != "Rejected" &&
                (e.Tournament.Status == "Open Registration" ||
                 e.Tournament.Status == "Closed Registration"));
        if (activeElsewhere)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail(
                "Con ngựa này đang tham gia một giải chưa kết thúc. Hãy đợi giải đó hoàn tất (Completed/Cancelled) trước khi đẩy vào giải mới.");
```

**Vì sao đúng & không false-positive:**
- Check `already` (đã có) chạy TRƯỚC → mọi enrollment trong CHÍNH giải đang enroll đã bị loại; nên `activeElsewhere` chỉ bắt **giải khác**.
- Giải đang enroll luôn là `Open Registration` (đã validate ở trên) → rule nhất quán.

**Documentation references:** mẫu query enrollment có sẵn tại
[HorseService.cs:122-125](../backend/HRTMS.Infrastructure/Services/HorseService.cs#L122) (cùng pattern `AnyAsync`).

**Verification checklist:**
- [ ] `dotnet build backend/HRTMS.slnx` → 0 errors.
- [ ] `grep -n "activeElsewhere" backend/HRTMS.Infrastructure/Services/HorseService.cs` → xuất hiện 1 lần trong `EnrollHorseAsync`.
- [ ] Logic test (thủ công hoặc unit):
  - Enroll ngựa X vào giải T1 (`Open Registration`) → **OK**.
  - Enroll ngựa X vào giải T2 (`Open Registration`) → **bị chặn** (message trên).
  - Set T1 → `Completed`, enroll X vào T2 → **OK**.
  - Ngựa X bị `Rejected` ở T1, enroll vào T2 → **OK** (rejected không chặn).

**Anti-pattern guards:** chỉ sửa đúng `EnrollHorseAsync`; không thêm cột/constraint DB; không sửa file module khác.

---

## Phase 2 — (Tùy chọn) Endpoint Withdraw để gỡ ngõ cụt

> Chỉ làm nếu user muốn cho owner **rút ngựa** khỏi giải đang mở (đổi ý) thay vì phải đợi giải xong.

**What to implement:**
- `IHorseService` + `HorseService`: `WithdrawEnrollmentAsync(int ownerId, int enrollmentId)` → set
  `entry.Status = "Withdrawn"` (verify enrollment thuộc owner; chỉ cho rút khi giải còn
  `Open Registration`; hủy các Pairing liên quan của giải đó như EC-23).
- `HorseController`: `PATCH /api/horses/enrollments/{enrollmentId}/withdraw` (Owner).
- Sau khi withdraw, guard Phase 1 tự bỏ qua (vì `Status != 'Enrolled'`) → owner enroll giải khác được.

**Verification:** enroll T1 → withdraw → enroll T2 thành công.

---

## Phase 3 — Verification tổng

1. `dotnet build backend/HRTMS.slnx` xanh.
2. Chạy lại 4 case ở Phase 1.
3. Xác nhận không đụng FE / Module E / schema (chỉ `HorseService.cs` [+ controller nếu làm Phase 2]).

## Commit (theo [[commit-no-coauthor]])
- Phase 1: `fix(module-c): chặn ngựa enroll vào 2 giải chưa kết thúc cùng lúc`
- Phase 2 (nếu làm): `feat(module-c): thêm withdraw enrollment cho owner`
- Commit chỉ mình An, không Co-Authored-By.
