import { describe, expect, it } from 'vitest'
import { displayWeight, lbInputToKg } from '../format'
import { planPersist } from './persist'
import { createMemoryStorage } from './memory'
import { reducer } from './reducer'
import { createInitialData, defaultSettings } from './seed'
import { bootFromStorage, DATA_KEY, replaceStoredData, writeBackupCopy } from './storage'
import type { AppData } from './types'
import { validateAppData } from './validate'

function saved(name = 'Saved Day'): AppData {
  return {
    version: 1,
    routines: [{ id: 'day', name, isSample: false, exercises: [] }],
    sessions: [],
    active: null,
    settings: { ...defaultSettings },
  }
}

describe('bootFromStorage', () => {
  it('treats a missing key as first run and saves the seed', () => {
    const storage = createMemoryStorage()
    const boot = bootFromStorage(storage)
    expect(boot.gate).toBe('ready')
    expect(boot.data.routines.some((routine) => routine.isSample)).toBe(true)
    expect(storage.snapshot()[DATA_KEY]).toBe(JSON.stringify(boot.data))
  })

  it('does not write when getItem throws', () => {
    const storage = createMemoryStorage({ throwOnGet: true })
    const boot = bootFromStorage(storage)
    expect(boot.gate).toBe('blocked')
    expect(boot.readBlocked).toBe(true)
    expect(boot.recovery).toBeNull()
    expect(storage.setCount()).toBe(0)
  })

  it('does not overwrite corrupt or unknown-version data', () => {
    const corrupt = '{not json'
    const storage = createMemoryStorage({
      initial: { [DATA_KEY]: corrupt, 'spot.v1.backup': 'keep-me' },
    })
    const boot = bootFromStorage(storage)
    expect(boot.gate).toBe('recovery')
    expect(boot.recovery?.raw).toBe(corrupt)
    expect(storage.snapshot()[DATA_KEY]).toBe(corrupt)
    expect(storage.snapshot()['spot.v1.backup']).toBe('keep-me')
    const copies = Object.entries(storage.snapshot()).filter(([key, value]) => key.startsWith('spot.v1.backup.') && value === corrupt)
    expect(copies).toHaveLength(1)
  })

  it('sends multiple unfinished sessions to recovery without deleting them', () => {
    const raw = JSON.stringify({
      ...saved(),
      sessions: [
        {
          id: 'a',
          routineId: 'day',
          routineName: 'Saved Day',
          isSample: false,
          startedAt: '2026-11-05T09:00:00.000Z',
          exercises: [],
        },
        {
          id: 'b',
          routineId: 'day',
          routineName: 'Saved Day',
          isSample: false,
          startedAt: '2026-11-05T09:05:00.000Z',
          exercises: [],
        },
      ],
    })
    const storage = createMemoryStorage({ initial: { [DATA_KEY]: raw } })
    const boot = bootFromStorage(storage)
    expect(boot.recovery?.reason).toMatch(/More than one unfinished/)
    expect(storage.snapshot()[DATA_KEY]).toBe(raw)
  })

  it('rejects a bad phase instead of guessing', () => {
    const data = saved()
    const raw = JSON.stringify({
      ...data,
      active: {
        sessionId: 'none',
        exerciseIndex: 0,
        setIndex: 0,
        phase: 'nope',
        draft: { weightKg: null, reps: null, source: 'none' },
      },
    })
    const storage = createMemoryStorage({ initial: { [DATA_KEY]: raw } })
    const boot = bootFromStorage(storage)
    expect(boot.gate).toBe('recovery')
    expect(storage.snapshot()[DATA_KEY]).toBe(raw)
  })
})

