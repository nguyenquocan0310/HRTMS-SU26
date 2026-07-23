import { expect, test } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

test('Admin verifies a submitted fee proof and completes the pairing', async ({ page }) => {
  let status = 'PendingVerification'
  let verifyRequests = 0

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'POST' && pathname.endsWith('/admin/fee-payments/81/verify')) {
      verifyRequests += 1
      status = 'Verified'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paymentId: 81, status: 'Verified', pairingStatus: 'Confirmed' }),
      })
      return
    }

    if (pathname.endsWith('/admin/fee-payments')) {
      const items = status === 'PendingVerification' ? [{
        paymentId: 81, pairingId: 41, tournamentId: 7, tournamentName: 'Giải Test',
        horseId: 11, horseName: 'Hoài Phong', jockeyId: 21, jockeyName: 'Nguyễn Quốc An',
        ownerId: 31, ownerName: 'Owner Test', amount: 500000, method: 'Transfer',
        receiptNo: null, transferRef: 'BANK-TEST-001', proofFileName: 'proof.png', hasProof: true,
        status, submittedAt: '2026-07-21T08:00:00Z', verifiedBy: null, verifiedAt: null,
        rejectReason: null, pairingStatus: 'PendingVerification',
      }] : []
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, totalCount: items.length, page: 1, pageSize: 100, totalPages: 1 }) })
      return
    }

    const body = pathname.endsWith('/auth/profile')
      ? { success: true, message: '', data: { fullName: 'Admin Test', email: 'admin@test.local' } }
      : { success: true, message: '', data: { count: 0 } }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto(`${BASE_URL}/admin/entry-fees`)
  await expect(page.getByRole('heading', { name: 'Lệ phí ghép cặp' })).toBeVisible()
  await expect(page.getByText('BANK-TEST-001')).toBeVisible()
  page.on('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Xác nhận đúng' }).click()
  await expect(page.getByRole('status')).toContainText('ghép thành công')
  expect(verifyRequests).toBe(1)
})
