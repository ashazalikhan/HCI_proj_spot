import { useState } from 'react'
import { displayWeight, formatSpotDate, formatSpotDateString } from '../format'
import { lastLoggedSet, latestFinishedSession } from '../state/history'
import { preferredRoutineId, resumeLabel, unfinishedSessions } from '../state/repair'
import { useStore } from '../state/store'

export function Today() {
  const store = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const routineId = preferredRoutineId(store.data, selectedId)
  const routine = store.data.routines.find((item) => item.id === routineId) ?? null
  const open = unfinishedSessions(store.data)[0] ?? null
  const finished = routine ? latestFinishedSession(store.data.sessions, routine.id) : null

  function resume() {
    const result = store.dispatch({ type: 'attach-active' })
    if (unfinishedSessions(result).length === 1) window.location.hash = '#/workout'
  }

  function start() {
    if (!routine || routine.exercises.length === 0) return
    const result = store.dispatch({ type: 'start-workout', routineId: routine.id })
    const started = unfinishedSessions(result).some((session) => session.routineId === routine.id)
    if (started) window.location.hash = '#/workout'
  }

  return (
    <>
      <p className="kicker">{formatSpotDate(new Date())}</p>
      <h1 id="screen-title" tabIndex={-1}>
        {routine ? routine.name : 'Today'}
      </h1>
      {store.repairNotice ? (
        <p className="notice" role="status">
          {store.repairNotice}
        </p>
      ) : null}
      {store.data.routines.length === 0 && !open ? (
        <div className="stack">
          <p>No workout days yet.</p>
          <a className="primary" href="#/routines">
            Create my first day
          </a>
        </div>
      ) : (
        <div className="stack">
          {routine?.isSample ? <p className="dim">Sample Push Day - try it, edit it, delete it.</p> : null}
          {store.data.routines.length > 1 ? (
            <label className="field">
              <span>Day</span>
              <select
                value={routine?.id ?? ''}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {store.data.routines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.isSample ? `${item.name} (SAMPLE)` : item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {!routine ? (
            <p>This workout day was deleted. The in-progress session is still here.</p>
          ) : routine.exercises.length === 0 ? (
            <p>This day has no exercises yet.</p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {routine?.exercises.map((exercise) => {
                const last = routine
                  ? lastLoggedSet(store.data.sessions, routine.id, exercise.id)
                  : null
                return (
                  <li key={exercise.id} className="row">
                    <span className="ex-name">{exercise.name}</span>
                    <span className="ex-meta num">
                      {last
                        ? `last: ${displayWeight(last.set.weightKg, store.data.settings.unit)} x ${last.set.reps}`
                        : 'No log yet'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {finished?.finishedAt ? (
            <p className="dim">Last: {formatSpotDateString(finished.finishedAt)}</p>
          ) : null}
          {open && routine && open.routineId !== routine.id ? (
            <p className="dim">Resume keeps the in-progress {open.routineName} workout.</p>
          ) : null}
          <div className="dock">
            {open ? (
              <button className="primary" type="button" onClick={resume}>
                {resumeLabel(store.data)}
              </button>
            ) : (
              <button
                className="primary"
                type="button"
                disabled={!routine || routine.exercises.length === 0}
                onClick={start}
              >
                {routine && routine.exercises.length === 0 ? 'Add an exercise first' : 'Start workout'}
              </button>
            )}
            <button
              className="text-button"
              type="button"
              onClick={() => store.exportAppData(store.data, 'spot-backup.json')}
            >
              Export backup
            </button>
          </div>
        </div>
      )}
    </>
  )
}
