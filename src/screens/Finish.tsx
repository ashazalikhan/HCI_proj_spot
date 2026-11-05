import { useState } from 'react'
import { SampleMark } from '../components/SampleMark'
import {
  allLoggedSets,
  exercisesWithSetsCount,
  latestFinishedSessionByTime,
  previousRealSessionSameRoutine,
  repsComparisonLine,
  setsDoneCount,
} from '../state/history'
import { displaySessionVolume, formatSessionDuration } from '../format'
import { resumeHash, unfinishedSessions } from '../state/repair'
import { useStore } from '../state/store'

export function Finish() {
  const store = useStore()
  const open = unfinishedSessions(store.data)[0] ?? null
  const finished = latestFinishedSessionByTime(store.data.sessions)
  const unit = store.data.settings.unit
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')

  if (open) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          Finish
        </h1>
        <p>This workout is still in progress.</p>
        <a className="primary" href={resumeHash(store.data)}>
          Back to workout
        </a>
      </>
    )
  }

  if (!finished?.finishedAt) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          Finish
        </h1>
        <p>No finished workout to show.</p>
        <a className="primary" href="#/today">
          Back to Today
        </a>
      </>
    )
  }

  const duration = formatSessionDuration(finished.startedAt, finished.finishedAt)
  const volume = displaySessionVolume(allLoggedSets(finished), unit)
  const previous = previousRealSessionSameRoutine(
    store.data.sessions,
    finished.routineId,
    finished.id,
  )
  const comparison = repsComparisonLine(finished, previous)

  const summary = finished

  function done() {
    store.dispatch({ type: 'set-session-note', sessionId: summary.id, note: noteText })
    window.location.hash = '#/today'
  }

  return (
    <>
      <h1 id="screen-title" tabIndex={-1}>
        Done for today
      </h1>
      <p className="finish-day">
        {finished.routineName}
        {finished.isSample ? <SampleMark /> : null}
      </p>
      <dl className="stat-grid num">
        <div>
          <dt>Duration</dt>
          <dd>{duration || '—'}</dd>
        </div>
        <div>
          <dt>Exercises</dt>
          <dd>{exercisesWithSetsCount(finished)}</dd>
        </div>
        <div>
          <dt>Sets</dt>
          <dd>{setsDoneCount(finished)}</dd>
        </div>
        <div>
          <dt>Volume</dt>
          <dd>{volume}</dd>
        </div>
      </dl>
      {comparison ? <p className="dim">{comparison}</p> : null}
      {noteOpen ? (
        <label className="field">
          <span>Session note</span>
          <textarea
            rows={3}
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
          />
        </label>
      ) : (
        <button className="text-button" type="button" onClick={() => setNoteOpen(true)}>
          Add a note
        </button>
      )}
      <div className="thumb-dock">
        <button className="primary" type="button" onClick={done}>
          Done
        </button>
      </div>
    </>
  )
}
