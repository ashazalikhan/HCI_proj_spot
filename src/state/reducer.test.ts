import { describe, expect, it } from 'vitest'
import { draftForCursor } from './history'
import { reducer, commitWeightAndReps } from './reducer'
import { repairAppData } from './repair'
import type { AppData, Draft, LoggedSet, Session } from './types'
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

function logged(id: string, weightKg: number, reps: number): LoggedSet {
  return { id, weightKg, reps, doneAt: '2026-11-01T10:00:00.000Z' }
}

function loggingState(draft: Draft = { weightKg: 40, reps: 8, source: 'none' }): AppData {
  return {
    version: 1,
    routines: [
      {
        id: 'push',
        name: 'Push Day',
        isSample: false,
        exercises: [
          { id: 'bench', name: 'Bench Press', targetSets: 2, targetReps: 8, restSeconds: 90 },
          { id: 'row', name: 'Cable Row', targetSets: 1, targetReps: 10, restSeconds: 60 },
        ],
      },
    ],
    sessions: [
      {
        id: 'open',
        routineId: 'push',
        routineName: 'Push Day',
        isSample: false,
        startedAt: '2026-11-05T09:00:00.000Z',
        exercises: [
          {
            routineExerciseId: 'bench',
            name: 'Bench Press',
            targetSets: 2,
            targetReps: 8,
            restSeconds: 90,
            sets: [],
          },
          {
            routineExerciseId: 'row',
            name: 'Cable Row',
            targetSets: 1,
            targetReps: 10,
            restSeconds: 60,
            sets: [],
          },
        ],
      },
    ],
    active: {
      sessionId: 'open',
      exerciseIndex: 0,
      setIndex: 0,
      phase: 'logging',
      draft,
    },
    settings: { ...defaultSettings },
  }
}

