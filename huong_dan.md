# Hướng dẫn dán đè

Cấu trúc thư mục trong file zip này GIỐNG HỆT đường dẫn trong repo
`HRTMS-SU26` gốc. Chỉ cần giải nén rồi copy đè (overwrite) từng thư mục
`backend` và `database` vào đúng vị trí tương ứng trong project của bạn.

## Danh sách file

### File SỬA (đè trực tiếp lên file cũ)
- backend/HRTMS.API/Controllers/MedicalCheckController.cs
- backend/HRTMS.Core/DTOs/Medical/MedicalCheckListDto.cs
- backend/HRTMS.Core/DTOs/Medical/RaceEntryHealthProfileDto.cs
- backend/HRTMS.Core/DTOs/Result/ResultDtos.cs
- backend/HRTMS.Core/Entities/DoctorProfile.cs
- backend/HRTMS.Core/Entities/RaceEntry.cs
- backend/HRTMS.Core/Interfaces/Services/IMedicalCheckService.cs
- backend/HRTMS.Infrastructure/Data/HRTMSDbContext.cs
- backend/HRTMS.Infrastructure/Services/MedicalCheckService.cs
- backend/HRTMS.Infrastructure/Services/ResultService.cs

### File MỚI (thêm vào, chưa từng tồn tại)
- backend/HRTMS.Core/DTOs/Medical/PostRaceClinicalCheckResultDto.cs
- backend/HRTMS.Core/DTOs/Medical/RecordPostRaceClinicalCheckDto.cs
- database/patches/015_post_race_clinical_check.sql

## Sau khi dán đè

1. Chạy patch DB: `database/patches/015_post_race_clinical_check.sql`
   trên SQL Server (thêm cột PostRaceClinicalStatus... vào bảng RaceEntries).
2. Nếu project dùng EF Core Migrations (thay vì raw SQL patch) thì tạo thêm
   1 migration tương ứng để đồng bộ Model Snapshot — patch này chỉ là raw SQL.
3. `dotnet build` lại để chắc chắn không lỗi biên dịch.
4. Endpoint mới cho Doctor:
   `PATCH /api/doctor/race-entries/{raceEntryId}/post-race-clinical-check`
   Body: `{ "postRaceClinicalStatus": "Fit" | "Unfit", "unfitReason": "..." }`
   Chỉ gọi được khi Race đang ở trạng thái `Unofficial` (đã có kết quả sơ bộ).
5. Admin xem danh sách Unofficial races (`GET .../unofficial`) giờ có thêm
   field `postRaceClinicalCheckComplete` — và `Declare Official` sẽ bị chặn
   nếu còn cặp đấu chưa được khám lại sau trận.
