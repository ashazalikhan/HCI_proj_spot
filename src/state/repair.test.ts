import { describe, expect, it } from 'vitest'
import { repairAppData } from './repair'
import { reducer } from './reducer'
import { createInitialData, defaultSettings } from './seed'
import type { ActiveState, AppData, LoggedSet, Session } from './types'

function set(weightKg: number, reps: number): LoggedSet {
  return { id: `${weightKg}`, weightKg, reps, doneAt: '2026-11-01T10:00:00.000Z' }
}

function base(): AppData {
  return {
    version: 1,
    routines: [
      {
        id: 'push',
        name: 'Push Day',
        isSample: false,
        exercises: [
          { id: 'bench', name: 'Bench Press', targetSets: 4, targetReps: 8, restSeconds: 90 },
          { id: 'row', name: 'Cable Row', targetSets: 3, targetReps: 10, restSeconds: 90, startWeightKg: 30 },
        ],
      },
    ],
    sessions: [],
    active: null,
    settings: { ...defaultSettings },
  }
}

function active(partial: Partial<ActiveState> & Pick<ActiveState, 'sessionId' | 'exerciseIndex' | 'setIndex'>): ActiveState {
  return {
    phase: 'logging',
    draft: { weightKg: 999, reps: 9, source: 'edited', sourceLabel: 'from set 1' },
    ...partial,
  }
}

describe('repairAppData', () => {
  it('leaves a null active pointer alone', () => {
    const data = base()
    const result = repairAppData(data)
    expect(result.changed).toBe(false)
    expect(result.data.active).toBeNull()
  })

  it('clears a pointer to a missing or finished session without deleting sessions', () => {
    const finished: Session = {
      id: 'done',
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
          sets: [set(60, 8)],
        },
      ],
    }
    const data = base()
    data.sessions = [finished]
    data.active = active({ sessionId: 'missing', exerciseIndex: 0, setIndex: 0 })
    const result = repairAppData(data)
    expect(result.data.active).toBeNull()
    expect(result.data.sessions).toEqual([finished])
    expect(result.notice).toMatch(/cleared/i)
  })

  it('recomputes the draft when the index moves and does not log a set', () => {
    const data = base()
    data.sessions = [
      {
        id: 'old',
        routineId: 'push',
        routineName: 'Push Day',
        isSample: false,
        startedAt: '2026-10-01T09:00:00.000Z',
        finishedAt: '2026-10-01T10:00:00.000Z',
        exercises: [
          {
            routineExerciseId: 'row',
            name: 'Cable Row',
            targetSets: 3,
            targetReps: 10,
            restSeconds: 90,
            sets: [set(40, 10)],
          },
        ],
      },
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
            targetSets: 4,
            targetReps: 8,
            restSeconds: 90,
            sets: [],
          },
          {
            routineExerciseId: 'row',
            name: 'Cable Row',
            targetSets: 3,
            targetReps: 10,
            restSeconds: 90,
            sets: [],
          },
        ],
      },
    ]
    data.active = active({ sessionId: 'open', exerciseIndex: 8, setIndex: 0 })
    const before = structuredClone(data.sessions)
    const result = repairAppData(data)
    expect(result.changed).toBe(true)
    expect(result.data.active?.exerciseIndex).toBe(1)
    expect(result.data.active?.draft.weightKg).toBe(40)
    expect(result.data.active?.draft.source).toBe('last-session')
    expect(result.data.active?.draft.weightKg).not.toBe(999)
    expect(result.data.sessions).toEqual(before)
  })

  it('keeps the draft when the cursor is already in range', () => {
    const data = base()
    data.sessions = [
      {
        id: 'open',
        routineId: 'push',
        routineName: 'Old name',
        isSample: false,
        startedAt: '2026-11-05T09:00:00.000Z',
        exercises: [
          {
            routineExerciseId: 'bench',
            name: 'Bench Press',
            targetSets: 4,
            targetReps: 8,
            restSeconds: 90,
            sets: [],
          },
        ],
      },
    ]
    data.active = active({ sessionId: 'open', exerciseIndex: 0, setIndex: 0 })
    const result = repairAppData(data)
    expect(result.changed).toBe(false)
    expect(result.data.active?.draft.weightKg).toBe(999)
  })

  it('does not choose between multiple unfinished sessions', () => {
    const data = base()
    const open = (id: string): Session => ({
      id,
      routineId: 'push',
      routineName: 'Push Day',
      isSample: false,
      startedAt: '2026-11-05T09:00:00.000Z',
      exercises: [],
    })
    data.sessions = [open('a'), open('b')]
    data.active = active({ sessionId: 'a', exerciseIndex: 0, setIndex: 0 })
    const result = repairAppData(data)
    expect(result.changed).toBe(false)
    expect(result.data.sessions).toHaveLength(2)
  })

  it('turns an expired resting timer into rest-over on boot-style repair', () => {
    const data = base()
    data.sessions = [
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
            targetSets: 4,
            targetReps: 8,
            restSeconds: 90,
            sets: [set(60, 8)],
          },
        ],
      },
    ]
    data.active = active({
      sessionId: 'open',
      exerciseIndex: 0,
      setIndex: 1,
      phase: 'resting',
      restEndsAt: Date.now() - 60_000,
      restTotalMs: 90_000,
    })
    const result = repairAppData(data)
    expect(result.changed).toBe(true)
    expect(result.notice).toBeNull()
    expect(result.data.active?.phase).toBe('rest-over')
    expect(result.data.active?.restEndsAt).toBeUndefined()
    expect(result.data.sessions[0]?.exercises[0]?.sets).toHaveLength(1)
  })

  it('leaves a future rest timer resting', () => {
    const data = base()
    data.sessions = [
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
            targetSets: 4,
            targetReps: 8,
            restSeconds: 90,
            sets: [set(60, 8)],
          },
        ],
      },
    ]
    data.active = active({
      sessionId: 'open',
      exerciseIndex: 0,
      setIndex: 1,
      phase: 'resting',
      restEndsAt: Date.now() + 60_000,
      restTotalMs: 90_000,
    })
    const result = repairAppData(data)
    expect(result.changed).toBe(false)
    expect(result.data.active?.phase).toBe('resting')
  })
})

