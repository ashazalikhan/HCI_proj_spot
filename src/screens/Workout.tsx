import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { SampleMark } from '../components/SampleMark'
import { Stepper } from '../components/Stepper'
import { ValueSheet } from '../components/ValueSheet'
import { displayWeight, repsReadout, stepReps, stepWeight, weightReadout } from '../format'
import { unfinishedSessions } from '../state/repair'
import { commitBlockReason, commitWeightAndReps, findLoggedSet } from '../state/reducer'
import { useStore } from '../state/store'
import type { LoggedSet } from '../state/types'

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function Workout() {
  const store = useStore()
  const session = unfinishedSessions(store.data)[0] ?? null
  const active = session && store.data.active?.sessionId === session.id ? store.data.active : null
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [sheet, setSheet] = useState<null | { mode: 'draft' } | { mode: 'logged'; setId: string }>(null)
  const lock = useRef(false)
  const commitRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!active) return
    if (active.phase === 'resting' || active.phase === 'rest-over') window.location.hash = '#/rest'
  }, [active])

  useEffect(() => {
    if (sheet || confirmDiscard) return
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.repeat || event.key !== 'Enter') return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('input, textarea, select, a, button')) return
      event.preventDefault()
      commitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, confirmDiscard])

  if (!session || !active) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          Workout
        </h1>
        <p>No workout in progress.</p>
        <a className="primary" href="#/today">
          Back to Today
        </a>
      </>
    )
  }

  if (active.phase !== 'logging') {
    return (
      <h1 id="screen-title" tabIndex={-1}>
        Workout
      </h1>
    )
  }

  const exercise = session.exercises[active.exerciseIndex]
  if (!exercise) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          Workout
        </h1>
        <p>This exercise is no longer in the workout.</p>
        <a className="primary" href="#/today">
          Back to Today
        </a>
      </>
    )
  }

  const unit = store.data.settings.unit
  const draft = active.draft
  const suggested = draft.source === 'previous-set' || draft.source === 'last-session' || draft.source === 'starting-target'
  const blockReason = commitBlockReason(draft.weightKg, draft.reps)
  const lastSlot =
    active.exerciseIndex === session.exercises.length - 1 && active.setIndex === exercise.targetSets - 1
  const lastFound = active.lastCommittedSetId ? findLoggedSet(session, active.lastCommittedSetId) : null
  const lastInThisExercise = lastFound?.exerciseIndex === active.exerciseIndex
  const later = session.exercises.slice(active.exerciseIndex + 1)
  const editing = sheet?.mode === 'logged' ? findLoggedSet(session, sheet.setId) : null

  function changeDraft(weightKg: number | null, reps: number | null) {
    store.dispatch({ type: 'update-draft', weightKg, reps })
  }

  function commit(event?: MouseEvent<HTMLButtonElement>) {
    if (event && event.detail > 1) return
    if (lock.current) return
    if (!commitWeightAndReps(draft.weightKg, draft.reps)) return
    lock.current = true
    const next = store.dispatch({ type: 'commit-set' })
    if (next === store.data) {
      lock.current = false
      return
    }
    window.location.hash = next.active ? '#/rest' : '#/finish'
  }

  commitRef.current = () => commit()

  function skip() {
    const next = store.dispatch({ type: 'skip-exercise' })
    if (next === store.data) return
    if (next.active) return
    const kept = next.sessions.some((item) => item.id === session.id)
    window.location.hash = kept ? '#/finish' : '#/today'
  }

  function onPrimaryKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <div className="logging">
      <p className="kicker">
        Set {active.setIndex + 1} of {exercise.targetSets}
        <span className="kicker-gap">Exercise {active.exerciseIndex + 1} of {session.exercises.length}</span>
      </p>
      <h1 id="screen-title" className="workout-title" tabIndex={-1}>
        {exercise.name}
      </h1>
      {session.isSample ? <SampleMark /> : null}
      <ul className="stack set-list" aria-label="Completed sets">
        {exercise.sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            unit={unit}
            label={
              set.id === active.lastCommittedSetId
                ? `Last set: ${displayWeight(set.weightKg, unit)} x ${set.reps}`
                : `Set ${index + 1}, logged, ${displayWeight(set.weightKg, unit)} x ${set.reps}`
            }
            onEdit={() => setSheet({ mode: 'logged', setId: set.id })}
          />
        ))}
        {lastFound && !lastInThisExercise ? (
          <SetRow
            set={lastFound.set}
            unit={unit}
            label={`Last set: ${displayWeight(lastFound.set.weightKg, unit)} x ${lastFound.set.reps}`}
            onEdit={() => setSheet({ mode: 'logged', setId: lastFound.set.id })}
          />
        ) : null}
      </ul>
      {active.lastCommittedSetId ? (
        <button className="text-button undo-set" type="button" onClick={() => store.dispatch({ type: 'undo-last-set' })}>
          Undo last set
        </button>
      ) : null}
      <div className="value-pair">
        <div>
          <p className="kicker">Weight {unit}</p>
          <Stepper
            label={`Weight ${unit}`}
            value={weightReadout(draft.weightKg, unit)}
            carried={suggested && draft.weightKg !== null}
            onStep={(direction) => changeDraft(stepWeight(draft.weightKg, direction, unit, false), draft.reps)}
            onEdit={() => setSheet({ mode: 'draft' })}
          />
        </div>
        <div>
          <p className="kicker">Reps</p>
          <Stepper
            label="Reps"
            value={repsReadout(draft.reps)}
            carried={suggested && draft.reps !== null}
            onStep={(direction) => {
              const next = stepReps(draft.reps, direction)
              if (next === draft.reps) return
              changeDraft(draft.weightKg, next)
            }}
            onEdit={() => setSheet({ mode: 'draft' })}
          />
        </div>
      </div>
      {suggested && draft.sourceLabel ? <p className="dim">{draft.sourceLabel}</p> : null}
      {later.length > 0 ? (
        <ul className="queue" aria-label="Remaining exercises">
          {later.map((item) => (
            <li key={item.routineExerciseId}>{item.name}</li>
          ))}
        </ul>
      ) : null}
      <button className="text-button" type="button" onClick={skip}>
        Skip exercise
      </button>
      {confirmDiscard ? (
        <div className="card stack">
          <p>Discard this workout? Logged sets in this workout will be removed. Other history stays.</p>
          <button
            className="danger"
            type="button"
            onClick={() => {
              store.dispatch({ type: 'discard-workout' })
              window.location.hash = '#/today'
            }}
          >
            Discard this workout
          </button>
          <button className="ghost" type="button" onClick={() => setConfirmDiscard(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="text-button" type="button" onClick={() => setConfirmDiscard(true)}>
          Discard this workout
        </button>
      )}
      <div className="thumb-dock">
        {blockReason ? (
          <p id="commit-hint" className="error">
            {blockReason}
          </p>
        ) : null}
        <button
          className="primary"
          type="button"
          disabled={blockReason !== null}
          aria-describedby={blockReason ? 'commit-hint' : undefined}
          onKeyDown={onPrimaryKeyDown}
          onClick={commit}
        >
          {lastSlot ? 'Finish workout' : 'Set done'}
        </button>
      </div>
      {sheet?.mode === 'draft' ? (
        <ValueSheet
          title="Edit weight and reps"
          unit={unit}
          mode="draft"
          weightKg={draft.weightKg}
          reps={draft.reps}
          onChange={changeDraft}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.mode === 'logged' && editing ? (
        <ValueSheet
          title="Edit set"
          unit={unit}
          mode="logged"
          weightKg={editing.set.weightKg}
          reps={editing.set.reps}
          onSave={(weightKg, reps) => store.dispatch({ type: 'edit-set', setId: editing.set.id, weightKg, reps })}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  )
}

function SetRow({
  set,
  unit,
  label,
  onEdit,
}: {
  set: LoggedSet
  unit: 'kg' | 'lb'
  label: string
  onEdit: () => void
}) {
  return (
    <li className="set-row">
      <CheckIcon />
      <span>
        <span className="sr-only">Logged </span>
        {label}
      </span>
      <button className="text-button" type="button" onClick={onEdit}>
        Edit <span className="sr-only">{displayWeight(set.weightKg, unit)} x {set.reps}</span>
      </button>
    </li>
  )
}
