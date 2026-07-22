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

    await route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto(`${BASE_URL}/spectator/live-race?raceId=10`)

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
