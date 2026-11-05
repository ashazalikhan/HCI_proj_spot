import { useRef, useState, type KeyboardEvent } from 'react'
import {
  repsReadout,
  resolveTypedReps,
  resolveTypedWeight,
  stepReps,
  stepWeight,
  weightReadout,
} from '../format'
import { commitWeightAndReps } from '../state/reducer'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

export function ValueSheet({
  title,
  unit,
  weightKg,
  reps,
  mode,
  onChange,
  onSave,
  onClose,
}: {
  title: string
  unit: 'kg' | 'lb'
  weightKg: number | null
  reps: number | null
  mode: 'draft' | 'logged'
  onChange?: (weightKg: number | null, reps: number | null) => void
  onSave?: (weightKg: number, reps: number) => void
  onClose: () => void
}) {
  const [localWeight, setLocalWeight] = useState(weightKg)
  const [localReps, setLocalReps] = useState(reps)
  const [weightText, setWeightText] = useState(weightKg === null ? '' : weightReadout(weightKg, unit))
  const [repsText, setRepsText] = useState(reps === null ? '' : repsReadout(reps))
  const [weightError, setWeightError] = useState<string | null>(null)
  const [repsError, setRepsError] = useState<string | null>(null)
  const weightTextRef = useRef(weightText)
  const repsTextRef = useRef(repsText)
  weightTextRef.current = weightText
  repsTextRef.current = repsText

  const currentWeight = mode === 'draft' ? weightKg : localWeight
  const currentReps = mode === 'draft' ? reps : localReps

  function publish(nextWeight: number | null, nextReps: number | null) {
    if (mode === 'draft') onChange?.(nextWeight, nextReps)
    else {
      setLocalWeight(nextWeight)
      setLocalReps(nextReps)
    }
    setWeightText(nextWeight === null ? '' : weightReadout(nextWeight, unit))
    setRepsText(nextReps === null ? '' : repsReadout(nextReps))
    setWeightError(null)
    setRepsError(null)
  }

  function flushTyped(): boolean {
    const resolvedWeight = resolveTypedWeight(weightTextRef.current, currentWeight, unit)
    const resolvedReps = resolveTypedReps(repsTextRef.current)
    if (resolvedWeight === 'invalid') {
      setWeightError('Enter a weight of 0 or more')
      return false
    }
    if (resolvedReps === 'invalid') {
      setRepsError('Enter a whole number of reps')
      return false
    }
    if (resolvedWeight !== currentWeight || resolvedReps !== currentReps) publish(resolvedWeight, resolvedReps)
    return true
  }

  function requestClose() {
    if (mode === 'draft') {
      const resolvedWeight = resolveTypedWeight(weightTextRef.current, currentWeight, unit)
      const resolvedReps = resolveTypedReps(repsTextRef.current)
      if (
        resolvedWeight !== 'invalid' &&
        resolvedReps !== 'invalid' &&
        (resolvedWeight !== currentWeight || resolvedReps !== currentReps)
      ) {
        onChange?.(resolvedWeight, resolvedReps)
      }
    }
    onClose()
  }

  function save() {
    const resolvedWeight = resolveTypedWeight(weightTextRef.current, currentWeight, unit)
    const resolvedReps = resolveTypedReps(repsTextRef.current)
    const weight = resolvedWeight === 'invalid' ? currentWeight : resolvedWeight
    const nextReps = resolvedReps === 'invalid' ? currentReps : resolvedReps
    const values = commitWeightAndReps(weight, nextReps)
    if (!values || !onSave) return
    onSave(values.weightKg, values.reps)
    onClose()
  }

  function onWeightKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      publish(stepWeight(currentWeight, 1, unit, true), currentReps)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()
      publish(stepWeight(currentWeight, -1, unit, true), currentReps)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      flushTyped()
    }
  }

  function onRepsKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      publish(currentWeight, stepReps(currentReps, 1))
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()
      publish(currentWeight, stepReps(currentReps, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      flushTyped()
    }
  }

  const canSave = commitWeightAndReps(currentWeight, currentReps) !== null

  return (
    <Sheet title={title} onClose={requestClose}>
      <div className="stack">
        <div>
          <p className="kicker">Weight {unit}</p>
          <Stepper
            label={`Weight ${unit}`}
            value={weightReadout(currentWeight, unit)}
            carried={false}
            onStep={(direction) => publish(stepWeight(currentWeight, direction, unit, true), currentReps)}
          />
          <label className="field">
            <span>Type weight</span>
            <input
              data-sheet-focus
              inputMode="decimal"
              value={weightText}
              aria-invalid={weightError ? true : undefined}
              onChange={(event) => setWeightText(event.target.value)}
              onKeyDown={onWeightKey}
              onBlur={() => {
                if (mode === 'draft') flushTyped()
              }}
            />
          </label>
          {weightError ? <p className="error">{weightError}</p> : null}
        </div>
        <div>
          <p className="kicker">Reps</p>
          <Stepper
            label="Reps"
            value={repsReadout(currentReps)}
            carried={false}
            onStep={(direction) => publish(currentWeight, stepReps(currentReps, direction))}
          />
          <label className="field">
            <span>Type reps</span>
            <input
              inputMode="numeric"
              value={repsText}
              aria-invalid={repsError ? true : undefined}
              onChange={(event) => setRepsText(event.target.value)}
              onKeyDown={onRepsKey}
              onBlur={() => {
                if (mode === 'draft') flushTyped()
              }}
            />
          </label>
          {repsError ? <p className="error">{repsError}</p> : null}
        </div>
        {mode === 'logged' ? (
          <button className="primary" type="button" disabled={!canSave} onClick={save}>
            Save
          </button>
        ) : null}
        <button className="text-button" type="button" onClick={requestClose}>
          Close
        </button>
      </div>
    </Sheet>
  )
}
