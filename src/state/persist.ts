import { repairAppData } from './repair'
import type { AppData } from './types'
import { validateAppData } from './validate'

export type ReadResult =
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ok'; raw: string }

export type Gate = 'ready' | 'blocked' | 'recovery'

export type PersistPlan =
  | { type: 'noop' }
  | { type: 'write'; data: AppData }
  | { type: 'abort-unreadable' }
  | {
      type: 'adopt'
      data: AppData
      unsaved: AppData | null
      repairNotice: string | null
      writeRepaired: boolean
      baseRaw: string
    }
  | { type: 'recover'; raw: string; reason: string; unsaved: AppData | null }

export function planPersist(input: {
  gate: Gate
  baseRaw: string | null
  next: AppData
  read: ReadResult
  hasUnsavedEdits: boolean
}): PersistPlan {
  if (input.gate === 'recovery') return { type: 'noop' }
  if (input.read.status === 'error') return { type: 'abort-unreadable' }
  if (input.read.status === 'missing') return { type: 'write', data: input.next }

  const validated = validateAppData(input.read.raw)
  if (!validated.ok) {
    return {
      type: 'recover',
      raw: input.read.raw,
      reason: validated.reason,
      unsaved: input.hasUnsavedEdits ? input.next : null,
    }
  }

  const repaired = repairAppData(validated.data)
  const storedMatchesBase = input.baseRaw !== null && input.read.raw === input.baseRaw
  if (input.gate === 'ready' && storedMatchesBase) {
    if (!input.hasUnsavedEdits) return { type: 'noop' }
    return { type: 'write', data: input.next }
  }

  if (deepEqual(repaired.data, input.next)) {
    return {
      type: 'adopt',
      data: repaired.data,
      unsaved: null,
      repairNotice: repaired.notice,
      writeRepaired: repaired.changed,
      baseRaw: repaired.changed ? JSON.stringify(repaired.data) : input.read.raw,
    }
  }

  return {
    type: 'adopt',
    data: repaired.data,
    unsaved: input.hasUnsavedEdits ? input.next : null,
    repairNotice: repaired.notice,
    writeRepaired: repaired.changed,
    baseRaw: repaired.changed ? JSON.stringify(repaired.data) : input.read.raw,
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const aKeys = Object.keys(aRecord)
  if (aKeys.length !== Object.keys(bRecord).length) return false
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bRecord, key) && deepEqual(aRecord[key], bRecord[key]),
  )
}
