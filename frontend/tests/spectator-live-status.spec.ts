import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

test('uses the spectator color scheme for race statuses', async ({ page }) => {
  let raceStatus = 'Live'

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname

    if (path === '/api/races/10/live-status') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            raceId: 10,
            status: raceStatus,
            scheduledTime: '2026-07-22T08:00:00Z',
            actualStartTime: '2026-07-22T08:01:00Z',
            raceDurationSeconds: 120,
            entries: [],
          },
        },
      })
      return
    }

    if (path === '/api/tournament') {
      await route.fulfill({
        json: {
          success: true,
          data: [{
            tournamentId: 1,
            name: 'Giải mùa hè',
            venueName: 'Trường đua Phú Thọ',
            venueCity: 'TP. Hồ Chí Minh',
            rounds: [{
              roundId: 1,
              name: 'Vòng loại',
              races: [{
                raceId: 10,
                raceNumber: 1,
                scheduledTime: '2026-07-22T08:00:00Z',
                status: raceStatus,
              }],
            }],
          }],
        },
      })
      return
    }

    await route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto(`${BASE_URL}/spectator/live-race?raceId=10`)
  await expect(page.getByText(/Ngày giờ dự kiến:/)).toBeVisible()
  await expect(page.getByText(/Bắt đầu thực tế:/)).toBeVisible()
  await expect(page.getByText('Địa điểm: Trường đua Phú Thọ · TP. Hồ Chí Minh')).toBeVisible()

  const cases = [
    { status: 'Live', label: 'Đang phát trực tiếp', background: /bg-emerald-100/, text: /text-emerald-700/ },
    { status: 'Unofficial', label: 'Kết quả sơ bộ', background: /bg-amber-100/, text: /text-amber-700/ },
    { status: 'Official', label: 'Kết quả chính thức', background: /bg-blue-100/, text: /text-blue-700/ },
    { status: 'Completed', label: 'Đã hoàn tất', background: /bg-slate-100/, text: /text-slate-700/ },
  ]

  for (const item of cases) {
    raceStatus = item.status
    if (item.status !== 'Live') await page.reload()

    await expect(page.getByRole('heading', { name: item.label, exact: true })).toBeVisible()
    const badge = page.locator(`[data-race-status="${item.status.toLowerCase()}"]`)
    await expect(badge).toHaveClass(item.background)
    await expect(badge).toHaveClass(item.text)
  }

  raceStatus = 'Live'
  await page.reload()
  await expect(page.locator('[data-race-status="live"] .animate-pulse')).toBeVisible()

  raceStatus = 'Official'
  await page.reload()
  await expect(page.locator('[data-race-status="official"]')).toContainText('✓')
})
