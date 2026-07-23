import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const PAGE_URL = `${BASE_URL}/owner/jockey-invite`;

async function openInvitePage(page: Page) {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body = '[]';
    if (pathname.endsWith('/notifications/count')) {
      body = JSON.stringify({ success: true, message: '', data: { count: 0 } });
    } else if (pathname.endsWith('/my/tournament-participations')) {
      body = JSON.stringify({ success: true, message: '', data: [] });
    } else if (pathname.endsWith('/auth/profile')) {
      body = JSON.stringify({ success: true, message: '', data: {} });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.goto(PAGE_URL);
  await expect(page.getByRole('heading', { name: 'Mời Jockey', exact: true })).toBeVisible();
}

async function openInviteModal(page: Page) {
  await page.getByRole('button', { name: /Gửi lời mời mới/ }).click();
  return page.getByRole('dialog', { name: 'Gửi lời mời cho jockey' });
}

test.describe('Owner jockey invitation modal', () => {
  test.beforeEach(async ({ page }) => {
    await openInvitePage(page);
  });

  test('opens once over the current page with a translucent backdrop', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.getByRole('button', { name: /Gửi lời mời mới/ }).click();

    await expect(page).toHaveURL(PAGE_URL);
    await expect(page.getByRole('heading', { name: 'Mời Jockey', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Gửi lời mời cho jockey' })).toHaveCount(1);

    const backdrop = page.getByRole('button', { name: 'Đóng modal gửi lời mời' });
    await expect(backdrop).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.4)');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('closes with Escape, close button, cancel button, and backdrop', async ({ page }) => {
    let dialog = await openInviteModal(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    dialog = await openInviteModal(page);
    await page.getByRole('button', { name: 'Đóng modal', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openInviteModal(page);
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openInviteModal(page);
    await page.getByRole('button', { name: 'Đóng modal gửi lời mời' }).click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(PAGE_URL);
  });

  test('stays centered and within a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openInviteModal(page);
    const box = await dialog.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});

test('Accepted pairing opens fee payment and waits for Admin verification', async ({ page }) => {
  let pairingStatus: 'Accepted' | 'PendingVerification' = 'Accepted';
  let paymentRequests = 0;
  let createRequests = 0;
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/pairings')) {
      createRequests += 1;
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      return;
    }
    if (request.method() === 'POST' && pathname.endsWith('/pairings/41/fee-payment')) {
      paymentRequests += 1;
      pairingStatus = 'PendingVerification';
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ paymentId: 81, pairingId: 41, status: 'PendingVerification', pairingStatus }),
      });
      return;
    }

    let body: unknown = [];
    if (pathname.endsWith('/auth/profile')) {
      body = { success: true, message: '', data: { fullName: 'Owner Test', email: 'owner@test.local' } };
    } else if (pathname.endsWith('/notifications/count')) {
      body = { success: true, message: '', data: { count: 0 } };
    } else if (pathname.endsWith('/my/tournament-participations')) {
      body = { success: true, message: '', data: [{ tournamentId: 7, tournamentName: 'Giải Test', status: 'Approved' }] };
    } else if (pathname.endsWith('/tournament/7')) {
      body = { success: true, message: '', data: {
        tournamentId: 7, name: 'Giải Test', entryFeeAmount: 500000,
        paymentDeadline: '2026-08-05T14:13:00Z', refundDeadline: '2026-08-12T14:13:00Z',
        rounds: [], prizeDistributions: [],
      } };
    } else if (pathname.endsWith('/horses/my')) {
      body = [{ horseID: '11', name: 'Hoài Phong' }];
    } else if (pathname.endsWith('/horses/my/enrollments')) {
      body = [{ horseId: 11, status: 'Enrolled', adminApprovalStatus: 'Approved' }];
    } else if (pathname.endsWith('/jockeys/available')) {
      body = { items: [{ jockeyId: 21, fullName: 'Nguyễn Quốc An', licenseCertificate: 'LIC-21', experienceYears: 6, healthStatus: 'Good' }] };
    } else if (pathname.endsWith('/owner/pairings')) {
      body = {
        items: [{
          pairingId: 41,
          tournamentId: 7,
          horse: { horseId: 11, name: 'Hoài Phong' },
          jockey: { jockeyId: 21, fullName: 'Nguyễn Quốc An' },
          requestMessage: 'Hãy cưỡi HP',
          status: pairingStatus,
          createdAt: '2026-07-21T08:00:00Z',
        }],
      };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(PAGE_URL);
  const paymentButton = page.getByRole('button', { name: 'Nộp lệ phí', exact: true });
  await expect(paymentButton).toBeVisible();
  await paymentButton.click();

  const dialog = page.getByRole('dialog', { name: 'Nộp lệ phí tham gia' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Mã giao dịch *').fill('BANK-TEST-001');
  await dialog.getByLabel('Ảnh/file chứng từ *').setInputFiles({
    name: 'proof.png', mimeType: 'image/png', buffer: Buffer.from('proof'),
  });
  await dialog.getByRole('button', { name: 'Nộp lệ phí', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Chờ đối chứng', exact: true })).toBeVisible();
  expect(paymentRequests).toBe(1);
  expect(createRequests).toBe(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Chờ đối chứng', exact: true })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
