import { useEffect, useState } from 'react'
import { ValueSheet } from '../components/ValueSheet'
import { displayWeight, repsReadout } from '../format'
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

export function Rest() {
  const store = useStore()
  const session = unfinishedSessions(store.data)[0] ?? null
  const active = session && store.data.active?.sessionId === session.id ? store.data.active : null
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !active) return
    if (active.phase === 'logging') window.location.hash = '#/workout'
  }, [session, active])

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
  const continueLabel = active.phase === 'rest-over' ? `Start set ${setNumber}` : 'Continue to next set'

  return (
    <div className="logging">
      <h1 id="screen-title" tabIndex={-1}>
        Rest
      </h1>
      <p>Rest arrives in step 3.</p>
      {active.phase === 'rest-over' ? <p>Rest over.</p> : null}
      <p>{preview}</p>
      {last ? (
        <div className="set-row">
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
        <button
          className="text-button undo-set"
          type="button"
          onClick={() => {
            store.dispatch({ type: 'undo-last-set' })
            window.location.hash = '#/workout'
          }}
        >
          Undo last set
        </button>
      ) : null}
      <div className="thumb-dock">
        <button
          className="primary"
          type="button"
          onClick={() => {
            const next = store.dispatch({ type: 'start-set' })
            if (next.active?.phase === 'logging') window.location.hash = '#/workout'
          }}
        >
          {continueLabel}
        </button>
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
