import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { planPersist } from './persist'
import { reducer, type Action } from './reducer'
import { repairAppData } from './repair'
import { createInitialData } from './seed'
import {
  bootFromStorage,
  currentRaw,
  DATA_KEY,
  replaceStoredData,
  tryWrite,
  writeBackupCopy,
  type BootState,
} from './storage'
import type { AppData } from './types'
import { validateAppData } from './validate'

interface RecoveryState {
  raw: string
  reason: string
}

interface StoreValue {
  data: AppData
  readBlocked: boolean
  writeFailed: boolean
  repairNotice: string | null
  conflictSnapshot: AppData | null
  recovery: RecoveryState | null
  dispatch: (action: Action) => AppData
  exportAppData: (data: AppData, filename: string) => void
  exportRaw: (raw: string) => void
  importText: (text: string) => { ok: true } | { ok: false; message: string }
  startFresh: () => { ok: true } | { ok: false; message: string }
  deleteAll: () => { ok: true } | { ok: false; message: string }
}

const StoreContext = createContext<StoreValue | null>(null)

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const bootRef = useRef<BootState | null>(null)
  if (bootRef.current === null) bootRef.current = bootFromStorage(localStorage)
  const boot = bootRef.current

  const [data, setData] = useState(boot.data)
  const [readBlocked, setReadBlocked] = useState(boot.readBlocked)
  const [writeFailed, setWriteFailed] = useState(boot.writeFailed)
  const [repairNotice, setRepairNotice] = useState<string | null>(boot.repairNotice)
  const [conflictSnapshot, setConflictSnapshot] = useState<AppData | null>(null)
  const [recovery, setRecovery] = useState<RecoveryState | null>(boot.recovery)

  const dataRef = useRef(data)
  const gateRef = useRef(boot.gate)
  const baseRawRef = useRef<string | null>(boot.baseRaw)
  const unsavedRef = useRef(false)
  dataRef.current = data

  function exportAppData(value: AppData, filename: string) {
    download(filename, `${JSON.stringify(value, null, 2)}\n`)
  }

  function exportRaw(raw: string) {
    download(`spot-raw-${Date.now()}.json`, raw)
  }

  function applyPlan(next: AppData, hasUnsavedEdits: boolean) {
    if (gateRef.current === 'recovery') return
    const read = currentRaw(localStorage)
    const plan = planPersist({
      gate: gateRef.current,
      baseRaw: baseRawRef.current,
      next,
      read,
      hasUnsavedEdits,
    })

    if (plan.type === 'noop') return

    if (plan.type === 'abort-unreadable') {
      gateRef.current = 'blocked'
      unsavedRef.current = hasUnsavedEdits
      dataRef.current = next
      setData(next)
      setReadBlocked(true)
      return
    }

    if (plan.type === 'write') {
      const raw = JSON.stringify(plan.data)
      const wrote = tryWrite(localStorage, DATA_KEY, raw)
      dataRef.current = plan.data
      setData(plan.data)
      setReadBlocked(false)
      if (!wrote.ok) {
        gateRef.current = 'ready'
        unsavedRef.current = true
        setWriteFailed(true)
        return
      }
      baseRawRef.current = raw
      gateRef.current = 'ready'
      unsavedRef.current = false
      setWriteFailed(false)
      return
    }

    if (plan.type === 'recover') {
      writeBackupCopy(localStorage, plan.raw)
      gateRef.current = 'recovery'
      unsavedRef.current = false
      setReadBlocked(false)
      setRecovery({ raw: plan.raw, reason: plan.reason })
      if (plan.unsaved) setConflictSnapshot(plan.unsaved)
      return
    }

    let baseRaw = read.status === 'ok' ? read.raw : baseRawRef.current
    if (plan.writeRepaired) {
      const raw = JSON.stringify(plan.data)
      const wrote = tryWrite(localStorage, DATA_KEY, raw)
      if (wrote.ok) baseRaw = raw
      else setWriteFailed(true)
    }
    baseRawRef.current = baseRaw
    gateRef.current = 'ready'
    unsavedRef.current = false
    dataRef.current = plan.data
    setData(plan.data)
    setReadBlocked(false)
    if (plan.repairNotice) setRepairNotice(plan.repairNotice)
    if (plan.unsaved) setConflictSnapshot(plan.unsaved)
  }

  const applyRef = useRef(applyPlan)
  applyRef.current = applyPlan

  function dispatch(action: Action): AppData {
    const next = reducer(dataRef.current, action)
    if (next === dataRef.current) return dataRef.current
    unsavedRef.current = true
    applyPlan(next, true)
    return dataRef.current
  }

  useEffect(() => {
    function onReturn() {
      if (document.visibilityState === 'hidden') return
      applyRef.current(dataRef.current, unsavedRef.current)
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [])

  function installData(next: AppData, raw: string, notice: string | null) {
    dataRef.current = next
    baseRawRef.current = raw
    gateRef.current = 'ready'
    unsavedRef.current = false
    setData(next)
    setRecovery(null)
    setReadBlocked(false)
    setWriteFailed(false)
    if (notice) setRepairNotice(notice)
  }

  function replaceAllData(next: AppData): { ok: true } | { ok: false; message: string } {
    const read = currentRaw(localStorage)
    if (read.status === 'error') {
      return { ok: false, message: "Can't read the current save, so nothing was replaced." }
    }
    const previous = read.status === 'ok' ? read.raw : null
    const replaced = replaceStoredData(localStorage, next, previous)
    if (!replaced.ok) return replaced
    installData(next, replaced.raw, null)
    return { ok: true }
  }

  function importText(text: string): { ok: true } | { ok: false; message: string } {
    const validated = validateAppData(text)
    if (!validated.ok) return { ok: false, message: validated.reason }
    const read = currentRaw(localStorage)
    if (read.status === 'error') {
      return { ok: false, message: "Can't read the current save, so nothing was replaced." }
    }
    const repaired = repairAppData(validated.data)
    const previous = read.status === 'ok' ? read.raw : null
    const replaced = replaceStoredData(localStorage, repaired.data, previous)
    if (!replaced.ok) return replaced
    installData(repaired.data, replaced.raw, repaired.notice)
    return { ok: true }
  }

  function deleteAll(): { ok: true } | { ok: false; message: string } {
    return replaceAllData(reducer(dataRef.current, { type: 'delete-all' }))
  }

  function startFresh(): { ok: true } | { ok: false; message: string } {
    return replaceAllData(createInitialData())
  }

  const value: StoreValue = {
    data,
    readBlocked,
    writeFailed,
    repairNotice,
    conflictSnapshot,
    recovery,
    dispatch,
    exportAppData,
    exportRaw,
    importText,
    startFresh,
    deleteAll,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used within StoreProvider')
  return value
}
