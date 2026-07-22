import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

test('reloads and renders the persisted ranking after the referee submits unofficial results', async ({ page }) => {
  let finishSubmitted = false
  let resultStatus: 'Live' | 'Unofficial' | 'Official' = 'Live'
  let liveStatusRequests = 0
  let submittedBody: unknown = null

  const entries = [
    { raceEntryId: 101, postPosition: 1, status: 'Confirmed', isWithdrawn: false, horseId: 1, horseName: 'Kim Long', jockeyId: 11, jockeyName: 'Nguyễn Minh Cường', finishPosition: 1, finishTime: 72.5 },
    { raceEntryId: 102, postPosition: 2, status: 'Confirmed', isWithdrawn: false, horseId: 2, horseName: 'Phong Vũ', jockeyId: 12, jockeyName: 'Võ Thành Bách', finishPosition: 2, finishTime: 73.1 },
    { raceEntryId: 103, postPosition: 3, status: 'Confirmed', isWithdrawn: false, horseId: 3, horseName: 'Ánh Dương', jockeyId: 13, jockeyName: 'Lê Trọng Giang', finishPosition: 3, finishTime: 74 },
  ]

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/referees/race-assignments/my') {
      await route.fulfill({ json: [{ raceId: 10, raceNumber: 1, raceStatus: resultStatus, tournamentName: 'Summer Cup', roundName: 'Final', assignedAt: '2026-07-20T08:00:00Z' }] })
      return
    }
    if (path === '/api/referee/race-entries/races/10/entries') {
      await route.fulfill({ json: entries.map((entry) => ({ ...entry, preRaceJockeyWeight: 54, horseIdentityCheckStatus: 'Matched', clinicalStatus: 'Fit', ownerName: 'Owner' })) })
      return
    }
    if (path === '/api/races/10/live-status') {
      liveStatusRequests += 1
      await route.fulfill({ json: { success: true, data: { raceId: 10, status: resultStatus, scheduledTime: '2026-07-20T08:00:00Z', actualStartTime: '2026-07-20T08:01:00Z', raceDurationSeconds: 20, entries: entries.map((entry) => ({ ...entry, finishPosition: finishSubmitted ? entry.finishPosition : null, finishTime: finishSubmitted ? entry.finishTime : null })) } } })
      return
    }
    if (path === '/api/referees/races/10/finish' && request.method() === 'POST') {
      submittedBody = request.postDataJSON()
      finishSubmitted = true
      resultStatus = 'Unofficial'
      await route.fulfill({ json: { success: true, data: { raceId: 10, status: 'Unofficial', raceReportId: 99 } } })
      return
    }
    if (path === '/api/referees/profile') {
      await route.fulfill({ json: { refereeId: 7, status: 'Active' } })
      return
    }

    await route.fulfill({ json: { success: true, data: [] } })
  })

  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(`${BASE_URL}/referee/race-console?raceId=10`)

  await expect(page.getByRole('columnheader', { name: 'GATE', exact: true })).toHaveCount(1)
  await expect(page.getByRole('columnheader', { name: 'POST', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Chốt kết quả sơ bộ' }).click()
  const rankInputs = page.getByPlaceholder('Thứ hạng')
  const timeInputs = page.getByPlaceholder('Thời gian, không bắt buộc')
  for (let index = 0; index < entries.length; index += 1) {
    await rankInputs.nth(index).fill(String(index + 1))
    await timeInputs.nth(index).fill(String(entries[index].finishTime))
  }
  await page.getByRole('button', { name: 'Xác nhận Unofficial' }).click()

  await expect(page.getByRole('heading', { name: 'Kết quả sơ bộ' })).toBeVisible()
  const resultsSection = page.getByRole('heading', { name: 'Kết quả sơ bộ' }).locator('..').locator('..')
  await expect(resultsSection).toContainText('Kim Long')
  await expect(resultsSection).toContainText('72.5 giây')
  await expect(resultsSection).toContainText('Phong Vũ')
  await expect(resultsSection).toContainText('73.1 giây')
  expect(submittedBody).toMatchObject({ results: [{ raceEntryId: 101, finishPosition: 1, finishTime: 72.5 }, { raceEntryId: 102, finishPosition: 2, finishTime: 73.1 }, { raceEntryId: 103, finishPosition: 3, finishTime: 74 }] })
  expect(liveStatusRequests).toBeGreaterThanOrEqual(2)

  resultStatus = 'Official'
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kết quả chính thức' })).toBeVisible()
  await expect(page.getByText('Kim Long', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('72.5 giây', { exact: true })).toBeVisible()
})
