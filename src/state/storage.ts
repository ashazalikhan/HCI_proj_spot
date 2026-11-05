import type { ReadResult } from './persist'
import { repairAppData } from './repair'
import { createInitialData } from './seed'
import type { AppData } from './types'
import { validateAppData } from './validate'

export const DATA_KEY = 'spot.v1'
export const BACKUP_PREFIX = 'spot.v1.backup.'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

export interface BootState {
  data: AppData
  gate: 'ready' | 'blocked' | 'recovery'
  baseRaw: string | null
  readBlocked: boolean
  writeFailed: boolean
  repairNotice: string | null
  recovery: { raw: string; reason: string } | null
}

export function readKey(storage: KeyValueStore, key: string): ReadResult {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return { status: 'missing' }
    return { status: 'ok', raw }
  } catch {
    return { status: 'error' }
  }
}

export function tryWrite(
  storage: KeyValueStore,
  key: string,
  value: string,
): { ok: true } | { ok: false } {
  try {
    storage.setItem(key, value)
  } catch {
    return { ok: false }
  }
  const back = readKey(storage, key)
  if (back.status !== 'ok' || back.raw !== value) return { ok: false }
  return { ok: true }
}

export function tryRemove(storage: KeyValueStore, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    /* leaving a backup in place is safe */
  }
}

function listKeys(storage: KeyValueStore): string[] {
  const keys: string[] = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key) keys.push(key)
    }
  } catch {
    return keys
  }
  return keys
}

/** Write raw bytes to a new timestamped key. Never replace an existing backup with different bytes. */
export function writeBackupCopy(
  storage: KeyValueStore,
  raw: string,
): { ok: true; key: string | null } | { ok: false; key: null } {
  for (const key of listKeys(storage)) {
    if (!key.startsWith(BACKUP_PREFIX) && key !== 'spot.v1.backup') continue
    const existing = readKey(storage, key)
    if (existing.status === 'ok' && existing.raw === raw) return { ok: true, key: null }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const key = `${BACKUP_PREFIX}${stamp}-${attempt}`
    const existing = readKey(storage, key)
    if (existing.status === 'error') return { ok: false, key: null }
    if (existing.status === 'ok') {
      if (existing.raw === raw) return { ok: true, key: null }
      continue
    }
    const wrote = tryWrite(storage, key, raw)
    if (wrote.ok) return { ok: true, key }
  }
  return { ok: false, key: null }
}

export function bootFromStorage(storage: KeyValueStore): BootState {
  const read = readKey(storage, DATA_KEY)
  if (read.status === 'error') {
    return {
      data: createInitialData(),
      gate: 'blocked',
      baseRaw: null,
      readBlocked: true,
      writeFailed: false,
      repairNotice: null,
      recovery: null,
    }
  }
  if (read.status === 'missing') {
    const data = createInitialData()
    const raw = JSON.stringify(data)
    const wrote = tryWrite(storage, DATA_KEY, raw)
    return {
      data,
      gate: 'ready',
      baseRaw: wrote.ok ? raw : null,
      readBlocked: false,
      writeFailed: !wrote.ok,
      repairNotice: null,
      recovery: null,
    }
  }

  const validated = validateAppData(read.raw)
  if (!validated.ok) {
    writeBackupCopy(storage, read.raw)
    return {
      data: createInitialData(),
      gate: 'recovery',
      baseRaw: null,
      readBlocked: false,
      writeFailed: false,
      repairNotice: null,
      recovery: { raw: read.raw, reason: validated.reason },
    }
  }

  const repaired = repairAppData(validated.data)
  let baseRaw = read.raw
  let writeFailed = false
  if (repaired.changed) {
    const raw = JSON.stringify(repaired.data)
    const wrote = tryWrite(storage, DATA_KEY, raw)
    if (wrote.ok) baseRaw = raw
    else writeFailed = true
  }
  return {
    data: repaired.data,
    gate: 'ready',
    baseRaw,
    readBlocked: false,
    writeFailed,
    repairNotice: repaired.notice,
    recovery: null,
  }
}

export function replaceStoredData(
  storage: KeyValueStore,
  next: AppData,
  previousRaw: string | null,
): { ok: true; raw: string } | { ok: false; message: string } {
  let backupKey: string | null = null
  if (previousRaw !== null) {
    const backup = writeBackupCopy(storage, previousRaw)
    if (!backup.ok) {
      return {
        ok: false,
        message: "Couldn't store a backup of the existing data, so it was left untouched.",
      }
    }
    backupKey = backup.key
  }

  const raw = JSON.stringify(next)
  const wrote = tryWrite(storage, DATA_KEY, raw)
  if (!wrote.ok) {
    if (previousRaw !== null) tryWrite(storage, DATA_KEY, previousRaw)
    return { ok: false, message: "The new data didn't save. Existing data was left in place." }
  }
  if (backupKey) tryRemove(storage, backupKey)
  return { ok: true, raw }
}

export function currentRaw(storage: KeyValueStore): ReadResult {
  return readKey(storage, DATA_KEY)
}
