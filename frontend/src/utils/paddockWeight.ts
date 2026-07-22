// The list API does not expose the tournament threshold. Keep one frontend
// fallback aligned with the backend's default PreRaceWeightThresholdKg (2 kg).
export const DEFAULT_ALLOWED_WEIGHT_DIFFERENCE_KG = 2

export const parseWeightValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(',', '.')
  if (normalized === '') return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export const calculateWeightDifference = (
  actualWeight: unknown,
  declaredWeight: unknown
): number | null => {
  const actual = parseWeightValue(actualWeight)
  const declared = parseWeightValue(declaredWeight)

  return actual === null || declared === null ? null : actual - declared
}

export const exceedsWeightDifferenceLimit = (
  differenceValue: unknown,
  allowedDifferenceValue: unknown
): boolean | null => {
  const difference = parseWeightValue(differenceValue)
  const allowedDifference = parseWeightValue(allowedDifferenceValue)

  if (difference === null || allowedDifference === null) return null

  const exceedsLimit = Math.abs(difference) > allowedDifference
  return exceedsLimit
}
