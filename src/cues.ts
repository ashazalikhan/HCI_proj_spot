import type { Settings } from './state/types'

let audioContext: AudioContext | null = null
let unlocked = false

function ensureContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!audioContext) audioContext = new AudioContext()
  return audioContext
}

export function unlockAudioFromGesture(): void {
  const ctx = ensureContext()
  if (!ctx || unlocked) return
  if (ctx.state === 'running') {
    unlocked = true
    return
  }
  void ctx.resume().then(() => {
    if (ctx.state === 'running') unlocked = true
  })
}

export function playRestTone(settings: Settings): void {
  if (!settings.sound || !unlocked) return
  const ctx = ensureContext()
  if (!ctx || ctx.state !== 'running') return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.12
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    /* best-effort */
  }
}

export function playRestVibration(settings: Settings): void {
  if (!settings.vibration || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(200)
  } catch {
    /* best-effort */
  }
}

type WakeLockSentinel = { release: () => Promise<void>; addEventListener?: (type: 'release', listener: () => void) => void }

let wakeLock: WakeLockSentinel | null = null
let wakeLockSessionId: string | null = null

export async function requestWakeLock(sessionKey: string): Promise<void> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
  }
  if (!nav.wakeLock) return
  if (wakeLock && wakeLockSessionId === sessionKey) return
  await releaseWakeLock()
  try {
    const sentinel = await nav.wakeLock.request('screen')
    if (wakeLockSessionId !== null && wakeLockSessionId !== sessionKey) {
      await sentinel.release()
      return
    }
    wakeLock = sentinel
    wakeLockSessionId = sessionKey
    sentinel.addEventListener?.('release', () => {
      if (wakeLock === sentinel) {
        wakeLock = null
        wakeLockSessionId = null
      }
    })
  } catch {
    wakeLock = null
    wakeLockSessionId = null
  }
}

export async function releaseWakeLock(): Promise<void> {
  const current = wakeLock
  wakeLock = null
  wakeLockSessionId = null
  if (!current) return
  try {
    await current.release()
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(settings: Settings): boolean {
  if (settings.reduceMotion === 'on') return true
  if (settings.reduceMotion === 'off') return false
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