describe('commit boundary', () => {
  const invalidWeights: Array<number | null> = [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]
  const invalidReps: Array<number | null> = [
    null,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    0,
    1.5,
    -1,
  ]

  it.each(invalidWeights)('rejects weight %s', (weightKg) => {
    expect(commitWeightAndReps(weightKg, 8)).toBeNull()
    const current = loggingState({ weightKg, reps: 8, source: 'none' })
    expect(reducer(current, { type: 'commit-set' })).toBe(current)
    expect(current.sessions[0]?.exercises[0]?.sets).toEqual([])
  })

  it.each(invalidReps)('rejects reps %s', (reps) => {
    expect(commitWeightAndReps(40, reps)).toBeNull()
    const current = loggingState({ weightKg: 40, reps, source: 'none' })
    expect(reducer(current, { type: 'commit-set' })).toBe(current)
  })

  it('rejects other non-numbers without creating a set', () => {
    const bad = loggingState({
      weightKg: '10' as unknown as number,
      reps: undefined as unknown as number,
      source: 'none',
    })
    expect(commitWeightAndReps('10' as unknown as number, 8)).toBeNull()
    expect(commitWeightAndReps(40, undefined as unknown as number)).toBeNull()
    expect(reducer(bad, { type: 'commit-set' })).toBe(bad)
    expect(bad.sessions[0]?.exercises[0]?.sets).toEqual([])
  })

  it('logs bodyweight zero with at least one rep', () => {
    const next = reducer(loggingState({ weightKg: 0, reps: 5, source: 'edited' }), { type: 'commit-set' })
    expect(next.sessions[0]?.exercises[0]?.sets).toEqual([
      expect.objectContaining({ weightKg: 0, reps: 5 }),
    ])
    expect(next.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
    expect(next.active?.phase).toBe('resting')
  })
})

describe('logging actions', () => {
  it('keeps an edited draft without logging, including across an in-range repair', () => {
    const current = loggingState()
    const edited = reducer(current, { type: 'update-draft', weightKg: 42.5, reps: 6 })
    expect(edited.sessions[0]?.exercises[0]?.sets).toEqual([])
    expect(edited.active?.draft).toEqual({ weightKg: 42.5, reps: 6, source: 'edited' })
    const repaired = repairAppData(edited)
    expect(repaired.changed).toBe(false)
    expect(repaired.data.active?.draft).toEqual(edited.active?.draft)
    expect(reducer(edited, { type: 'update-draft', weightKg: Number.NaN, reps: 6 })).toBe(edited)
    expect(reducer(edited, { type: 'update-draft', weightKg: 42.5, reps: Number.POSITIVE_INFINITY })).toBe(edited)
  })

  it('commits once, then ignores a repeated commit', () => {
    const once = reducer(loggingState(), { type: 'commit-set' })
    const twice = reducer(once, { type: 'commit-set' })
    expect(twice).toBe(once)
    expect(once.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
    expect(once.sessions[0]?.exercises[1]?.sets).toHaveLength(0)
    expect(once.active?.phase).toBe('resting')
    expect(once.active?.setIndex).toBe(1)
    expect(once.active?.lastCommittedSetId).toBe(once.sessions[0]?.exercises[0]?.sets[0]?.id)
    expect(reducer(once, { type: 'start-set' }).sessions[0]?.exercises[0]?.sets).toHaveLength(1)
    expect(reducer(once, { type: 'start-set' }).active?.phase).toBe('logging')
    expect(reducer(once, { type: 'start-set' }).active?.restEndsAt).toBeUndefined()
  })

  it('prefers the previous set over an older session and ignores sample history', () => {
    const current = loggingState({ weightKg: 40, reps: 8, source: 'last-session', sourceLabel: 'from last Push Day' })
    const older: Session = {
      id: 'old',
      routineId: 'push',
      routineName: 'Push Day',
      isSample: false,
      startedAt: '2026-10-01T09:00:00.000Z',
      finishedAt: '2026-10-01T10:00:00.000Z',
      exercises: [
        {
          routineExerciseId: 'bench',
          name: 'Bench Press',
          targetSets: 2,
          targetReps: 8,
          restSeconds: 90,
          sets: [logged('old-1', 20, 5), logged('old-2', 99, 9)],
        },
      ],
    }
    const sample: Session = {
      ...older,
      id: 'sample',
      isSample: true,
      finishedAt: '2026-11-04T10:00:00.000Z',
      exercises: [
        {
          ...older.exercises[0]!,
          sets: [logged('sample-1', 100, 1), logged('sample-2', 100, 1)],
        },
      ],
    }
    current.sessions = [sample, older, current.sessions[0]!]
    const open = current.sessions[2]!
    expect(draftForCursor(current, open, 0, 0).weightKg).toBe(20)
    expect(draftForCursor(current, open, 0, 0).source).toBe('last-session')
    const committed = reducer(current, { type: 'commit-set' })
    expect(committed.active?.draft).toEqual({
      weightKg: 40,
      reps: 8,
      source: 'previous-set',
      sourceLabel: 'from set 1',
    })
    expect(committed.active?.draft.weightKg).not.toBe(99)
    expect(committed.active?.draft.weightKg).not.toBe(100)
  })

  it('uses a previous set inside a sample session and does not invent one for an empty exercise', () => {
    const current = loggingState({ weightKg: 30, reps: 8, source: 'none' })
    current.sessions[0]!.isSample = true
    const committed = reducer(current, { type: 'commit-set' })
    expect(committed.sessions[0]?.isSample).toBe(true)
    expect(committed.active?.draft.source).toBe('previous-set')
    expect(committed.active?.draft.weightKg).toBe(30)
    const continued = reducer(committed, { type: 'start-set' })
    const skipped = reducer(continued, { type: 'skip-exercise' })
    expect(skipped.active?.exerciseIndex).toBe(1)
    expect(skipped.active?.draft).toEqual({ weightKg: null, reps: null, source: 'none' })
    expect(skipped.sessions[0]?.exercises[1]?.sets).toEqual([])
    expect(skipped.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
  })

  it('uses a starting target without inventing reps', () => {
    const current = loggingState()
    current.sessions = []
    current.active = null
    current.routines[0]!.exercises[0]!.startWeightKg = 20
    const next = reducer(current, { type: 'start-workout', routineId: 'push' })
    expect(next.sessions[0]?.exercises[0]?.sets).toEqual([])
    expect(next.active?.draft).toEqual({
      weightKg: 20,
      reps: null,
      source: 'starting-target',
      sourceLabel: 'starting target',
    })
    expect(reducer(next, { type: 'commit-set' })).toBe(next)
  })

  it('edits a logged set in place, then undo removes that whole set', () => {
    const committed = reducer(loggingState(), { type: 'commit-set' })
    const setId = committed.sessions[0]?.exercises[0]?.sets[0]?.id
    if (!setId) throw new Error('missing set')
    const edited = reducer(committed, { type: 'edit-set', setId, weightKg: 55, reps: 6 })
    expect(edited.active).toBe(committed.active)
    expect(edited.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
    expect(edited.sessions[0]?.exercises[0]?.sets[0]).toEqual(
      expect.objectContaining({ id: setId, weightKg: 55, reps: 6, editedAt: expect.any(String) }),
    )
    expect(reducer(edited, { type: 'edit-set', setId, weightKg: Number.NaN, reps: 6 })).toBe(edited)
    const undone = reducer(edited, { type: 'undo-last-set' })
    expect(undone.sessions[0]?.exercises[0]?.sets).toEqual([])
    expect(undone.active?.phase).toBe('logging')
    expect(undone.active?.restEndsAt).toBeUndefined()
    expect(undone.active?.lastCommittedSetId).toBeUndefined()
    expect(undone.active?.draft).toEqual({ weightKg: 55, reps: 6, source: 'edited' })
    expect(reducer(undone, { type: 'undo-last-set' })).toBe(undone)
  })

  it('undo after skip returns to the committed set and adds nothing', () => {
    const committed = reducer(loggingState(), { type: 'commit-set' })
    const logging = reducer(committed, { type: 'start-set' })
    const skipped = reducer(logging, { type: 'skip-exercise' })
    expect(skipped.active?.exerciseIndex).toBe(1)
    expect(skipped.active?.lastCommittedSetId).toBe(committed.active?.lastCommittedSetId)
    expect(skipped.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
    expect(skipped.sessions[0]?.exercises[1]?.sets).toEqual([])
    const undone = reducer(skipped, { type: 'undo-last-set' })
    expect(undone.active?.exerciseIndex).toBe(0)
    expect(undone.active?.setIndex).toBe(0)
    expect(undone.sessions[0]?.exercises[0]?.sets).toEqual([])
    expect(undone.sessions[0]?.exercises[1]?.sets).toEqual([])
  })

  it('finishes the last slot with one new set and no active undo target', () => {
    const current = loggingState({ weightKg: 50, reps: 8, source: 'previous-set', sourceLabel: 'from set 1' })
    current.sessions[0]!.exercises[0]!.sets = [logged('done', 50, 8)]
    current.active!.setIndex = 1
    const finished = reducer(current, { type: 'commit-set' })
    expect(finished.active?.phase).toBe('resting')
    expect(finished.active?.exerciseIndex).toBe(1)
    expect(finished.sessions[0]?.exercises[0]?.sets).toHaveLength(2)
    const ready = reducer(finished, { type: 'start-set' })
    if (!ready.active) throw new Error('expected the next exercise')
    const last = reducer(
      {
        ...ready,
        active: {
          ...ready.active,
          draft: { weightKg: 30, reps: 10, source: 'none' },
        },
      },
      { type: 'commit-set' },
    )
    expect(last.active).toBeNull()
    expect(last.sessions[0]?.finishedAt).toEqual(expect.any(String))
    expect(last.sessions[0]?.exercises[1]?.sets).toHaveLength(1)
    expect(last.sessions[0]?.exercises[0]?.sets).toHaveLength(2)
    expect(reducer(last, { type: 'undo-last-set' })).toBe(last)
  })

  it('skipping the last exercise keeps logged sets and does not invent more', () => {
    const current = loggingState()
    current.active!.exerciseIndex = 1
    current.sessions[0]!.exercises[0]!.sets = [logged('kept', 40, 8)]
    const finished = reducer(current, { type: 'skip-exercise' })
    expect(finished.active).toBeNull()
    expect(finished.sessions[0]?.finishedAt).toEqual(expect.any(String))
    expect(finished.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
    expect(finished.sessions[0]?.exercises[1]?.sets).toEqual([])
  })

  it('skipping a session with no logged sets discards it', () => {
    const current = loggingState()
    current.active!.exerciseIndex = 1
    const next = reducer(current, { type: 'skip-exercise' })
    expect(next.active).toBeNull()
    expect(next.sessions).toEqual([])
  })

  it('does not skip or start a set from the wrong phase', () => {
    const resting = reducer(loggingState(), { type: 'commit-set' })
    expect(reducer(resting, { type: 'skip-exercise' })).toBe(resting)
    const logging = reducer(resting, { type: 'start-set' })
    expect(reducer(logging, { type: 'start-set' })).toBe(logging)
    expect(logging.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
  })
})

describe('rest timer actions', () => {
  function restingAt(now: number, remainingMs: number, totalMs = 90_000) {
    const base = reducer(loggingState(), { type: 'commit-set' })
    if (!base.active) throw new Error('expected resting active')
    return {
      ...base,
      active: {
        ...base.active,
        restEndsAt: now + remainingMs,
        restTotalMs: totalMs,
      },
    }
  }

  it('expires a finished rest without logging another set', () => {
    const now = 1_000_000
    const resting = restingAt(now, 0)
    const setsBefore = resting.sessions[0]?.exercises[0]?.sets.length
    const next = reducer(resting, { type: 'expire-rest', now })
    expect(next.active?.phase).toBe('rest-over')
    expect(next.active?.restEndsAt).toBeUndefined()
    expect(next.sessions[0]?.exercises[0]?.sets).toHaveLength(setsBefore ?? 0)
    expect(reducer(next, { type: 'expire-rest', now })).toBe(next)
  })

  it('ignores expire while time remains', () => {
    const now = 1_000_000
    const resting = restingAt(now, 5_000)
    expect(reducer(resting, { type: 'expire-rest', now })).toBe(resting)
  })

  it('adjust-rest ignores rest-over and does not add sets', () => {
    const now = 1_000_000
    const over = reducer(restingAt(now, 0), { type: 'expire-rest', now })
    expect(reducer(over, { type: 'adjust-rest', deltaMs: 15_000, now })).toBe(over)
  })

  it('visible-style subtract to zero expires in one action', () => {
    const now = 2_000_000
    const resting = restingAt(now, 10_000, 90_000)
    const next = reducer(resting, { type: 'adjust-rest', deltaMs: -15_000, now })
    expect(next.active?.phase).toBe('rest-over')
    expect(next.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
  })

  it('start-set from rest-over does not add a set', () => {
    const now = 3_000_000
    const over = reducer(restingAt(now, 0), { type: 'expire-rest', now })
    const logging = reducer(over, { type: 'start-set' })
    expect(logging.active?.phase).toBe('logging')
    expect(logging.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
  })

  it('zero-duration commit stores a zero timer', () => {
    const current = loggingState()
    current.sessions[0]!.exercises[0]!.restSeconds = 0
    const next = reducer(current, { type: 'commit-set' })
    expect(next.active?.phase).toBe('resting')
    expect(next.active?.restTotalMs).toBe(0)
    expect(next.active?.restEndsAt).toEqual(expect.any(Number))
  })
})
