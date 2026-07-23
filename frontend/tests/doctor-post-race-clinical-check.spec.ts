import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

test('opening Paddock directly lists assigned races instead of requiring raceId', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/doctors/race-assignments/my') {
      await route.fulfill({
        json: [{
          raceId: 10,
          raceNumber: 1,
          raceStatus: 'Live',
          tournamentName: 'Summer Cup',
          roundName: 'Vòng loại',
          scheduledTime: '2026-07-23T08:00:00Z',
          assignedAt: '2026-07-20T08:00:00Z',
        }],
      })
      return
    }
    if (path === '/api/doctor/race-entries/races/10/entries') {
      await route.fulfill({ json: [] })
      return
    }
    await route.fulfill({ json: [] })
  })

  await page.goto(`${BASE_URL}/doctor/paddock`)

  await expect(page.getByRole('heading', { name: 'Cuộc đua được phân công' })).toBeVisible()
  await expect(page.getByText('Không tìm thấy raceId để mở Paddock.')).toHaveCount(0)
  await expect(page.locator('[data-race-status="live"]')).toContainText('Live')
  await page.getByRole('button', { name: 'Mở Race #1' }).click()
  await expect(page).toHaveURL(`${BASE_URL}/doctor/paddock?raceId=10`)
  await expect(page.getByText('Race #1', { exact: true }).first()).toBeVisible()
})

test('Doctor records an Unfit post-race clinical check only for an Unofficial race', async ({ page }) => {
  let submittedBody: Record<string, unknown> | null = null

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/doctors/race-assignments/my') {
      await route.fulfill({
        json: [{
          raceId: 10,
          raceNumber: 1,
          raceStatus: 'Unofficial',
          tournamentName: 'Summer Cup',
          roundName: 'Vòng loại',
          scheduledTime: '2026-07-23T08:00:00Z',
          assignedAt: '2026-07-20T08:00:00Z',
        }],
      })
      return
    }

    if (path === '/api/doctor/race-entries/races/10/entries') {
      await route.fulfill({
        json: [{
          raceEntryId: 106,
          postPosition: 6,
          raceEntryStatus: 'Confirmed',
          raceStatus: 'Unofficial',
          horseName: 'Xích Thố',
          jockeyName: 'Dương Đức Mạnh',
          selfDeclaredWeight: 54,
          preRaceWeight: 54,
          horseIdentityStatus: 'Matched',
          clinicalStatus: 'Fit',
          postRaceClinicalStatus: 'Pending',
        }],
      })
      return
    }

    if (
      path === '/api/doctor/race-entries/106/post-race-clinical-check'
      && request.method() === 'PATCH'
    ) {
      submittedBody = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({
        json: {
          raceEntryId: 106,
          raceId: 10,
          doctorId: 7,
          doctorName: 'Bác sĩ Test',
          horseName: 'Xích Thố',
          jockeyName: 'Dương Đức Mạnh',
          postRaceClinicalStatus: 'Unfit',
          unfitReason: 'Ngựa có dấu hiệu chấn thương sau khi thi đấu',
          isEmergencyDisqualified: true,
          raceEntryStatus: 'Disqualified',
          message: 'Horse and jockey are unfit after the race.',
        },
      })
      return
    }

    await route.fulfill({ json: [] })
  })

  await page.goto(`${BASE_URL}/doctor/paddock?raceId=10`)
  await expect(page.locator('[data-race-status="unofficial"]')).toContainText('Unofficial')
  await expect(page.getByRole('button', { name: /Cân nặng sau đua/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Khám lại sau trận' }).click()

  await expect(page.getByText('Race: Unofficial')).toBeVisible()
  const conclusion = page.getByLabel('Kết luận sau trận Xích Thố')
  await conclusion.selectOption('Unfit')

  const reason = page.getByPlaceholder('Tối thiểu 20 ký tự')
  await reason.fill('Quá ngắn')
  await expect(page.getByRole('button', { name: 'Lưu khám sau trận' })).toBeDisabled()

  await reason.fill('Ngựa có dấu hiệu chấn thương sau khi thi đấu')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Lưu khám sau trận' }).click()

  await expect(page.getByText('Unfit · Đã loại')).toBeVisible()
  expect(submittedBody).toEqual({
    postRaceClinicalStatus: 'Unfit',
    unfitReason: 'Ngựa có dấu hiệu chấn thương sau khi thi đấu',
  })
})

test('post-race clinical action stays locked before Unofficial', async ({ page }) => {
  let postRaceClinicalRequests = 0
  let postRaceWeightRequests = 0

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/doctors/race-assignments/my') {
      await route.fulfill({
        json: [{
          raceId: 10,
          raceNumber: 1,
          raceStatus: 'Live',
          tournamentName: 'Summer Cup',
          roundName: 'Vòng loại',
          scheduledTime: '2026-07-23T08:00:00Z',
          assignedAt: '2026-07-20T08:00:00Z',
        }],
      })
      return
    }

    if (path === '/api/doctor/race-entries/races/10/entries') {
      await route.fulfill({
        json: [{
          raceEntryId: 106,
          postPosition: 6,
          raceEntryStatus: 'Confirmed',
          raceStatus: 'Live',
          horseName: 'Xích Thố',
          jockeyName: 'Dương Đức Mạnh',
          postRaceClinicalStatus: 'Pending',
        }],
      })
      return
    }

    if (path.endsWith('/post-race-clinical-check')) postRaceClinicalRequests += 1
    if (path.endsWith('/post-race-weight')) postRaceWeightRequests += 1
    await route.fulfill({ json: [] })
  })

  await page.goto(`${BASE_URL}/doctor/paddock?raceId=10`)

  await expect(page.locator('[data-race-status="live"]')).toContainText('Live')
  await expect(page.locator('[data-race-status="live"] .animate-pulse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Cân nặng sau đua/ })).toHaveCount(0)
  const postRaceClinicalButton = page.getByRole('button', { name: 'Khám lại sau trận · Chờ Unofficial' })
  await expect(postRaceClinicalButton).toBeVisible()
  await expect(postRaceClinicalButton).toBeDisabled()
  await expect(page.getByLabel('Kết luận sau trận Xích Thố')).toHaveCount(0)
  expect(postRaceClinicalRequests).toBe(0)
  expect(postRaceWeightRequests).toBe(0)
})
