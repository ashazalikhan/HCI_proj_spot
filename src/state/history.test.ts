import { describe, expect, it } from 'vitest'
import { prefillDraft, previousRealSessionSameRoutine, repsComparisonLine, sessionVolumeKg, trendPointsForExercise } from './history'
import type { LoggedSet, Session, SessionExercise } from './types'

function set(weightKg: number, reps: number, id = `${weightKg}-${reps}`): LoggedSet {
  return { id, weightKg, reps, doneAt: '2026-11-01T10:00:00.000Z' }
}

function exercise(id: string, sets: LoggedSet[] = []): SessionExercise {
  return {
    routineExerciseId: id,
    name: id,
    targetSets: 4,
    targetReps: 8,
    restSeconds: 90,
    sets,
  }
}

function session(partial: Partial<Session> & Pick<Session, 'id'>): Session {
  return {
    routineId: 'push',
    routineName: 'Push Day',
    isSample: false,
    startedAt: '2026-11-01T09:00:00.000Z',
    exercises: [],
    ...partial,
  }
}

describe('prefillDraft', () => {
  it('stays empty when nothing has been logged', () => {
    const current = session({ id: 'now', exercises: [exercise('bench')] })
    const draft = prefillDraft({ sessions: [current], currentSession: current, exerciseIndex: 0, setIndex: 0 })
    expect(draft).toEqual({ weightKg: null, reps: null, source: 'none' })
    expect(current.exercises[0]?.sets).toEqual([])
  })

  it('uses the previous set in this session before older sessions', () => {
    const current = session({
      id: 'now',
      exercises: [exercise('bench', [set(40, 8)])],
    })
    const older = session({
      id: 'old',
      finishedAt: '2026-10-01T09:00:00.000Z',
      exercises: [exercise('bench', [set(20, 5), set(99, 9)])],
    })
    const draft = prefillDraft({
      sessions: [older, current],
      currentSession: current,
      exerciseIndex: 0,
      setIndex: 1,
    })
    expect(draft).toEqual({
      weightKg: 40,
      reps: 8,
      source: 'previous-set',
      sourceLabel: 'from set 1',
    })
  })

  it('uses the same set number from the last real session', () => {
    const current = session({ id: 'now', exercises: [exercise('bench')] })
    const older = session({
      id: 'old',
      finishedAt: '2026-10-01T09:00:00.000Z',
      routineName: 'Push Day',
      exercises: [exercise('bench', [set(50, 6), set(55, 5)])],
    })
    const draft = prefillDraft({
      sessions: [older, current],
      currentSession: current,
      exerciseIndex: 0,
      setIndex: 1,
    })
    expect(draft.source).toBe('last-session')
    expect(draft.weightKg).toBe(55)
    expect(draft.reps).toBe(5)
    expect(draft.sourceLabel).toBe('from last Push Day')
  })

  it('ignores sample sessions', () => {
    const current = session({ id: 'now', exercises: [exercise('bench')] })
    const sample = session({
      id: 'sample',
      isSample: true,
      finishedAt: '2026-11-04T09:00:00.000Z',
      exercises: [exercise('bench', [set(100, 1)])],
    })
    const real = session({
      id: 'real',
      finishedAt: '2026-11-02T09:00:00.000Z',
      exercises: [exercise('bench', [set(60, 8)])],
    })
    const draft = prefillDraft({
      sessions: [sample, real, current],
      currentSession: current,
      exerciseIndex: 0,
      setIndex: 0,
    })
    expect(draft.weightKg).toBe(60)
    expect(draft.source).toBe('last-session')
  })

  it('uses a starting weight without inventing reps', () => {
    const current = session({ id: 'now', exercises: [exercise('bench')] })
    const draft = prefillDraft({
      sessions: [current],
      currentSession: current,
      exerciseIndex: 0,
      setIndex: 0,
      startWeightKg: 20,
    })
    expect(draft).toEqual({
      weightKg: 20,
      reps: null,
      source: 'starting-target',
      sourceLabel: 'starting target',
    })
  })

  it('does not invent a draft for an exercise with no history', () => {
    const current = session({
      id: 'now',
      exercises: [exercise('bench', [set(40, 8)]), exercise('row')],
    })
    const draft = prefillDraft({
      sessions: [current],
      currentSession: current,
      exerciseIndex: 1,
      setIndex: 0,
    })
    expect(draft).toEqual({ weightKg: null, reps: null, source: 'none' })
    expect(current.exercises[0]?.sets).toHaveLength(1)
    expect(current.exercises[1]?.sets).toHaveLength(0)
  })
})

describe('session summaries and trends', () => {
  it('excludes sample sessions from comparison and trend points', () => {
    const real = session({
      id: 'real1',
      finishedAt: '2026-11-01T10:00:00.000Z',
      exercises: [exercise('bench', [set(50, 8)])],
    })
    const real2 = session({
      id: 'real2',
      finishedAt: '2026-11-03T10:00:00.000Z',
      exercises: [exercise('bench', [set(55, 10)])],
    })
    const sample = session({
      id: 'sample',
      isSample: true,
      finishedAt: '2026-11-04T10:00:00.000Z',
      exercises: [exercise('bench', [set(100, 1)])],
    })
    const current = session({
      id: 'now',
      finishedAt: '2026-11-05T10:00:00.000Z',
      exercises: [exercise('bench', [set(60, 12)])],
    })
    const sessions = [sample, real, real2, current]
    expect(
      repsComparisonLine(current, previousRealSessionSameRoutine(sessions, current.routineId, current.id)),
    ).toMatch(/more reps than last/)
    expect(trendPointsForExercise(sessions, 'bench')).toHaveLength(3)
    expect(trendPointsForExercise(sessions, 'bench').every((p) => p.sessionId !== 'sample')).toBe(true)
  })

  it('omits comparison when no prior real session exists', () => {
    const current = session({
      id: 'only',
      finishedAt: '2026-11-05T10:00:00.000Z',
      exercises: [exercise('bench', [set(40, 8)])],
    })
    expect(repsComparisonLine(current, null)).toBeNull()
  })

  it('computes volume as sum of kg times reps without changing stored weights', () => {
    const finished = session({
      id: 'one',
      finishedAt: '2026-11-05T10:00:00.000Z',
      exercises: [exercise('bench', [set(40, 8), set(42.5, 6)])],
    })
    expect(sessionVolumeKg(finished)).toBe(40 * 8 + 42.5 * 6)
    expect(finished.exercises[0]?.sets[1]?.weightKg).toBe(42.5)
  })

  it('builds trend points from the last set per session and skips exercises with no sets', () => {
    const a = session({
      id: 'a',
      finishedAt: '2026-11-01T10:00:00.000Z',
      exercises: [exercise('bench', [set(50, 8), set(55, 6)])],
    })
    const b = session({
      id: 'b',
      finishedAt: '2026-11-03T10:00:00.000Z',
      exercises: [exercise('bench', [set(60, 5)]), exercise('row', [])],
    })
    const points = trendPointsForExercise([a, b], 'bench')
    expect(points).toHaveLength(2)
    expect(points[0]?.weightKg).toBe(55)
    expect(points[1]?.weightKg).toBe(60)
    expect(trendPointsForExercise([a], 'bench')).toHaveLength(1)
  })
})