describe('attach-active', () => {
  it('builds a fresh draft for an empty active pointer and logs nothing', () => {
    const data = base()
    data.sessions = [
      {
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
            targetSets: 4,
            targetReps: 8,
            restSeconds: 90,
            sets: [set(60, 8)],
          },
        ],
      },
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
            targetSets: 4,
            targetReps: 8,
            restSeconds: 90,
            sets: [set(62, 8)],
          },
          {
            routineExerciseId: 'row',
            name: 'Cable Row',
            targetSets: 3,
            targetReps: 10,
            restSeconds: 90,
            sets: [],
          },
        ],
      },
    ]
    const bench = data.sessions[1]?.exercises[0]
    if (bench) {
      bench.sets = [set(62, 8), set(62, 8), set(62, 8), set(62, 8)]
    }
    const next = reducer(data, { type: 'attach-active' })
    expect(next.active?.exerciseIndex).toBe(1)
    expect(next.active?.setIndex).toBe(0)
    expect(next.active?.draft).toEqual({
      weightKg: 30,
      reps: null,
      source: 'starting-target',
      sourceLabel: 'starting target',
    })
    expect(next.sessions[1]?.exercises[0]?.sets).toHaveLength(4)
    expect(next.sessions[1]?.exercises[1]?.sets).toHaveLength(0)
  })

  it('survives an empty exercise list', () => {
    const data = createInitialData()
    data.sessions = [
      {
        id: 'open',
        routineId: 'gone',
        routineName: 'Deleted day',
        isSample: false,
        startedAt: '2026-11-05T09:00:00.000Z',
        exercises: [],
      },
    ]
    const next = reducer(data, { type: 'attach-active' })
    expect(next.active?.draft.source).toBe('none')
    expect(next.sessions).toHaveLength(1)
  })
})
