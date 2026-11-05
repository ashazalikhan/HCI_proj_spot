import { describe, expect, it } from 'vitest'
import { displayWeight, formatRestCountdown, formatSpotDate, lbInputToKg, resolveTypedWeight, restNumeralEmWidth, LB_PER_KG } from './format'

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

describe('formatRestCountdown', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatRestCountdown(90_500)).toBe('1:31')
    expect(formatRestCountdown(0)).toBe('0:00')
  })
})

describe('restNumeralEmWidth', () => {
  it('grows with longer countdown strings', () => {
    expect(restNumeralEmWidth('Go')).toBeLessThan(restNumeralEmWidth('1:28'))
    expect(restNumeralEmWidth('1:28')).toBeLessThan(restNumeralEmWidth('600:00'))
  })
})
