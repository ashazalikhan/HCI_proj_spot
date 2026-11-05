export const LB_PER_KG = 2.20462262

export function lbInputToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 10000) / 10000
}

export function displayWeight(kg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'lb') {
    return `${(kg * LB_PER_KG).toFixed(1)} lb`
  }
  const rounded = Math.round(kg * 100) / 100
  return `${String(rounded)} kg`
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
