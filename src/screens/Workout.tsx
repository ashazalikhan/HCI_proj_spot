import { useState } from 'react'
import { unfinishedSessions } from '../state/repair'
import { useStore } from '../state/store'

export function Workout() {
  const store = useStore()
  const session = unfinishedSessions(store.data)[0] ?? null
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  if (!session) {
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

  return (
    <>
      <h1 id="screen-title" tabIndex={-1}>
        {session.routineName}
      </h1>
      <p>Workout screen arrives in step 2.</p>
      <div className="dock">
        <a className="primary" href="#/today">
          Back to Today
        </a>
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
          <button className="danger" type="button" onClick={() => setConfirmDiscard(true)}>
            Discard this workout
          </button>
        )}
      </div>
    </>
  )
}
