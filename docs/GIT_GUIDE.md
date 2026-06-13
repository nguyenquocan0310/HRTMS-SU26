# Git Guide — HRTMS Team

**Dự án:** HRTMS-SU26 | **Branch chiến lược:** GitHub Flow  
**Repo:** https://github.com/annqse190275/HRTMS-SU26

---

## Nguyên tắc cốt lõi

| Nguyên tắc | Chi tiết |
|---|---|
| `main` luôn xanh | Không push code lỗi/build fail lên `main` |
| Mọi thứ qua PR | Không push thẳng lên `main`, dù là leader |
| PR nhỏ | 1 PR = 1 endpoint hoặc 1 component, tối đa ~300 dòng |
| Review trước merge | Ít nhất 1 người Approve trước khi merge |

---

## Đặt tên nhánh

```
feature/module-b-tournament-crud
feature/module-b-round-race
fix/tournament-prize-validation
chore/setup-jwt-middleware
docs/update-api-contract
```

| Prefix | Dùng khi |
|---|---|
| `feature/` | Làm tính năng mới |
| `fix/` | Sửa bug |
| `chore/` | Cài package, config, setup |
| `docs/` | Viết tài liệu |

---

## Flow làm việc hàng ngày

### Bước 1 — Bắt đầu task mới

```bash
# Luôn bắt đầu từ main mới nhất
git checkout main
git pull origin main

# Tạo nhánh mới
git checkout -b feature/module-b-tournament-crud
```

### Bước 2 — Code và commit

```bash
# Xem file nào đang thay đổi
git status

# Stage file cụ thể (khuyến nghị)
git add backend/HRTMS.API/Controllers/TournamentsController.cs
git add backend/HRTMS.Core/DTOs/Tournament/

# Hoặc stage tất cả
git add .

# Commit
git commit -m "feat(module-b): add CreateTournament endpoint"
```

### Bước 3 — Push lên GitHub

```bash
git push origin feature/module-b-tournament-crud
```

### Bước 4 — Tạo Pull Request

1. Vào GitHub → repo → **Compare & pull request**
2. Điền tiêu đề rõ ràng: `feat(module-b): Tournament CRUD`
3. Mô tả ngắn những gì đã làm
4. Assign 1 người review
5. Chờ Approve → **Squash and merge**

### Bước 5 — Dọn dẹp sau merge

```bash
# Quay về main và pull
git checkout main
git pull origin main

# Xóa nhánh cũ ở local
git branch -d feature/module-b-tournament-crud
```

---

## Commit message

**Cú pháp:** `<type>(<scope>): <mô tả ngắn>`

| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `chore` | Cài package, config |
| `refactor` | Refactor không thêm tính năng |
| `docs` | Cập nhật tài liệu |
| `test` | Thêm test |

**Ví dụ:**
```
feat(module-b): add CreateTournament endpoint
feat(module-b): add Round and Race creation
fix(module-b): validate prize distribution sum = 100%
chore: add BCrypt and JWT packages
refactor(module-b): extract ITournamentService interface
docs: update api-contract-tournament.md
```

**Commit khi nào:**

| ✅ Nên commit | ❌ Không commit |
|---|---|
| Xong 1 endpoint hoàn chỉnh | Code đang viết dở |
| Xong 1 component React | Build chưa xanh |
| Xong 1 entity / migration | Chỉ sửa comment |
| Fix xong 1 bug | Chưa test thủ công |

---

## Xử lý conflict

```bash
# Trước khi tạo PR — update nhánh với main mới nhất
git checkout feature/module-b-tournament-crud
git pull origin main

# Nếu có conflict → mở VS Code → tìm <<<<<<< → sửa thủ công

# Sau khi sửa xong
git add .
git commit -m "merge: resolve conflict with main"
git push origin feature/module-b-tournament-crud

# Tạo PR như bình thường
```

**Cách đọc conflict trong file:**
```
<<<<<<< HEAD          ← code của mình
your code here
=======
their code here
>>>>>>> origin/main   ← code từ main
```
Giữ lại phần đúng, xóa các dòng `<<<<<<<`, `=======`, `>>>>>>>`.

---

## Khôi phục commit

| Tình huống | Lệnh | Ghi chú |
|---|---|---|
| Xem code ở commit cũ | `git checkout <hash>` | Không thay đổi gì |
| Hoàn tác 1 commit (đã push) | `git revert <hash>` | An toàn, tạo commit mới |
| Xóa hẳn về commit cũ (chưa push) | `git reset --hard <hash>` | ⚠️ Mất code sau commit đó |

```bash
# Lấy hash từ log
git log --oneline

# Ví dụ output:
# 7789e72 feat(module-b): add CreateTournament endpoint
# b1e2ea1 chore: setup JWT middleware
# 8bffe33 feat: add EF Core setup
```

---

## Các lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `git status` | Xem file nào đang thay đổi |
| `git log --oneline` | Xem lịch sử commit ngắn gọn |
| `git branch` | Xem danh sách nhánh local |
| `git branch -a` | Xem tất cả nhánh kể cả remote |
| `git stash` | Cất tạm code chưa commit |
| `git stash pop` | Lấy lại code đã cất |
| `git diff` | Xem thay đổi chưa stage |
| `git diff --staged` | Xem thay đổi đã stage |

---

## File không được commit

Đã có trong `.gitignore`, **không** add thủ công các file sau:

```
backend/**/bin/
backend/**/obj/
backend/**/.vs/
backend/**/appsettings.Development.json   ← connection string thật của mỗi người
frontend/node_modules/
frontend/dist/
frontend/.env.local
```

> **appsettings.Development.json:** Mỗi người tự tạo trên máy mình sau khi clone, điền connection string SQL Server local của mình vào. File này không bao giờ push lên GitHub.

---

## Sơ đồ tóm tắt

```
main ──────────────────────────────────────────────► (luôn stable)
       │                              ▲
       │ git checkout -b feature/...  │ PR → Merge
       ▼                              │
feature/module-b-tournament-crud ─────┘
       │
       ├─ commit: "feat: add DTO"
       ├─ commit: "feat: add service"
       └─ commit: "feat: add controller"
```
