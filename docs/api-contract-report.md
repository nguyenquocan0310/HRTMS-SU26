# API Contract — Module P (Báo cáo & Xuất dữ liệu — REQ-F-RPT)

Controller: `ReportController` · Base: `/api/reports`
Auth: JWT Bearer — mọi endpoint yêu cầu đăng nhập. `userId` lấy từ claim `NameIdentifier`, `role` lấy từ claim `Role`.

> **Phạm vi phase này:**
> - ✅ RPT.1 — Export CSV (UTF-8 BOM) cho 4 loại báo cáo.
> - ✅ RPT.3 — RBAC filter áp dụng **trong `ReportService`**, chạy tại database trước khi build CSV.
> - ✅ Audit log action `Export_Report` cho cả export thành công và bị từ chối quyền.
> - ❌ **PDF server-side KHÔNG nằm trong phase này.** Không thêm QuestPDF hay dependency PDF nào.
>   RPT.2 được đáp ứng bằng hướng "in trực tiếp từ trình duyệt": backend trả JSON qua
>   `GET /api/reports/{type}`, **Frontend (Thiện)** render print-view và gọi `window.print()`.
>
> Module P không có bảng riêng — mọi báo cáo là query read-only trên schema hiện có (SRS 3.4, note Module P).

---

## 1. Export CSV — RPT.1

`GET /api/reports/{type}/export?format=csv&tournamentId={id}` · Role: **Admin, Owner, Jockey, Spectator** · Màn hình: UI-S18

| Tham số | Vị trí | Bắt buộc | Ghi chú |
| --- | --- | :---: | --- |
| `type` | route | ✔ | Một trong 4 slug ở mục 2. Slug khác → `400`. Client **không** truyền tên bảng/property. |
| `tournamentId` | query | ✔ | `> 0`. Không tồn tại → `404`. |
| `format` | query | — | Chỉ nhận `csv` (không phân biệt hoa/thường). Bỏ trống → mặc định `csv`. Giá trị khác → `400`. |

`200 OK` → `FileContentResult`

```
Content-Type: text/csv
Content-Disposition: attachment; filename={type}_tournament-{id}_{yyyyMMddHHmmss}.csv
```

Thân phản hồi:
- 3 byte đầu là **UTF-8 BOM** (`EF BB BF`) → Excel đọc đúng tiếng Việt.
- Dòng đầu là header; thứ tự cột **cố định** và **giống nhau cho mọi role** (RBAC lọc **dòng**, không lọc cột).
- Kết thúc dòng bằng `\r\n`.
- Escape theo RFC 4180: field chứa `,` `"` `\n` hoặc `\r` được bọc trong `"`; dấu `"` bên trong nhân đôi thành `""`.
- Giá trị `null` → field rỗng.
- Không có dữ liệu trong phạm vi quyền → **`200` với CSV chỉ có dòng header** (không phải `404`).

Ví dụ (`entry-list`):
```csv
TournamentId,TournamentName,RoundName,RaceNumber,HorseId,HorseName,OwnerName,JockeyName,PairingId,PairingStatus,EntryStatus,EntryFeeStatus,IsWithdrawn,EnrollmentApprovalStatus
1,"Giải Mùa Hè, 2026",Vòng loại,1,37,Ngân Tinh 01,Phạm Gia Hương,Bùi Ngọc Dũng,1,Confirmed,Confirmed,Paid,false,Approved
```

---

## 2. Bốn loại báo cáo

| `type` | Nội dung | Nguồn dữ liệu |
| --- | --- | --- |
| `tournament-results` | Kết quả giải — **chỉ race `Official`** | `RaceEntries` → `Races` (Status = `Official`) → `Rounds` → `Tournaments` |
| `race-results` | Kết quả race, mọi trạng thái race | `RaceEntries` → `Races` → `Rounds` |
| `purse-payouts` | Payout đã ghi nhận (đọc, **không tính lại**) | `PursePayouts` (do Module K sinh trong transaction Declare Official) |
| `entry-list` | Danh sách entry; gốc là `Pairings` nên pairing **chưa allocate** vẫn xuất hiện với `RoundName`/`RaceNumber` rỗng | `Pairings` ⟕ `RaceEntries`, `HorseTournamentEntries.AdminApprovalStatus` |

Thứ tự cột:

| `type` | Header |
| --- | --- |
| `tournament-results` | `TournamentId, TournamentName, RoundSequence, RoundName, RaceId, RaceNumber, RaceStatus, HorseId, HorseName, JockeyName, FinishPosition, FinishTime, AdvancementStatus, PointsAwarded, EarningsAwarded` |
| `race-results` | `TournamentId, TournamentName, RoundName, RaceId, RaceNumber, RaceStatus, ScheduledTime, RaceEntryId, PairingId, PostPosition, HorseId, HorseName, JockeyName, EntryStatus, IsWithdrawn, FinishPosition, FinishTime, PointsAwarded, EarningsAwarded` |
| `purse-payouts` | `TournamentId, TournamentName, RoundName, RaceId, RaceNumber, PursePayoutId, RaceEntryId, HorseId, HorseName, RecipientUserId, RecipientName, RecipientRole, FinishPosition, CalculatedAmount, PayoutStatus, PaidAt` |
| `entry-list` | `TournamentId, TournamentName, RoundName, RaceNumber, HorseId, HorseName, OwnerName, JockeyName, PairingId, PairingStatus, EntryStatus, EntryFeeStatus, IsWithdrawn, EnrollmentApprovalStatus` |

Không report nào chứa thông tin liên hệ (email/phone), dữ liệu ví/ledger hay audit nội bộ.

---

## 3. RBAC — RPT.3

