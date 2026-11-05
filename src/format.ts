export const LB_PER_KG = 2.20462262

export function lbInputToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 10000) / 10000
}

export function weightNumber(kg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'lb') return (kg * LB_PER_KG).toFixed(1)
  const rounded = Math.round(kg * 100) / 100
  return String(rounded)
}

export function displayWeight(kg: number, unit: 'kg' | 'lb'): string {
  return `${weightNumber(kg, unit)} ${unit}`
}

export function weightReadout(kg: number | null, unit: 'kg' | 'lb'): string {
  if (kg === null || !Number.isFinite(kg)) return '--'
  return weightNumber(kg, unit)
}

export function repsReadout(reps: number | null): string {
  if (reps === null || !Number.isFinite(reps)) return '--'
  return String(reps)
}

/** Keep the stored kilograms when the field still shows their rounded label. */
export function resolveTypedWeight(
  typed: string,
  currentKg: number | null,
  unit: 'kg' | 'lb',
): number | null | 'invalid' {
  const trimmed = typed.trim()
  if (trimmed === '' || trimmed === '--') return null
  if (currentKg !== null && Number.isFinite(currentKg) && trimmed === weightNumber(currentKg, unit)) {
    return currentKg
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid'
  return unit === 'lb' ? lbInputToKg(parsed) : parsed
}

export function resolveTypedReps(typed: string): number | null | 'invalid' {
  const trimmed = typed.trim()
  if (trimmed === '' || trimmed === '--') return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 0) return 'invalid'
  return parsed
}

export function stepWeight(
  kg: number | null,
  direction: 1 | -1,
  unit: 'kg' | 'lb',
  fine: boolean,
): number {
  const step = unit === 'lb' ? (fine ? 1 : 5) : 2.5
  if (kg === null || !Number.isFinite(kg)) {
    return direction < 0 ? 0 : unit === 'lb' ? lbInputToKg(step) : step
  }
  if (unit === 'lb') {
    const shown = Number((kg * LB_PER_KG).toFixed(1))
    const nextLb = Math.max(0, Math.round((shown + direction * step) * 10) / 10)
    return lbInputToKg(nextLb)
  }
  const next = Math.round((kg + direction * step) * 10000) / 10000
  return next < 0 ? 0 : next
}

export function stepReps(reps: number | null, direction: 1 | -1): number | null {
  if (reps === null || !Number.isFinite(reps)) return direction < 0 ? null : 1
  const base = Number.isInteger(reps) ? reps : Math.trunc(reps)
  const next = base + direction
  return next < 0 ? 0 : next
}

export function formatSpotDate(date: Date): string {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date)
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(date)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
  return `${weekday} ${day} ${month}`
}

export function formatSpotDateString(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return formatSpotDate(date)
}

/** Elapsed time between session start and finish; blank when timestamps are invalid. */
export function formatSessionDuration(startedAt: string, finishedAt: string | undefined): string {
  if (!finishedAt) return ''
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return ''
  const totalSec = Math.floor((end - start) / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0 && seconds > 0) return `${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/** Sum of weight × reps for display; stored weights stay kg. */
export function displaySessionVolume(
  sets: { weightKg: number; reps: number }[],
  unit: 'kg' | 'lb',
): string {
  let total = 0
  for (const set of sets) {
    if (unit === 'lb') {
      total += Number(weightNumber(set.weightKg, 'lb')) * set.reps
    } else {
      total += set.weightKg * set.reps
    }
  }
  const rounded = unit === 'lb' ? Math.round(total) : Math.round(total * 10) / 10
  return `${rounded} ${unit}`
}

/** Tabular rest countdown m:ss for hero numerals. */
export function formatRestCountdown(remainingMs: number): string {
  const totalSec = Math.ceil(Math.max(0, remainingMs) / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Tabular em-width estimate for sizing the rest hero numerals to the ring. */
export function restNumeralEmWidth(text: string): number {
  let em = 0
  for (const char of text) {
    em += char === ':' ? 0.44 : 0.6
  }
  return Math.max(em, 1.15)
}

