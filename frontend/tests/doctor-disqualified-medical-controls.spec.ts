import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

test('disables identity and clinical controls immediately after weigh-in disqualification', async ({ page }) => {
  let identityRequests = 0
  let clinicalRequests = 0

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/doctors/race-assignments/my') {
      await route.fulfill({ json: [{ raceId: 10, raceNumber: 1, raceStatus: 'Upcoming', tournamentName: 'Summer Cup', roundName: 'Vòng loại', assignedAt: '2026-07-20T08:00:00Z' }] })
      return
    }
    if (path === '/api/doctor/race-entries/races/10/entries') {
      await route.fulfill({ json: [{ raceEntryId: 106, postPosition: 6, status: 'Confirmed', raceEntryStatus: 'Confirmed', isWithdrawn: false, horseName: 'Xích Thố', jockeyName: 'Dương Đức Mạnh', selfDeclaredWeight: 54, preRaceJockeyWeight: null, thresholdKg: 2, isWeightWarning: false, horseIdentityCheckStatus: null, clinicalStatus: null, isEmergencyDisqualified: false }] })
      return
    }
    if (path === '/api/doctor/race-entries/106/pre-race-weight' && request.method() === 'PATCH') {
      await route.fulfill({ json: { raceEntryId: 106, selfDeclaredWeight: 54, preRaceJockeyWeight: 59.8, weightDifference: 5.8, thresholdKg: 2, isWeightWarning: true, isEmergencyDisqualified: true, raceEntryStatus: 'Disqualified', message: 'Race entry has been disqualified.' } })
      return
    }
    if (path.endsWith('/horse-identity')) {
      identityRequests += 1
    }
    if (path.endsWith('/clinical-check')) {
      clinicalRequests += 1
    }

    await route.fulfill({ json: [] })
  })

  await page.goto(`${BASE_URL}/doctor/paddock?raceId=10`)

  await page.getByPlaceholder('Nhập cân').fill('59.8')
  await page.getByRole('button', { name: /Weigh-In/ }).last().click()
  await expect(page.getByText('Đã loại', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Kiểm tra ngựa (Vet Check)' }).click()

  await expect(page.getByRole('button', { name: 'Lưu danh tính' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Lưu khám' })).toBeDisabled()
  await expect(page.getByRole('combobox').first()).toBeDisabled()
  await expect(page.getByRole('combobox').nth(1)).toBeDisabled()
  expect(identityRequests).toBe(0)
  expect(clinicalRequests).toBe(0)
})
