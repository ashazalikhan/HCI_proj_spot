import { useEffect, useRef, type PointerEvent, type KeyboardEvent } from 'react'

export function Stepper({
  label,
  value,
  carried,
  onStep,
  onEdit,
}: {
  label: string
  value: string
  carried: boolean
  onStep: (direction: 1 | -1) => void
  onEdit?: () => void
}) {
  const delayRef = useRef<number | null>(null)
  const repeatRef = useRef<number | null>(null)
  const pointerUsed = useRef(false)

  function clearHold() {
    if (delayRef.current !== null) window.clearTimeout(delayRef.current)
    if (repeatRef.current !== null) window.clearInterval(repeatRef.current)
    delayRef.current = null
    repeatRef.current = null
  }

  useEffect(() => clearHold, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      onStep(1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      onStep(-1)
    }
  }

  function pointerDown(direction: 1 | -1, event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    pointerUsed.current = true
    onStep(direction)
    clearHold()
    delayRef.current = window.setTimeout(() => {
      repeatRef.current = window.setInterval(() => onStep(direction), 120)
    }, 400)
  }

  function clickStep(direction: 1 | -1) {
    if (pointerUsed.current) {
      pointerUsed.current = false
      return
    }
    onStep(direction)
  }

  const valueClass = carried ? 'stepper-value carried' : 'stepper-value'

  return (
    <div role="group" aria-label={label} className="stepper" onKeyDown={onKeyDown}>
      <button
        type="button"
        className="step"
        aria-label={`Decrease ${label}`}
        onPointerDown={(event) => pointerDown(-1, event)}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onBlur={clearHold}
        onClick={() => clickStep(-1)}
      >
        −
      </button>
      {onEdit ? (
        <button type="button" className={valueClass} aria-label={`Edit ${label}, ${value}`} onClick={onEdit}>
          {value}
        </button>
      ) : (
        <div className={valueClass} aria-hidden="true">
          {value}
        </div>
      )}
      <button
        type="button"
        className="step"
        aria-label={`Increase ${label}`}
        onPointerDown={(event) => pointerDown(1, event)}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onBlur={clearHold}
        onClick={() => clickStep(1)}
      >
        +
      </button>
    </div>
  )
}
