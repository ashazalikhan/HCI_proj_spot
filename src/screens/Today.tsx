import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SampleMark } from '../components/SampleMark'
import { displayWeight, formatSpotDate, formatSpotDateString } from '../format'
import { lastLoggedSet, latestFinishedSession } from '../state/history'
import { preferredRoutineId, resumeHash, resumeLabel, unfinishedSessions } from '../state/repair'
import { useStore } from '../state/store'

export function Today() {
  const store = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dayOpen, setDayOpen] = useState(false)
  const dayButton = useRef<HTMLButtonElement>(null)
  const dayList = useRef<HTMLUListElement>(null)
  const routineId = preferredRoutineId(store.data, selectedId)
  const routine = store.data.routines.find((item) => item.id === routineId) ?? null
  const open = unfinishedSessions(store.data)[0] ?? null
  const finished = routine ? latestFinishedSession(store.data.sessions, routine.id) : null

  useEffect(() => {
    if (!dayOpen) return
    const selected = dayList.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    selected?.focus()
  }, [dayOpen])

  function resume() {
    const result = store.dispatch({ type: 'attach-active' })
    if (unfinishedSessions(result).length === 1) window.location.hash = resumeHash(result)
  }

  function start() {
    if (!routine || routine.exercises.length === 0) return
    const result = store.dispatch({ type: 'start-workout', routineId: routine.id })
    const started = unfinishedSessions(result).some((session) => session.routineId === routine.id)
    if (started) window.location.hash = resumeHash(result)
  }

  function onDayKey(event: KeyboardEvent<HTMLUListElement>) {
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      buttons[Math.min(buttons.length - 1, index + 1)]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[Math.max(0, index - 1)]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      buttons[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      buttons[buttons.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDayOpen(false)
      dayButton.current?.focus()
    }
  }

  return (
    <>
      <p className="kicker">{formatSpotDate(new Date())}</p>
      <h1 id="screen-title" className="today-title" tabIndex={-1}>
        <span>{routine ? routine.name : 'Today'}</span>
        {routine?.isSample ? <SampleMark /> : null}
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
          {routine?.isSample ? <p className="dim">try it, edit it, delete it.</p> : null}
          {store.data.routines.length > 1 ? (
            <div className="day-switch">
              <button
                ref={dayButton}
                className="ghost"
                type="button"
                aria-label="Day"
                aria-expanded={dayOpen}
                aria-controls="day-list"
                onClick={() => setDayOpen((openDay) => !openDay)}
              >
                Switch day
              </button>
              {dayOpen ? (
                <ul
                  id="day-list"
                  ref={dayList}
                  className="day-list"
                  role="listbox"
                  aria-label="Day"
                  onKeyDown={onDayKey}
                >
                  {store.data.routines.map((item) => (
                    <li key={item.id}>
                      <button
                        className="row"
                        type="button"
                        role="option"
                        aria-selected={item.id === routine?.id}
                        onClick={() => {
                          setSelectedId(item.id)
                          setDayOpen(false)
                          dayButton.current?.focus()
                        }}
                      >
                        <span className="ex-name">{item.name}</span>
                        {item.isSample ? <SampleMark /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
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