describe('planPersist', () => {
  it('writes after a confirmed empty key', () => {
    const next = saved('Memory')
    const plan = planPersist({
      gate: 'blocked',
      baseRaw: null,
      next,
      read: { status: 'missing' },
      hasUnsavedEdits: true,
    })
    expect(plan).toEqual({ type: 'write', data: next })
  })

  it('keeps an exportable snapshot and adopts stored data without merging', () => {
    const stored = saved('Saved Day')
    const edited = reducer(stored, { type: 'add-routine', name: 'Unsaved Day' })
    const plan = planPersist({
      gate: 'blocked',
      baseRaw: null,
      next: edited,
      read: { status: 'ok', raw: JSON.stringify(stored) },
      hasUnsavedEdits: true,
    })
    expect(plan.type).toBe('adopt')
    if (plan.type !== 'adopt') return
    expect(plan.unsaved?.routines.map((routine) => routine.name)).toContain('Unsaved Day')
    expect(plan.data.routines.map((routine) => routine.name)).toEqual(['Saved Day'])
    expect(plan.writeRepaired).toBe(false)
  })

  it('does not write when the key still cannot be read', () => {
    expect(
      planPersist({
        gate: 'ready',
        baseRaw: '{}',
        next: saved(),
        read: { status: 'error' },
        hasUnsavedEdits: true,
      }),
    ).toEqual({ type: 'abort-unreadable' })
  })
})

describe('backups and import', () => {
  it('does not replace an existing backup with different bytes', () => {
    const storage = createMemoryStorage({ initial: { 'spot.v1.backup.existing': 'old' } })
    const first = writeBackupCopy(storage, 'old')
    const second = writeBackupCopy(storage, 'new')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(storage.snapshot()['spot.v1.backup.existing']).toBe('old')
    expect(Object.values(storage.snapshot())).toContain('new')
  })

  it('removes only the backup created for a successful import', () => {
    const previous = saved('Previous')
    const next = saved('Next')
    const storage = createMemoryStorage({
      initial: {
        [DATA_KEY]: JSON.stringify(previous),
        'spot.v1.backup.unrelated': 'leave-this',
      },
    })
    const replaced = replaceStoredData(storage, next, JSON.stringify(previous))
    expect(replaced.ok).toBe(true)
    expect(JSON.parse(storage.snapshot()[DATA_KEY] ?? '')).toMatchObject({ routines: [{ name: 'Next' }] })
    expect(storage.snapshot()['spot.v1.backup.unrelated']).toBe('leave-this')
    const leftovers = Object.entries(storage.snapshot()).filter(([, value]) => value === JSON.stringify(previous))
    expect(leftovers).toEqual([])
  })
})

describe('units', () => {
  it('round-trips a typed pound value through kilograms', () => {
    const kg = lbInputToKg(135)
    expect(kg).toBe(Math.round((135 / 2.20462262) * 10000) / 10000)
    expect(displayWeight(kg, 'lb')).toBe('135.0 lb')
  })
})

describe('import validation', () => {
  it('does not write when JSON is invalid', () => {
    const storage = createMemoryStorage({ initial: { [DATA_KEY]: JSON.stringify(saved()) } })
    const before = storage.snapshot()[DATA_KEY]
    const validated = validateAppData('{not json')
    expect(validated.ok).toBe(false)
    expect(storage.snapshot()[DATA_KEY]).toBe(before)
  })
})

describe('replaceStoredData failure', () => {
  it('restores spot.v1 when the new write fails after backup', () => {
    const previous = saved('Previous')
    const next = saved('Next')
    const prevRaw = JSON.stringify(previous)
    const nextRaw = JSON.stringify(next)
    const storage = createMemoryStorage({
      initial: {
        [DATA_KEY]: prevRaw,
        'spot.v1.backup.unrelated': 'leave-this',
      },
    })
    const baseSet = storage.setItem.bind(storage)
    storage.setItem = (key: string, value: string) => {
      if (key === DATA_KEY && value === nextRaw) throw new Error('quota')
      baseSet(key, value)
    }
    const result = replaceStoredData(storage, next, prevRaw)
    expect(result.ok).toBe(false)
    expect(storage.snapshot()[DATA_KEY]).toBe(prevRaw)
    expect(storage.snapshot()['spot.v1.backup.unrelated']).toBe('leave-this')
  })
})

describe('seed', () => {
  it('starts from the labeled sample day', () => {
    const data = createInitialData()
    expect(data.version).toBe(1)
    expect(data.active).toBeNull()
    expect(data.routines.filter((routine) => routine.isSample)).toHaveLength(1)
    expect(data.sessions).toEqual([])
  })
})
