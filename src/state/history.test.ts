import { describe, expect, it } from 'vitest'
import { prefillDraft } from './history'
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
