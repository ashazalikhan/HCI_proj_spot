import { useState } from 'react'
import { SampleMark } from '../components/SampleMark'
import { ValueSheet } from '../components/ValueSheet'
import {
  displaySessionVolume,
  displayWeight,
  formatSessionDuration,
  formatSpotDateString,
  weightNumber,
} from '../format'
import {
  allLoggedSets,
  finishedSessionsNewestFirst,
  trendPointsForExercise,
} from '../state/history'
import { findLoggedSet } from '../state/reducer'
import { useStore } from '../state/store'
import type { Session } from '../state/types'

export function History() {
  const store = useStore()
  const unit = store.data.settings.unit
  const sessions = finishedSessionsNewestFirst(store.data.sessions)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editSetId, setEditSetId] = useState<string | null>(null)

  const selected = sessions.find((session) => session.id === selectedId) ?? null
  const editing =
    selected && editSetId ? findLoggedSet(selected, editSetId) : null

  if (sessions.length === 0) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          History
        </h1>
        <p>Your history starts after your first logged workout.</p>
      </>
    )
  }

  if (!selected) {
    return (
      <>
        <h1 id="screen-title" tabIndex={-1}>
          History
        </h1>
        <ul className="stack history-list" aria-label="Past workouts">
          {sessions.map((session) => (
            <li key={session.id}>
              <button className="row history-row" type="button" onClick={() => setSelectedId(session.id)}>
                <span className="ex-name">
                  {session.routineName}
                  {session.isSample ? <SampleMark /> : null}
                </span>
                <span className="ex-meta num">
                  {session.finishedAt ? formatSpotDateString(session.finishedAt) : ''}
                  {' · '}
                  {formatSessionDuration(session.startedAt, session.finishedAt) || '—'}
                  {' · '}
                  {displaySessionVolume(allLoggedSets(session), unit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <button className="text-button" type="button" onClick={() => setSelectedId(null)}>
        Back to sessions
      </button>
      <h1 id="screen-title" tabIndex={-1}>
        {selected.routineName}
      </h1>
      {selected.isSample ? <SampleMark /> : null}
      <p className="dim num">
        {selected.finishedAt ? formatSpotDateString(selected.finishedAt) : ''}
        {' · '}
        {formatSessionDuration(selected.startedAt, selected.finishedAt) || '—'}
        {' · '}
        {displaySessionVolume(allLoggedSets(selected), unit)}
      </p>
      {selected.exercises.map((exercise) => (
        <section key={exercise.routineExerciseId} className="stack">
          <h2 className="workout-title">{exercise.name}</h2>
          {exercise.sets.length === 0 ? (
            <p className="dim">No sets logged</p>
          ) : (
            <table className="set-table num">
              <caption className="sr-only">{exercise.name} sets</caption>
              <thead>
                <tr>
                  <th scope="col">Set</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Reps</th>
                  <th scope="col">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set, index) => (
                  <tr key={set.id}>
                    <td>{index + 1}</td>
                    <td>{displayWeight(set.weightKg, unit)}</td>
                    <td>{set.reps}</td>
                    <td>
                      <button className="text-button" type="button" onClick={() => setEditSetId(set.id)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <TrendChart
            routineExerciseId={exercise.routineExerciseId}
            exerciseName={exercise.name}
            sessions={store.data.sessions}
            unit={unit}
          />
        </section>
      ))}
      {editing ? (
        <ValueSheet
          title="Edit set"
          unit={unit}
          mode="logged"
          weightKg={editing.set.weightKg}
          reps={editing.set.reps}
          onSave={(weightKg, reps) => {
            store.dispatch({ type: 'edit-set', setId: editing.set.id, weightKg, reps })
            setEditSetId(null)
          }}
          onClose={() => setEditSetId(null)}
        />
      ) : null}
    </>
  )
}

function TrendChart({
  routineExerciseId,
  exerciseName,
  sessions,
  unit,
}: {
  routineExerciseId: string
  exerciseName: string
  sessions: Session[]
  unit: 'kg' | 'lb'
}) {
  const points = trendPointsForExercise(sessions, routineExerciseId)
  if (points.length === 0) return null
  if (points.length < 2) {
    return (
      <p className="dim">
        Trend for {exerciseName} needs at least two logged workouts.
      </p>
    )
  }

  const weights = points.map((point) =>
    unit === 'lb' ? Number(weightNumber(point.weightKg, 'lb')) : point.weightKg,
  )
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const pad = maxW === minW ? (unit === 'lb' ? 5 : 2.5) : 0
  const yMin = minW - pad
  const yMax = maxW + pad
  const width = 280
  const height = 120
  const margin = { left: 40, right: 8, top: 8, bottom: 28 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const coords = points.map((point, index) => {
    const x = margin.left + (index / (points.length - 1)) * innerW
    const w = unit === 'lb' ? Number(weightNumber(point.weightKg, 'lb')) : point.weightKg
    const y = margin.top + innerH - ((w - yMin) / (yMax - yMin)) * innerH
    return { x, y, point, w }
  })

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ')

  return (
    <div className="trend-block">
      <p className="kicker">Weight trend ({unit})</p>
      <svg
        className="trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Weight trend for ${exerciseName}`}
      >
        <text x={margin.left} y={height - 4} className="trend-axis">
          Date
        </text>
        <text x={4} y={margin.top + 8} className="trend-axis">
          {unit}
        </text>
        <text x={margin.left - 4} y={margin.top + 10} textAnchor="end" className="trend-axis num">
          {unit === 'lb' ? yMax.toFixed(1) : String(Math.round(yMax * 10) / 10)}
        </text>
        <text x={margin.left - 4} y={margin.top + innerH} textAnchor="end" className="trend-axis num">
          {unit === 'lb' ? yMin.toFixed(1) : String(Math.round(yMin * 10) / 10)}
        </text>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={polyline}
        />
        {coords.map((c) => (
          <circle key={c.point.sessionId} cx={c.x} cy={c.y} r="3" fill="currentColor" />
        ))}
      </svg>
      <ul className="trend-points dim">
        {coords.map((c) => (
          <li key={c.point.sessionId}>
            {formatSpotDateString(c.point.finishedAt)}: {unit === 'lb' ? `${c.w.toFixed(1)} lb` : displayWeight(c.point.weightKg, unit)}
          </li>
        ))}
      </ul>
    </div>
  )
}
