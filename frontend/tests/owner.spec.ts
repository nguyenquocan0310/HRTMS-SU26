import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// ─────────────────────────────────────────
// FILE 1: owner.types.ts
// Test: TypeScript compile không lỗi
// (kiểm tra bằng pnpm tsc riêng, không test UI)
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// FILE 2: HorseStatusBadge.tsx — 5 tests
// ─────────────────────────────────────────
test.describe('HorseStatusBadge Component', () => {
test.beforeEach(async ({ page }) => {
    // Set mock token để bypass auth
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        userID: 1,
        role: 'HorseOwner',
        fullName: 'Phan Quang Vinh'
      }));
    });
  });

  test('TC01 - badge Approved hiển thị màu xanh', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    const badge = page.locator('text=Approved').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-green-100/);
  });

  test('TC02 - badge Pending hiển thị màu vàng', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    const badge = page.locator('text=Pending').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-yellow-100/);
  });

  test('TC03 - badge Rejected hiển thị màu đỏ', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    const badge = page.locator('text=Rejected').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-red-100/);
  });

  test('TC04 - badge hiển thị đúng text', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=Approved').first()).toBeVisible();
    await expect(page.locator('text=Pending').first()).toBeVisible();
    await expect(page.locator('text=Rejected').first()).toBeVisible();
  });

  test('TC05 - badge có class pill shape', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    const badge = page.locator('text=Approved').first();
    await expect(badge).toHaveClass(/rounded-full/);
  });

});

// ─────────────────────────────────────────
// FILE 3: HorseCard.tsx — 5 tests
// ─────────────────────────────────────────
test.describe('HorseCard Component', () => {

  test('TC06 - hiển thị tên ngựa', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=Thunder Storm')).toBeVisible();
  });

  test('TC07 - hiển thị tuổi ngựa tính đúng', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    // Thunder Storm sinh 2019 → tuổi = 2026 - 2019 = 7
    await expect(page.locator('text=7')).toBeVisible();
  });

  test('TC08 - hiển thị gender ngựa', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=Stallion').first()).toBeVisible();
  });

  test('TC09 - nút Xem chi tiết có trên card', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    const btn = page.locator('text=Xem chi tiết').first();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('TC10 - click Xem chi tiết navigate đến trang detail', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await page.locator('text=Xem chi tiết').first().click();
    await expect(page).toHaveURL(/\/owner\/horses\/\d+/);
  });

});

// ─────────────────────────────────────────
// FILE 4: ownerService.ts — 5 tests
// Test: service gọi đúng endpoint
// ─────────────────────────────────────────
test.describe('ownerService API Calls', () => {

  test('TC11 - GET /api/horses/my được gọi khi vào trang', async ({ page }) => {
    // Intercept request
    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('/api/horses/my')) apiCalled = true;
    });
    await page.goto(`${BASE}/owner/horses`);
    await page.waitForTimeout(1000);
    expect(apiCalled).toBeTruthy();
  });

  test('TC12 - request có Authorization header', async ({ page }) => {
    // Set token trước
    await page.goto(`${BASE}`);
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token-123');
    });

    let hasAuthHeader = false;
    page.on('request', req => {
      if (req.url().includes('/api/horses')) {
        const auth = req.headers()['authorization'];
        if (auth && auth.startsWith('Bearer ')) hasAuthHeader = true;
      }
    });

    await page.goto(`${BASE}/owner/horses`);
    await page.waitForTimeout(1000);
    expect(hasAuthHeader).toBeTruthy();
  });

  test('TC13 - hiển thị loading khi đang fetch', async ({ page }) => {
    // Làm chậm response để thấy loading
    await page.route('**/api/horses/my', async route => {
      await new Promise(r => setTimeout(r, 500));
      await route.fulfill({ json: [] });
    });
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=Đang tải')).toBeVisible();
  });

  test('TC14 - hiển thị lỗi khi API fail', async ({ page }) => {
    // Mock API trả lỗi 500
    await page.route('**/api/horses/my', route =>
      route.fulfill({ status: 500, body: 'Server Error' })
    );
    await page.goto(`${BASE}/owner/horses`);
    await page.waitForTimeout(500);
    // Phải có error message
    await expect(
      page.locator('[class*="red"], [class*="error"], text=lỗi').first()
    ).toBeVisible();
  });

  test('TC15 - mock API trả data đúng render ra card', async ({ page }) => {
    await page.route('**/api/horses/my', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          horseID: '99', // SỬA THÀNH STRING ĐỂ KHỚP INTERFACE
          ownerID: '1',
          name: 'API Horse Test',
          breedCode: 'THO',
          birthYear: 2020,
          gender: 'Colt',
          color: 'Gray',
          dopingTestResult: 'Clean',
          status: 'Approved',
          createdAt: '2026-01-01'
        }])
      })
    );
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=API Horse Test')).toBeVisible();
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=API Horse Test')).toBeVisible();
  });

});

// ─────────────────────────────────────────
// FILE 5: MyHorses.tsx — 5 tests
// ─────────────────────────────────────────
test.describe('MyHorses Page', () => {

  test('TC16 - render được trang không crash', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await expect(page).toHaveURL(`${BASE}/owner/horses`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC17 - có tiêu đề Ngựa của tôi', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await expect(page.locator('text=Ngựa của tôi')).toBeVisible();
  });

  test('TC18 - có nút Đăng ký ngựa mới', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    const btn = page.locator('text=Đăng ký ngựa mới');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('TC19 - nút Đăng ký navigate đến /owner/horses/register', async ({ page }) => {
    await page.goto(`${BASE}/owner/horses`);
    await page.locator('text=Đăng ký ngựa mới').click();
    await expect(page).toHaveURL(`${BASE}/owner/horses/register`);
  });

  test('TC20 - empty state khi API trả về mảng rỗng', async ({ page }) => {
    await page.route('**/api/horses/my', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto(`${BASE}/owner/horses`);
    await expect(
      page.locator('text=Bạn chưa có ngựa nào')
    ).toBeVisible();
  });

});