Filter nằm trong `ReportService`, **không** chỉ dựa vào `[Authorize]` ở controller.
`userId` và `role` **luôn** đọc từ claims; query param `userId`/`role` bị bỏ qua hoàn toàn.

| Role | `tournament-results` / `race-results` | `purse-payouts` | `entry-list` |
| --- | --- | --- | --- |
| **Admin** | Toàn bộ theo `tournamentId` | Toàn bộ | Toàn bộ |
| **Owner** | `Pairing.Horse.OwnerId = userId` | `PursePayout.RaceEntry.Pairing.Horse.OwnerId = userId` | `Pairing.Horse.OwnerId = userId` |
| **Jockey** | `Pairing.JockeyId = userId` | `PursePayout.RaceEntry.Pairing.JockeyId = userId` | `Pairing.JockeyId = userId` |
| **Spectator** | `Race.Status = 'Official'` **và** `RaceEntry.IsWithdrawn = 0` **và** `RaceEntry.Status <> 'Cancelled'` | **`403`** | Như cột trái; pairing chưa allocate **không** public |

Ánh xạ quyền dựa trên schema hiện có:
- Owner sở hữu ngựa: `Horses.OwnerId` → `OwnerProfiles.OwnerId` = `Users.UserId` (FK = PK).
- Jockey tham gia race: `Pairings.JockeyId` → `JockeyProfiles.JockeyId` = `Users.UserId`.
- Race chính thức: `Races.Status = 'Official'` (`CHK_Races_Status`).

**Quyết định thu hẹp quyền (ghi rõ để nhóm xác nhận):**
1. **Spectator không được xem `purse-payouts`** → `403`. Payout là số tiền chi trả cho cá nhân; SRS ma trận UI-S18
   cho Spectator quyền `R` trên *màn hình*, nhưng không định nghĩa phạm vi dữ liệu payout public.
2. **Referee và Doctor bị từ chối (`403`)** dù ma trận UI-S18 cho `R`. Phạm vi dữ liệu của hai role này chưa được
   định nghĩa trong SRS/Module P. Không tự nới quyền — cần nhóm chốt trước khi mở.
3. `Role` claim là **đơn trị** (`JwtService` phát đúng một `ClaimTypes.Role`). Không có policy multi-role.
4. Owner xem `purse-payouts` thấy **cả dòng payout của Jockey trên entry của ngựa mình** — bám sát SRS/task
   ("payout liên quan đến ngựa do mình sở hữu"), không lộ dữ liệu Owner khác.

---

## 4. Dữ liệu cho preview & print-view — RPT.2

`GET /api/reports/{type}?tournamentId={id}` · Role: như mục 3

Trả JSON để FE dựng vùng xem trước (UI-S18) và print-view rồi gọi `window.print()`.
Áp dụng **cùng** validate + RBAC filter như endpoint export. **Không** ghi audit log (chỉ export mới ghi).

`200 OK`:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "type": "entry-list",
    "tournamentId": 1,
    "tournamentName": "GIẢI ĐUA NGỰA MÙA HÈ 2026",
    "headers": ["TournamentId", "TournamentName", "..."],
    "rows": [["1", "GIẢI ĐUA NGỰA MÙA HÈ 2026", null, null, "37", "..."]]
  }
}
```

> Backend **không** render PDF. Nếu nhóm bắt buộc PDF server-side, phải chốt trước: lý do bắt buộc, khổ giấy,
> font tiếng Việt, chi phí dependency — rồi mới thêm QuestPDF ở phase sau.

---

## 5. Audit log — `Export_Report`

Mỗi lần gọi endpoint export (mục 1) ghi một dòng `AuditLogs` qua `IAuditLogService.LogAsync`:

| Cột | Giá trị |
| --- | --- |
| `ActorId` | `userId` từ claim |
| `Action` | `Export_Report` |
| `EntityName` | `Report` |
| `EntityId` | `tournamentId` |
| `NewValue` | `{"type":"EntryList","format":"csv","tournamentId":1,"role":"Owner","result":"success","rowCount":1}` |
| `IpAddress` / `UserAgent` | từ `HttpContext` |
| `CreatedAt` | UTC, mặc định DB |

`result` ∈ `success` \| `denied`. Bản ghi `denied` được ghi khi role bị từ chối (mục 3), **trước** khi kiểm tra
tournament có tồn tại hay không. **Không** ghi nội dung CSV hay dữ liệu nhạy cảm vào log.

Request `401` (thiếu/hỏng token) không ghi audit — không có `ActorId` hợp lệ (`FK_AuditLogs_Actor`).
Lỗi validate `type`/`format`/`tournamentId` (`400`) cũng không ghi audit.

---

## 6. Mã lỗi

| Tình huống | Status | Body |
| --- | :---: | --- |
| `type` không thuộc 4 slug | `400` | `ApiResponse.Fail("Loại báo cáo không hợp lệ. …")` |
| `format` ≠ `csv` | `400` | `ApiResponse.Fail("Định dạng xuất không được hỗ trợ. Hiện chỉ hỗ trợ format=csv.")` |
| `tournamentId ≤ 0` | `400` | `ApiResponse.Fail("tournamentId không hợp lệ.")` |
| Không có token / token hỏng | `401` | — (`[Authorize]`) |
| Role không hợp lệ, hoặc Spectator xin `purse-payouts` | `403` | `ApiResponse.Fail(...)` |
| Tournament không tồn tại | `404` | `ApiResponse.Fail("Không tìm thấy giải đấu.")` |
| Không có dữ liệu trong phạm vi quyền | `200` | CSV chỉ có header |
| Lỗi hệ thống / query | `500` | `ExceptionMiddleware` → thông báo chung, không lộ stack trace/SQL |
