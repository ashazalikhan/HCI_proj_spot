/** Remaining rest time from persisted end timestamp only. */
export function restRemainingMs(restEndsAt: number | undefined, now: number): number {
  if (restEndsAt === undefined || !Number.isFinite(restEndsAt)) return 0
  return Math.max(0, restEndsAt - now)
}

/** Progress ring: 0 at start, 1 when remaining is 0. */
export function restProgress(restTotalMs: number | undefined, remainingMs: number): number {
  if (restTotalMs === undefined || restTotalMs <= 0) return 1
  const elapsed = restTotalMs - remainingMs
  return Math.min(1, Math.max(0, elapsed / restTotalMs))
}

const ADJUST_STEP_MS = 15_000

export function restAdjustStepMs(): number {
  return ADJUST_STEP_MS
}

export function adjustRestTiming(
  restEndsAt: number,
  restTotalMs: number,
  deltaMs: number,
  now: number,
): { restEndsAt: number; restTotalMs: number; expired: boolean } {
  const remaining = restRemainingMs(restEndsAt, now)
  const newRemaining = Math.max(0, remaining + deltaMs)
  const newRestEndsAt = now + newRemaining
  const appliedDelta = newRestEndsAt - restEndsAt
  const newRestTotalMs = Math.max(0, restTotalMs + appliedDelta)
  return { restEndsAt: newRestEndsAt, restTotalMs: newRestTotalMs, expired: newRemaining === 0 }
}

/** True when a zero-second rest was just committed (not an old expired timer). */
export function isFreshZeroRest(active: {
  phase: string
  restTotalMs?: number
  restEndsAt?: number
}, now: number): boolean {
  if (active.phase !== 'resting' || active.restTotalMs !== 0 || active.restEndsAt === undefined) return false
  return active.restEndsAt >= now - 1000
}

export function toRestOverActive<T extends { phase: string; restEndsAt?: number; restTotalMs?: number }>(
  active: T,
): T {
  const { restEndsAt: _e, restTotalMs: _t, ...rest } = active
  return { ...rest, phase: 'rest-over' } as T
}
