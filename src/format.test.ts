import { describe, expect, it } from 'vitest'
import { formatSpotDate } from './format'

describe('formatSpotDate', () => {
  it('uses the short en-GB pattern', () => {
    expect(formatSpotDate(new Date('2026-11-05T12:00:00.000Z'))).toBe('Thu 5 Nov')
  })
})
