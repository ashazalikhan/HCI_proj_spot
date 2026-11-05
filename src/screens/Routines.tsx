import { useState } from 'react'
import { SampleMark } from '../components/SampleMark'
import { useStore } from '../state/store'
import type { Routine } from '../state/types'

export function Routines() {
  const store = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = store.data.routines.find((routine) => routine.id === editingId) ?? null

  if (!editing) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          Routines
        </h1>
        {store.data.routines.length === 0 ? (
          <div className="stack">
            <p>Create a day, then add the exercises you already do.</p>
            <AddDay
              onAdd={(name) => store.dispatch({ type: 'add-routine', name })}
              label="Create my first day"
            />
            <button className="ghost" type="button" onClick={() => store.dispatch({ type: 'add-sample' })}>
              Use the sample day
            </button>
          </div>
        ) : (
          <div className="stack">
            <AddDay onAdd={(name) => store.dispatch({ type: 'add-routine', name })} label="Add day" />
            {store.data.routines.map((routine) => (
              <button key={routine.id} className="row" type="button" onClick={() => setEditingId(routine.id)}>
                <span className="ex-name">{routine.name}</span>
                {routine.isSample ? <SampleMark /> : null}
                <span className="ex-meta num">
                  {routine.exercises.length === 0
                    ? 'No exercises'
                    : `${routine.exercises.length} exercises`}
                </span>
              </button>
            ))}
            {store.data.routines.some((routine) => routine.isSample) ? null : (
              <button className="text-button" type="button" onClick={() => store.dispatch({ type: 'add-sample' })}>
                Use the sample day
              </button>
            )}
          </div>
        )}
      </>
    )
  }

  return <RoutineEditor routine={editing} onBack={() => setEditingId(null)} />
}

function AddDay({ onAdd, label }: { onAdd: (name: string) => void; label: string }) {
  const [name, setName] = useState('')
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        onAdd(name)
        setName('')
      }}
    >
      <label className="field">
        <span>Day name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <button className="primary" type="submit">
        {label}
      </button>
    </form>
  )
}

function RoutineEditor({ routine, onBack }: { routine: Routine; onBack: () => void }) {
  const store = useStore()
  const [name, setName] = useState(routine.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exerciseName, setExerciseName] = useState('')
  const [targetSets, setTargetSets] = useState('3')
  const [targetReps, setTargetReps] = useState('8')
  const [restSeconds, setRestSeconds] = useState('90')
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <>
      <button className="text-button" type="button" onClick={onBack}>
        All days
      </button>
      <h1 id="screen-title" tabIndex={-1}>
        {routine.name}
      </h1>
      {routine.isSample ? (
        <p className="dim">
          <SampleMark /> try it, edit it, delete it.
        </p>
      ) : null}
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          store.dispatch({ type: 'rename-routine', routineId: routine.id, name })
        }}
      >
        <label className="field">
          <span>Day name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button className="ghost" type="submit">
          Save name
        </button>
      </form>
      <ul className="stack" style={{ listStyle: 'none', margin: '24px 0', padding: 0 }}>
        {routine.exercises.map((exercise) => (
          <ExerciseRow key={exercise.id} routineId={routine.id} exerciseId={exercise.id} />
        ))}
      </ul>
      <form
        className="card stack"
        onSubmit={(event) => {
          event.preventDefault()
          const sets = wholeNumber(targetSets, 1, 20)
          const reps = wholeNumber(targetReps, 1, 100)
          const rest = wholeNumber(restSeconds, 0, 600)
          if (sets === null || reps === null || rest === null) {
            setFormError('Use whole numbers: sets 1–20, reps 1–100, rest 0–600 seconds.')
            return
          }
          setFormError(null)
          store.dispatch({
            type: 'add-exercise',
            routineId: routine.id,
            name: exerciseName,
            targetSets: sets,
            targetReps: reps,
            restSeconds: rest,
          })
          setExerciseName('')
          setTargetSets('3')
          setTargetReps('8')
          setRestSeconds('90')
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17 }}>Add exercise</h2>
        <label className="field">
          <span>Name</span>
          <input value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} required />
        </label>
        <div className="grid-3">
          <NumberField label="Sets" value={targetSets} onChange={setTargetSets} min={1} max={20} />
          <NumberField label="Reps" value={targetReps} onChange={setTargetReps} min={1} max={100} />
          <NumberField label="Rest (sec)" value={restSeconds} onChange={setRestSeconds} min={0} max={600} />
        </div>
        {formError ? <p className="error">{formError}</p> : null}
        <button className="primary" type="submit">
          Add exercise
        </button>
      </form>
      <div className="dock">
        {confirmDelete ? (
          <div className="card stack">
            <p>
              {routine.isSample
                ? 'Delete this sample day? Its SAMPLE sessions are deleted with it.'
                : 'Delete this day? Past sessions are kept.'}
            </p>
            <button
              className="danger"
              type="button"
              onClick={() => {
                store.dispatch({ type: 'delete-routine', routineId: routine.id })
                onBack()
              }}
            >
              Delete day
            </button>
            <button className="ghost" type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="danger" type="button" onClick={() => setConfirmDelete(true)}>
            Delete day
          </button>
        )}
      </div>
    </>
  )
}

function ExerciseRow({ routineId, exerciseId }: { routineId: string; exerciseId: string }) {
  const store = useStore()
  const routine = store.data.routines.find((item) => item.id === routineId)
  const exercise = routine?.exercises.find((item) => item.id === exerciseId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(exercise?.name ?? '')
  const [targetSets, setTargetSets] = useState(String(exercise?.targetSets ?? 3))
  const [targetReps, setTargetReps] = useState(String(exercise?.targetReps ?? 8))
  const [restSeconds, setRestSeconds] = useState(String(exercise?.restSeconds ?? 90))
  const [formError, setFormError] = useState<string | null>(null)
  if (!exercise) return null

  return (
    <li className="card stack">
      <span className="ex-name">{exercise.name}</span>
      <span className="ex-meta num">
        {exercise.targetSets} sets · {exercise.targetReps} reps · {exercise.restSeconds}s rest
      </span>
      <div className="actions">
        <button className="ghost" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close' : 'Edit'}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => store.dispatch({ type: 'delete-exercise', routineId, exerciseId })}
        >
          Delete exercise
        </button>
      </div>
      {open ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault()
            const sets = wholeNumber(targetSets, 1, 20)
            const reps = wholeNumber(targetReps, 1, 100)
            const rest = wholeNumber(restSeconds, 0, 600)
            if (sets === null || reps === null || rest === null) {
              setFormError('Use whole numbers: sets 1–20, reps 1–100, rest 0–600 seconds.')
              return
            }
            setFormError(null)
            store.dispatch({
              type: 'update-exercise',
              routineId,
              exerciseId,
              name,
              targetSets: sets,
              targetReps: reps,
              restSeconds: rest,
            })
            setOpen(false)
          }}
        >
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <div className="grid-3">
            <NumberField label="Sets" value={targetSets} onChange={setTargetSets} min={1} max={20} />
            <NumberField label="Reps" value={targetReps} onChange={setTargetReps} min={1} max={100} />
            <NumberField label="Rest (sec)" value={restSeconds} onChange={setRestSeconds} min={0} max={600} />
          </div>
          {formError ? <p className="error">{formError}</p> : null}
          <button className="primary" type="submit">
            Save exercise
          </button>
        </form>
      ) : null}
    </li>
  )
}

function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  if (parsed < min || parsed > max) return null
  return parsed
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min: number
  max: number
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="num"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  )
}
