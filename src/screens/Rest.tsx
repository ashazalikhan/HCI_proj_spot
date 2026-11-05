import { useCallback, useEffect, useRef, useState } from 'react'
import { ValueSheet } from '../components/ValueSheet'
import { useRestAnnounce } from '../components/RestAnnounce'
import {
  playRestTone,
  playRestVibration,
  prefersReducedMotion,
  releaseWakeLock,
  requestWakeLock,
  unlockAudioFromGesture,
} from '../cues'
import { displayWeight, formatRestCountdown, repsReadout, restNumeralEmWidth } from '../format'
import { isFreshZeroRest, restProgress, restRemainingMs, restAdjustStepMs } from '../state/rest'
import { unfinishedSessions } from '../state/repair'
import { findLoggedSet } from '../state/reducer'
import { useStore } from '../state/store'

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

const TICK_MS = 250
const GO_DELAY_MS = 2000
const RING_R = 46
const RING_C = 2 * Math.PI * RING_R

export function Rest() {
  const store = useStore()
  const announceRestEnd = useRestAnnounce()
  const session = unfinishedSessions(store.data)[0] ?? null
  const active = session && store.data.active?.sessionId === session.id ? store.data.active : null
  const [editingId, setEditingId] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [showGo, setShowGo] = useState(false)

  const sessionKeyRef = useRef<string | null>(null)
  const goTimeoutRef = useRef<number | null>(null)
  const visibleChainRef = useRef(typeof document !== 'undefined' && document.visibilityState === 'visible')
  const hadPositiveVisibleRef = useRef(false)
  const goCueKeyRef = useRef<string | null>(null)
  const goPendingRef = useRef(false)
  const expiryHandledRef = useRef(false)

  const clearGoTimeout = useCallback(() => {
    if (goTimeoutRef.current !== null) {
      window.clearTimeout(goTimeoutRef.current)
      goTimeoutRef.current = null
    }
    goPendingRef.current = false
  }, [])

  const cancelAutoNavigation = useCallback(() => {
    clearGoTimeout()
    setShowGo(false)
  }, [clearGoTimeout])

  const navigateToWorkout = useCallback(() => {
    const key = sessionKeyRef.current
    if (!key || store.data.active?.sessionId !== key) return
    const next = store.dispatch({ type: 'start-set' })
    if (next.active?.phase === 'logging') window.location.hash = '#/workout'
  }, [store])

  const calmExpire = useCallback(
    (now: number) => {
      if (store.data.active?.phase !== 'resting') return
      store.dispatch({ type: 'expire-rest', now })
    },
    [store],
  )

  const shouldArmGo = useCallback(
    (now: number, forActive: { phase: string; restTotalMs?: number; restEndsAt?: number } | null) => {
      if (document.visibilityState !== 'visible' || !visibleChainRef.current) return false
      if (editingId) return false
      if (!forActive || forActive.phase !== 'resting') return false
      return hadPositiveVisibleRef.current || isFreshZeroRest(forActive, now)
    },
    [editingId],
  )

  const playGoCuesOnce = useCallback(
    (cueKey: string, exerciseName: string, setNumber: number) => {
      if (goCueKeyRef.current === cueKey) return
      goCueKeyRef.current = cueKey
      playRestTone(store.data.settings)
      playRestVibration(store.data.settings)
      announceRestEnd(`Rest over, next: ${exerciseName} set ${setNumber}`)
    },
    [announceRestEnd, store.data.settings],
  )

  const scheduleGoNavigation = useCallback(() => {
    clearGoTimeout()
    const key = sessionKeyRef.current
    if (!key) return
    const reduced = prefersReducedMotion(store.data.settings)
    if (reduced) {
      navigateToWorkout()
      return
    }
    goPendingRef.current = true
    goTimeoutRef.current = window.setTimeout(() => {
      goTimeoutRef.current = null
      goPendingRef.current = false
      if (sessionKeyRef.current !== key) return
      if (store.data.active?.sessionId !== key) return
      if (window.location.hash.replace(/^#\/?/, '').split('/')[0] !== 'rest') return
      navigateToWorkout()
    }, GO_DELAY_MS)
  }, [clearGoTimeout, navigateToWorkout, store.data.active?.sessionId, store.data.settings])

  const beginGoPresentation = useCallback(
    (exerciseName: string, setNumber: number) => {
      if (editingId) return
      setShowGo(true)
      const cueKey = `${sessionKeyRef.current ?? ''}-${store.data.active?.lastCommittedSetId ?? ''}`
      playGoCuesOnce(cueKey, exerciseName, setNumber)
      scheduleGoNavigation()
    },
    [editingId, playGoCuesOnce, scheduleGoNavigation, store.data.active?.lastCommittedSetId],
  )

  const handleExpiry = useCallback(
    (now: number, exerciseName: string, setNumber: number) => {
      if (expiryHandledRef.current) return
      const current = store.data.active
      if (!current || current.phase !== 'resting') return
      expiryHandledRef.current = true
      if (editingId) {
        calmExpire(now)
        return
      }
      if (shouldArmGo(now, current)) {
        store.dispatch({ type: 'expire-rest', now })
        beginGoPresentation(exerciseName, setNumber)
      } else {
        calmExpire(now)
      }
    },
    [beginGoPresentation, calmExpire, editingId, shouldArmGo, store],
  )

  useEffect(() => {
    function unlock() {
      unlockAudioFromGesture()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!session || !active) return
    if (active.phase === 'logging') window.location.hash = '#/workout'
  }, [session, active])

  useEffect(() => {
    sessionKeyRef.current = session?.id ?? null
    goCueKeyRef.current = null
    expiryHandledRef.current = false
    setShowGo(false)
    clearGoTimeout()
    hadPositiveVisibleRef.current = false
    visibleChainRef.current = document.visibilityState === 'visible'
  }, [session?.id, active?.exerciseIndex, active?.setIndex, active?.lastCommittedSetId, clearGoTimeout])

  useEffect(() => {
    if (editingId) cancelAutoNavigation()
  }, [editingId, cancelAutoNavigation])

  useEffect(() => {
    if (!active || active.phase !== 'resting' || !session) {
      void releaseWakeLock()
      return
    }
    const settings = store.data.settings
    if (!settings.keepScreenAwake) {
      void releaseWakeLock()
      return
    }
    void requestWakeLock(session.id)
    return () => {
      void releaseWakeLock()
    }
  }, [active?.phase, session?.id, store.data.settings.keepScreenAwake, active, session])

  useEffect(() => {
    if (active?.phase === 'resting') expiryHandledRef.current = false
  }, [active?.restEndsAt, active?.restTotalMs, active?.phase])

  useEffect(() => {
    if (!active || active.phase !== 'resting' || !session) return

    const exercise = session.exercises[active.exerciseIndex]
    const setNumber = exercise
      ? Math.min(active.setIndex, Math.max(exercise.targetSets - 1, 0)) + 1
      : 1
    const exerciseName = exercise?.name ?? 'Next exercise'

    function tick() {
      const now = Date.now()
      const current = store.data.active
      if (!current || current.phase !== 'resting' || current.sessionId !== session.id) return
      const remaining = restRemainingMs(current.restEndsAt, now)
      setRemainingMs(remaining)
      if (document.visibilityState === 'visible' && visibleChainRef.current) {
        if (remaining > 0) hadPositiveVisibleRef.current = true
        if (remaining === 0) handleExpiry(now, exerciseName, setNumber)
      }
    }

    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [active?.phase, active?.restEndsAt, active?.restTotalMs, session, store, handleExpiry])

  useEffect(() => {
    if (!active || active.phase !== 'resting' || !session) return
    const now = Date.now()
    const remaining = restRemainingMs(active.restEndsAt, now)
    setRemainingMs(remaining)
    if (remaining > 0) return
    if (expiryHandledRef.current) return
    if (isFreshZeroRest(active, now) && document.visibilityState === 'visible' && !editingId) {
      expiryHandledRef.current = true
      const exercise = session.exercises[active.exerciseIndex]
      const setNumber = exercise
        ? Math.min(active.setIndex, Math.max(exercise.targetSets - 1, 0)) + 1
        : 1
      store.dispatch({ type: 'expire-rest', now })
      beginGoPresentation(exercise?.name ?? 'Next exercise', setNumber)
      return
    }
    if (!isFreshZeroRest(active, now)) {
      expiryHandledRef.current = true
      calmExpire(now)
    }
  }, [active, session, editingId, store, beginGoPresentation, calmExpire])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        visibleChainRef.current = false
        hadPositiveVisibleRef.current = false
        cancelAutoNavigation()
        return
      }
      visibleChainRef.current = true
      hadPositiveVisibleRef.current = false
      const current = store.data.active
      if (!current || current.phase !== 'resting' || !session) return
      const now = Date.now()
      const remaining = restRemainingMs(current.restEndsAt, now)
      setRemainingMs(remaining)
      if (remaining === 0 && !isFreshZeroRest(current, now)) {
        calmExpire(now)
      }
      if (store.data.settings.keepScreenAwake) void requestWakeLock(session.id)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [calmExpire, cancelAutoNavigation, session, store])

  useEffect(() => {
    return () => {
      clearGoTimeout()
      void releaseWakeLock()
    }
  }, [clearGoTimeout])

  if (!session || !active || (active.phase !== 'resting' && active.phase !== 'rest-over')) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          Rest
        </h1>
        <p>No rest in progress.</p>
        <a className="primary" href="#/today">
          Back to Today
        </a>
      </>
    )
  }

  const exercise = session.exercises[active.exerciseIndex]
  const unit = store.data.settings.unit
  const setNumber = exercise ? Math.min(active.setIndex, Math.max(exercise.targetSets - 1, 0)) + 1 : 1
  const weightText =
    active.draft.weightKg === null || !Number.isFinite(active.draft.weightKg)
      ? '--'
      : displayWeight(active.draft.weightKg, unit)
  const preview = exercise
    ? `Next: ${exercise.name} - Set ${setNumber} of ${exercise.targetSets} - ${weightText} x ${repsReadout(active.draft.reps)}`
    : 'Next set'
  const last = active.lastCommittedSetId ? findLoggedSet(session, active.lastCommittedSetId) : null
  const isCalmOver = active.phase === 'rest-over' && !showGo
  const progress = restProgress(active.restTotalMs, remainingMs)
  const ringOffset = RING_C * (1 - progress)
  const adjustStep = restAdjustStepMs()
  const canAdjust = active.phase === 'resting'
  const restDisplay = showGo
    ? 'Go'
    : formatRestCountdown(active.phase === 'rest-over' && !showGo ? 0 : remainingMs)
  const restEmWidth = restNumeralEmWidth(restDisplay)

  function adjustRest(deltaMs: number) {
    cancelAutoNavigation()
    const now = Date.now()
    const before = store.data.active
    if (!before || before.phase !== 'resting') return
    const arm = shouldArmGo(now, before)
    const next = store.dispatch({ type: 'adjust-rest', deltaMs, now })
    if (next.active?.phase === 'rest-over' && !editingId && arm) {
      expiryHandledRef.current = true
      beginGoPresentation(exercise?.name ?? 'Next exercise', setNumber)
    } else if (next.active?.phase === 'rest-over') {
      expiryHandledRef.current = true
    }
  }

  function skipRest() {
    cancelAutoNavigation()
    const next = store.dispatch({ type: 'start-set' })
    if (next.active?.phase === 'logging') window.location.hash = '#/workout'
  }

  function undoLast() {
    cancelAutoNavigation()
    store.dispatch({ type: 'undo-last-set' })
    window.location.hash = '#/workout'
  }

  return (
    <div className="rest-screen">
      <h1 id="screen-title" tabIndex={-1}>
        {isCalmOver ? 'Rest over' : 'Rest'}
      </h1>
      {!isCalmOver ? (
        <p className="rest-label" aria-hidden="true">
          REST
        </p>
      ) : null}
      {isCalmOver ? (
        <p className="rest-over-line">
          Rest over — Set {setNumber} of {exercise?.targetSets ?? setNumber}
        </p>
      ) : null}
      <div className="rest-hero">
        <svg className="rest-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="rest-ring-track" cx="50" cy="50" r={RING_R} />
          <circle
            className="rest-ring-progress"
            cx="50"
            cy="50"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={ringOffset}
          />
        </svg>
        <p
          className="rest-numerals num"
          aria-hidden="true"
          style={{ ['--rest-em-width' as string]: restEmWidth }}
        >
          {restDisplay}
        </p>
      </div>
      <p className="rest-next">{preview}</p>
      {last ? (
        <div className="set-row rest-last-set">
          <CheckIcon />
          <span>
            Last set: {displayWeight(last.set.weightKg, unit)} x {last.set.reps}
          </span>
          <button className="text-button" type="button" onClick={() => setEditingId(last.set.id)}>
            Edit
          </button>
        </div>
      ) : null}
      {active.lastCommittedSetId ? (
        <button className="text-button undo-set" type="button" onClick={undoLast}>
          Undo last set
        </button>
      ) : null}
      <div className="rest-dock">
        {isCalmOver ? (
          <button className="primary" type="button" onClick={skipRest}>
            Start set {setNumber}
          </button>
        ) : showGo ? null : (
          <>
            <div className="rest-adjust-row">
              <button
                className="outline-button"
                type="button"
                disabled={!canAdjust}
                aria-label="Subtract 15 seconds"
                onClick={() => adjustRest(-adjustStep)}
              >
                −15s
              </button>
              <button
                className="outline-button"
                type="button"
                disabled={!canAdjust}
                aria-label="Add 15 seconds"
                onClick={() => adjustRest(adjustStep)}
              >
                +15s
              </button>
              <button className="outline-button" type="button" aria-label="Skip rest" onClick={skipRest}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>
      {editingId && last && editingId === last.set.id ? (
        <ValueSheet
          title="Edit set"
          unit={unit}
          mode="logged"
          weightKg={last.set.weightKg}
          reps={last.set.reps}
          onSave={(weightKg, reps) => store.dispatch({ type: 'edit-set', setId: last.set.id, weightKg, reps })}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </div>
  )
}
