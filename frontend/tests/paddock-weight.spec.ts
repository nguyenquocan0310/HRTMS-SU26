import { expect, test } from '@playwright/test'
import {
  calculateWeightDifference,
  exceedsWeightDifferenceLimit,
  parseWeightValue,
} from '../src/utils/paddockWeight'

test.describe('Paddock weight difference', () => {
  const boundaryCases = [
    { difference: 0, expected: false },
    { difference: -0.1, expected: false },
    { difference: 2, expected: false },
    { difference: -2, expected: false },
    { difference: 2.1, expected: true },
    { difference: -2.1, expected: true },
    { difference: -4, expected: true },
  ]

  for (const { difference, expected } of boundaryCases) {
    test(`${difference} kg is ${expected ? 'over' : 'within'} the 2 kg limit`, () => {
      expect(exceedsWeightDifferenceLimit(difference, 2)).toBe(expected)
    })
  }

  test('calculates signed difference from numeric weights', () => {
    expect(calculateWeightDifference(50, 54)).toBe(-4)
  })

  test('accepts comma decimal values without comparing formatted strings', () => {
    expect(parseWeightValue('50,5')).toBe(50.5)
    expect(calculateWeightDifference('50,5', '54,0')).toBe(-3.5)
  })

  test('returns null for missing or invalid data', () => {
    expect(calculateWeightDifference(null, 54)).toBeNull()
    expect(calculateWeightDifference('invalid', 54)).toBeNull()
    expect(exceedsWeightDifferenceLimit(Number.NaN, 2)).toBeNull()
  })
})
