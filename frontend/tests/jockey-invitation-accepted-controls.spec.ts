import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

test('disables accept and decline after jockey accepts an invitation', async ({ page }) => {
  let invitationLoads = 0
  let acceptRequests = 0

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === '/api/jockeys/invitations') {
      invitationLoads += 1
      await route.fulfill({ json: { items: [{ pairingId: 12, horse: { horseId: 6, name: 'Tiếng Việt', breed: 'Thoroughbred' }, owner: { ownerId: 8, fullName: 'Nguyễn Quốc An' }, requestMessage: 'mời bạn', status: 'Pending', createdAt: '2026-07-20T15:08:30Z', respondedAt: null }], totalCount: 1, page: 1, pageSize: 100, totalPages: 1 } })
      return
    }
    if (url.pathname === '/api/pairings/12/accept' && request.method() === 'PATCH') {
      acceptRequests += 1
      await route.fulfill({ json: { success: true, message: 'Accepted', data: { pairingId: 12, status: 'Accepted' } } })
      return
    }

    await route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto(`${BASE_URL}/jockey/invitations`)

  const acceptButton = page.getByRole('button', { name: 'Chấp nhận', exact: true })
  const declineButton = page.getByRole('button', { name: 'Từ chối', exact: true })
  await acceptButton.click()

  await expect(page.getByText('Đã chấp nhận', { exact: true })).toBeVisible()
  await expect(acceptButton).toBeDisabled()
  await expect(declineButton).toBeDisabled()
  expect(acceptRequests).toBe(1)
  expect(invitationLoads).toBe(1)
})
