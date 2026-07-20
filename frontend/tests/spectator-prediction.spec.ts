import { expect, test } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5173'

test('normalizes leading zeros and does not show a false insufficient-balance error after success', async ({ page }) => {
  let submittedBody: unknown = null

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/reconciliation/wallet') {
      await route.fulfill({ json: { success: true, data: { walletId: 1, balance: 1000, transactions: [], totalTransactions: 0 } } })
      return
    }
    if (path === '/api/predictions/races/10/gate-status') {
      await route.fulfill({ json: { success: true, data: { raceId: 10, isPostPositionDrawn: true, isPredictionGateClosed: false, raceStatus: 'Pre-Race', canPredict: true } } })
      return
    }
    if (path === '/api/predictions/races/10/form-scores') {
      await route.fulfill({ json: { success: true, data: [{ raceEntryId: 101, horseId: 9, horseName: 'Chế Thiện', jockeyId: 19, jockeyName: 'Nguyễn Quốc An', horseHistoryScore: 0, jockeyHistoryScore: 0, roundTypeAvgScore: 0, formScore: 0 }] } })
      return
    }
    if (path === '/api/predictions' && request.method() === 'POST') {
      submittedBody = request.postDataJSON()
      await route.fulfill({ json: { success: true, data: { predictionId: 77, raceId: 10, raceEntryId: 101, horseName: 'Chế Thiện', predictionType: 'Win', pointsPlaced: 1000, status: 'Pending', pointsAwarded: null, createdAt: '2026-07-20T08:00:00Z', walletBalanceAfter: 0 } } })
      return
    }

    await route.fulfill({ json: { success: true, data: [] } })
  })

  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(`${BASE_URL}/spectator/prediction?raceId=10`)

  await page.getByRole('button', { name: /Chế Thiện/ }).click()
  const pointsInput = page.getByLabel('Điểm dự đoán')
  await pointsInput.fill('01000')
  await expect(pointsInput).toHaveValue('1000')
  await page.getByRole('button', { name: 'Xác nhận dự đoán Win' }).click()

  await expect(page.getByText('Đã đặt 1.000 điểm cho Chế Thiện thành công. Số dư còn lại: 0 điểm.')).toBeVisible()
  await expect(page.getByText('Số dư ví không đủ.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xem lịch sử dự đoán' })).toBeVisible()
  await expect(page.getByText('0 điểm', { exact: true }).first()).toBeVisible()
  expect(submittedBody).toEqual({ raceId: 10, raceEntryId: 101, pointsPlaced: 1000 })
})
