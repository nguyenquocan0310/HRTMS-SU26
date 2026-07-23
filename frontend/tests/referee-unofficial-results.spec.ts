import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

const entries = [
  { raceEntryId: 101, postPosition: 1, status: 'Confirmed', isWithdrawn: false, horseId: 1, horseName: 'Kim Long', jockeyId: 11, jockeyName: 'Nguyễn Minh Cường', finishPosition: null, finishTime: null },
  { raceEntryId: 102, postPosition: 2, status: 'Confirmed', isWithdrawn: false, horseId: 2, horseName: 'Phong Vũ', jockeyId: 12, jockeyName: 'Võ Thành Bách', finishPosition: null, finishTime: null },
  { raceEntryId: 103, postPosition: 3, status: 'Confirmed', isWithdrawn: false, horseId: 3, horseName: 'Ánh Dương', jockeyId: 13, jockeyName: 'Lê Trọng Giang', finishPosition: null, finishTime: null },
  { raceEntryId: 104, postPosition: 4, status: 'Cancelled', isWithdrawn: false, horseId: 4, horseName: 'Đã hủy', jockeyId: 14, jockeyName: 'Nài A', finishPosition: null, finishTime: null },
  { raceEntryId: 105, postPosition: 5, status: 'Withdrawn', isWithdrawn: true, horseId: 5, horseName: 'Đã rút', jockeyId: 15, jockeyName: 'Nài B', finishPosition: null, finishTime: null },
  { raceEntryId: 106, postPosition: 6, status: 'Disqualified', isWithdrawn: false, horseId: 6, horseName: 'Đã loại', jockeyId: 16, jockeyName: 'Nài C', finishPosition: null, finishTime: null },
]

test('generates automatic results, confirms once, preserves results on API error and retries', async ({ page }) => {
  let resultStatus: 'Live' | 'Unofficial' = 'Live'
  let finishRequests = 0
  let submittedBody: Record<string, unknown> | null = null
  const actualStartTime = new Date(Date.now() - 5 * 60_000).toISOString()

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/referees/race-assignments/my') {
      await route.fulfill({ json: [{ raceId: 10, raceNumber: 1, raceStatus: resultStatus, tournamentName: 'Summer Cup', roundName: 'Final', assignedAt: actualStartTime }] })
      return
    }
    if (path === '/api/referee/race-entries/races/10/entries') {
      await route.fulfill({ json: entries.map((entry) => ({ ...entry, preRaceJockeyWeight: 54, horseIdentityCheckStatus: 'Matched', clinicalStatus: 'Fit', ownerName: 'Owner' })) })
      return
    }
    if (path === '/api/races/10/live-status') {
      await route.fulfill({ json: { success: true, data: { raceId: 10, status: resultStatus, scheduledTime: actualStartTime, actualStartTime, raceDurationSeconds: null, entries } } })
      return
    }
    if (path === '/api/referees/races/10/finish' && request.method() === 'POST') {
      finishRequests += 1
      submittedBody = request.postDataJSON()
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (finishRequests === 1) {
        await route.fulfill({ status: 409, json: { success: false, error: 'FINISH_REJECTED', message: 'Backend từ chối kết quả thử nghiệm.' } })
        return
      }
      resultStatus = 'Unofficial'
      await route.fulfill({ json: { success: true, data: { raceId: 10, status: 'Unofficial', raceReportId: 99 } } })
      return
    }
    await route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto(`${BASE_URL}/referee/race-console?raceId=10`)

  await expect(page.getByText('3/3 ngựa đã cán đích')).toBeVisible()
  const automaticSection = page.getByRole('heading', { name: 'Kết quả cán đích tự động' }).locator('xpath=ancestor::section')
  await expect(automaticSection).toContainText('Kim Long')
  await expect(automaticSection).toContainText('Phong Vũ')
  await expect(automaticSection).not.toContainText('Đã hủy')
  await expect(automaticSection).not.toContainText('Đã rút')
  await expect(automaticSection).not.toContainText('Đã loại')

  const finishButton = page.getByRole('button', { name: 'Kết thúc cuộc đua' })
  await expect(finishButton).toBeEnabled()
  await finishButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(finishRequests).toBe(0)
  await expect(page.getByPlaceholder('Thứ hạng')).toHaveCount(0)

  await page.getByRole('button', { name: 'Xác nhận kết quả Unofficial' }).dblclick()
  await expect(page.getByRole('alert')).toContainText('[FINISH_REJECTED] Backend từ chối kết quả thử nghiệm.')
  expect(finishRequests).toBe(1)
  await expect(page.getByRole('dialog')).toContainText('Kim Long')

  await page.getByRole('button', { name: 'Xác nhận kết quả Unofficial' }).click()
  await expect(page.getByText('Đã ghi nhận kết quả sơ bộ. Đang chờ khám sau trận.').first()).toBeVisible()
  expect(finishRequests).toBe(2)
  expect(submittedBody).toMatchObject({
    notes: '',
    results: expect.arrayContaining([
      expect.objectContaining({ raceEntryId: 101, finishPosition: expect.any(Number), finishTime: expect.any(Number) }),
      expect.objectContaining({ raceEntryId: 102, finishPosition: expect.any(Number), finishTime: expect.any(Number) }),
      expect.objectContaining({ raceEntryId: 103, finishPosition: expect.any(Number), finishTime: expect.any(Number) }),
    ]),
  })
  expect((submittedBody?.results as unknown[])).toHaveLength(3)
})

