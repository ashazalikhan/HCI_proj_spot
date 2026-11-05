import { useEffect, useRef, useState } from 'react'
import { displayWeight } from '../format'
import { useStore } from '../state/store'

export function CommitToast() {
  const store = useStore()
  const setId = store.data.active?.lastCommittedSetId
  const [visibleId, setVisibleId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const previous = useRef<string | undefined>(setId)
  const remaining = useRef(6000)
  const stamp = useRef(0)

  useEffect(() => {
    if (setId && setId !== previous.current) {
      previous.current = setId
      remaining.current = 6000
      setVisibleId(setId)
      return
    }
    previous.current = setId
    if (!setId) setVisibleId(null)
  }, [setId])

  useEffect(() => {
    if (!visibleId || paused) return
    stamp.current = Date.now()
    const timer = window.setTimeout(() => setVisibleId(null), remaining.current)
    return () => {
      remaining.current = Math.max(0, remaining.current - (Date.now() - stamp.current))
      window.clearTimeout(timer)
    }
  }, [visibleId, paused])

  if (!visibleId) return null

  let label = 'Set logged'
  for (const session of store.data.sessions) {
    for (const exercise of session.exercises) {
      const set = exercise.sets.find((item) => item.id === visibleId)
      if (set) label = `Logged ${displayWeight(set.weightKg, store.data.settings.unit)} x ${set.reps}`
    }
  }

  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <p>{label}</p>
      <button
        type="button"
        onClick={() => {
          store.dispatch({ type: 'undo-last-set' })
          if (window.location.hash !== '#/workout') window.location.hash = '#/workout'
        }}
      >
        Undo
      </button>
      <button type="button" onClick={() => setVisibleId(null)}>
        Dismiss
      </button>
    </div>
  )
}
