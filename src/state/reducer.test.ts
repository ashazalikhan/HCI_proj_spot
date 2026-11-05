import { describe, expect, it } from 'vitest'
import { reducer } from './reducer'
import type { AppData, Session } from './types'
import { defaultSettings } from './seed'

function state(): AppData {
  const open: Session = {
    id: 'open',
    routineId: 'push',
    routineName: 'Push Day',
    isSample: false,
    startedAt: '2026-11-05T09:00:00.000Z',
    exercises: [
      {
        routineExerciseId: 'bench',
        name: 'Bench Press',
        targetSets: 4,
        targetReps: 8,
        restSeconds: 90,
        sets: [{ id: 'logged', weightKg: 60, reps: 8, doneAt: '2026-11-05T09:10:00.000Z' }],
      },
    ],
  }
  const kept: Session = {
    id: 'kept',
    routineId: 'push',
    routineName: 'Push Day',
    isSample: false,
    startedAt: '2026-11-01T09:00:00.000Z',
    finishedAt: '2026-11-01T10:00:00.000Z',
    exercises: [
      {
        routineExerciseId: 'bench',
        name: 'Bench Press',
        targetSets: 4,
        targetReps: 8,
        restSeconds: 90,
        sets: [{ id: 'old', weightKg: 50, reps: 8, doneAt: '2026-11-01T09:10:00.000Z' }],
      },
    ],
  }
  return {
    version: 1,
    routines: [
      {
        id: 'push',
        name: 'Push Day',
        isSample: false,
        exercises: [{ id: 'bench', name: 'Bench Press', targetSets: 4, targetReps: 8, restSeconds: 90 }],
      },
      { id: 'empty', name: 'Empty Day', isSample: false, exercises: [] },
    ],
    sessions: [kept, open],
    active: {
      sessionId: 'open',
      exerciseIndex: 0,
      setIndex: 1,
      phase: 'logging',
      draft: { weightKg: 60, reps: 8, source: 'previous-set', sourceLabel: 'from set 1' },
    },
    settings: { ...defaultSettings },
  }
}

describe('routine edits leave session snapshots alone', () => {
  it('renaming or deleting a routine does not change stored sessions', () => {
    const current = state()
    const snapshot = structuredClone(current.sessions)
    const renamed = reducer(current, { type: 'rename-routine', routineId: 'push', name: 'Press Day' })
    expect(renamed.sessions).toEqual(snapshot)
    expect(renamed.sessions[1]?.routineName).toBe('Push Day')
    const deleted = reducer(renamed, { type: 'delete-routine', routineId: 'push' })
    expect(deleted.routines.map((routine) => routine.id)).toEqual(['empty'])
    expect(deleted.sessions).toEqual(snapshot)
    const edited = reducer(current, {
      type: 'update-exercise',
      routineId: 'push',
      exerciseId: 'bench',
      name: 'Close-grip Bench',
      targetSets: 5,
      targetReps: 5,
      restSeconds: 120,
    })
    expect(edited.sessions).toEqual(snapshot)
  })
})

describe('discard-workout', () => {
  it('removes one unfinished session, including logged sets, and keeps finished history', () => {
    const next = reducer(state(), { type: 'discard-workout' })
    expect(next.sessions.map((session) => session.id)).toEqual(['kept'])
    expect(next.active).toBeNull()
    expect(next.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
  })

  it('discards an empty exercise list without throwing', () => {
    const current = state()
    current.sessions = [
      current.sessions[0] as Session,
      {
        id: 'blank',
        routineId: 'empty',
        routineName: 'Empty Day',
        isSample: false,
        startedAt: '2026-11-05T09:00:00.000Z',
        exercises: [],
      },
    ]
    current.active = {
      sessionId: 'blank',
      exerciseIndex: 0,
      setIndex: 0,
      phase: 'logging',
      draft: { weightKg: null, reps: null, source: 'none' },
    }
    const next = reducer(current, { type: 'discard-workout' })
    expect(next.sessions.map((session) => session.id)).toEqual(['kept'])
    expect(next.active).toBeNull()
  })
})

describe('start-workout', () => {
  it('does not start an empty routine', () => {
    const current = state()
    current.sessions = current.sessions.filter((session) => session.finishedAt !== undefined)
    current.active = null
    const next = reducer(current, { type: 'start-workout', routineId: 'empty' })
    expect(next).toBe(current)
  })

  it('does not start a second session while one is unfinished', () => {
    const current = state()
    const next = reducer(current, { type: 'start-workout', routineId: 'push' })
    expect(next).toBe(current)
  })

  it('copies the routine name onto the session', () => {
    const current = state()
    current.sessions = []
    current.active = null
    const next = reducer(current, { type: 'start-workout', routineId: 'push' })
    expect(next.sessions[0]?.routineName).toBe('Push Day')
    expect(next.sessions[0]?.exercises[0]?.sets).toEqual([])
    expect(next.active?.draft.source).toBe('none')
  })
})
