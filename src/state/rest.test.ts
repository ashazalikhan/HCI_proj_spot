import { describe, expect, it } from 'vitest'
import {
  adjustRestTiming,
  isFreshZeroRest,
  restProgress,
  restRemainingMs,
} from './rest'

describe('restRemainingMs', () => {
  it('computes from restEndsAt minus now and clamps at zero', () => {
    expect(restRemainingMs(10_000, 4_000)).toBe(6_000)
    expect(restRemainingMs(10_000, 12_000)).toBe(0)
  })
})

describe('restProgress', () => {
  it('tracks elapsed against restTotalMs', () => {
    expect(restProgress(60_000, 45_000)).toBeCloseTo(0.25)
    expect(restProgress(60_000, 0)).toBe(1)
    expect(restProgress(0, 0)).toBe(1)
  })
})

describe('adjustRestTiming', () => {
  const now = 1_000_000
  const endsAt = now + 30_000
  const total = 90_000

  it('adds fifteen seconds without shrinking elapsed', () => {
    const next = adjustRestTiming(endsAt, total, 15_000, now)
    expect(next.restEndsAt).toBe(endsAt + 15_000)
    expect(next.restTotalMs).toBe(total + 15_000)
    expect(next.expired).toBe(false)
  })

  it('subtracts with clamp at zero and shrinks total by applied delta only', () => {
    const next = adjustRestTiming(endsAt, total, -15_000, now)
    expect(next.restEndsAt).toBe(now + 15_000)
    expect(next.restTotalMs).toBe(total - 15_000)
    expect(next.expired).toBe(false)
  })

  it('lands on zero when subtracting past remaining', () => {
    const short = adjustRestTiming(now + 5_000, 20_000, -15_000, now)
    expect(short.restEndsAt).toBe(now)
    expect(short.restTotalMs).toBe(15_000)
    expect(short.expired).toBe(true)
  })
})

describe('isFreshZeroRest', () => {
  it('detects a just-committed zero rest', () => {
    const now = 5_000
    expect(
      isFreshZeroRest({ phase: 'resting', restTotalMs: 0, restEndsAt: now - 200 }, now),
    ).toBe(true)
  })

  it('rejects an old zero rest end time', () => {
    const now = 5_000
    expect(
      isFreshZeroRest({ phase: 'resting', restTotalMs: 0, restEndsAt: now - 5_000 }, now),
    ).toBe(false)
  })
})