test('locks finish while racing and catches up from ActualStartTime after refresh', async ({ page }) => {
  let actualStartTime = new Date().toISOString()

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/referees/race-assignments/my') {
      await route.fulfill({ json: [{ raceId: 10, raceNumber: 1, raceStatus: 'Live', tournamentName: 'Summer Cup', roundName: 'Final', assignedAt: actualStartTime }] })
      return
    }
    if (path === '/api/referee/race-entries/races/10/entries') {
      await route.fulfill({ json: entries.slice(0, 3) })
      return
    }
    if (path === '/api/races/10/live-status') {
      await route.fulfill({ json: { success: true, data: { raceId: 10, status: 'Live', scheduledTime: actualStartTime, actualStartTime, raceDurationSeconds: null, entries: entries.slice(0, 3) } } })
      return
    }
    await route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto(`${BASE_URL}/referee/race-console?raceId=10`)
  await expect(page.getByRole('button', { name: 'Kết thúc cuộc đua' })).toBeDisabled()
  await expect(page.getByText('Đang chờ tất cả ngựa cán đích.')).toBeVisible()

  actualStartTime = new Date(Date.now() - 5 * 60_000).toISOString()
  await page.reload()
  await expect(page.getByText('3/3 ngựa đã cán đích')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kết thúc cuộc đua' })).toBeEnabled()
})

test('Spectator and Referee tabs show identical deterministic rankings and times', async ({ context }) => {
  const actualStartTime = new Date(Date.now() - 5 * 60_000).toISOString()
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/referees/race-assignments/my') {
      await route.fulfill({ json: [{ raceId: 10, raceNumber: 1, raceStatus: 'Live', tournamentName: 'Summer Cup', roundName: 'Final', assignedAt: actualStartTime }] })
      return
    }
    if (path === '/api/referee/race-entries/races/10/entries') {
      await route.fulfill({ json: entries.slice(0, 3) })
      return
    }
    if (path === '/api/races/10/live-status') {
      await route.fulfill({ json: { success: true, data: { raceId: 10, status: 'Live', scheduledTime: actualStartTime, actualStartTime, raceDurationSeconds: null, entries: entries.slice(0, 3) } } })
      return
    }
    await route.fulfill({ json: { success: true, data: [] } })
  })

  const spectatorPage = await context.newPage()
  const refereePage = await context.newPage()
  const pageErrors: string[] = []
  spectatorPage.on('pageerror', (error) => pageErrors.push(`Spectator: ${error.message}`))
  refereePage.on('pageerror', (error) => pageErrors.push(`Referee: ${error.message}`))
  await Promise.all([
    spectatorPage.goto(`${BASE_URL}/spectator/live-race?raceId=10`),
    refereePage.goto(`${BASE_URL}/referee/race-console?raceId=10`),
  ])

  const spectatorTable = spectatorPage.getByRole('heading', { name: 'KẾT QUẢ CÁN ĐÍCH TẠM THỜI' }).locator('xpath=ancestor::div[contains(@class,"border-t")]')
  const refereeTable = refereePage.getByRole('heading', { name: 'Kết quả cán đích tự động' }).locator('xpath=ancestor::section')
  await expect(spectatorTable.locator('tbody tr')).toHaveCount(3)
  await expect(refereeTable.locator('tbody tr')).toHaveCount(3)

  const spectatorRows = await spectatorTable.locator('tbody tr').allTextContents()
  const refereeRows = await refereeTable.locator('tbody tr').allTextContents()
  expect(refereeRows.map((row) => row.replace(/\s+/g, ' ').trim()))
    .toEqual(spectatorRows.map((row) => row.replace(/\s+/g, ' ').trim()))
  expect(pageErrors).toEqual([])
})
