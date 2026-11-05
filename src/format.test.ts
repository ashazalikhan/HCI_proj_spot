import { describe, expect, it } from 'vitest'
import { displayWeight, formatSpotDate, lbInputToKg, resolveTypedWeight, LB_PER_KG } from './format'

describe('formatSpotDate', () => {
  it('uses the short en-GB pattern', () => {
    expect(formatSpotDate(new Date('2026-11-05T12:00:00.000Z'))).toBe('Thu 5 Nov')
  })
})

describe('weight conversion', () => {
  it('stores typed pounds at 4 decimals and shows 1 decimal', () => {
    const kg = lbInputToKg(135)
    expect(kg).toBe(Math.round((135 / LB_PER_KG) * 10000) / 10000)
    expect(displayWeight(kg, 'lb')).toMatch(/^\d+\.\d lb$/)
    const shown = displayWeight(kg, 'lb').replace(' lb', '')
    expect(resolveTypedWeight(shown, kg, 'lb')).toBe(kg)
  })

  it('keeps stored kilograms when the sheet text is unchanged', () => {
    expect(resolveTypedWeight('20.25', 20.254, 'kg')).toBe(20.254)
    expect(resolveTypedWeight('21', 20.254, 'kg')).toBe(21)
    expect(resolveTypedWeight('', 20, 'kg')).toBeNull()
    expect(resolveTypedWeight('--', 20, 'kg')).toBeNull()
    expect(resolveTypedWeight('nope', 20, 'kg')).toBe('invalid')
    expect(resolveTypedWeight('-1', 20, 'kg')).toBe('invalid')
  })
})
