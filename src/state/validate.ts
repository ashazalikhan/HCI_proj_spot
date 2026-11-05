import type { AppData } from './types'

export type Validation =
  | { ok: true; data: AppData }
  | { ok: false; reason: string }

const PHASES = new Set(['logging', 'resting', 'rest-over'])
const SOURCES = new Set(['previous-set', 'last-session', 'starting-target', 'edited', 'none'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isWhole(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value)
}

export function validateAppData(raw: string): Validation {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'The file is not valid JSON.' }
  }
  if (!isRecord(parsed)) {
    return { ok: false, reason: 'The saved data is not an object, so it was not overwritten.' }
  }
  if (parsed.version !== 1) {
    const seen = parsed.version === undefined ? 'missing' : String(parsed.version)
    return {
      ok: false,
      reason: `This data is version ${seen}, and this app only reads version 1. It was not overwritten.`,
    }
  }
  if (!Array.isArray(parsed.routines) || !routinesValid(parsed.routines)) {
    return { ok: false, reason: 'Workout days in the saved data are malformed. Nothing was overwritten.' }
  }
  if (!Array.isArray(parsed.sessions) || !sessionsValid(parsed.sessions)) {
    return { ok: false, reason: 'Workout history in the saved data is malformed. Nothing was overwritten.' }
  }
  if (!settingsValid(parsed.settings)) {
    return { ok: false, reason: 'Settings in the saved data are malformed. Nothing was overwritten.' }
  }
  if (!activeValid(parsed.active)) {
    return { ok: false, reason: 'The in-progress workout pointer is malformed. Nothing was overwritten.' }
  }
  const samples = parsed.routines.filter((routine) => isRecord(routine) && routine.isSample === true)
  if (samples.length > 1) {
    return { ok: false, reason: 'More than one sample day is stored. Nothing was overwritten.' }
  }
  const unfinished = parsed.sessions.filter(
    (session) => isRecord(session) && session.finishedAt === undefined,
  )
  if (unfinished.length > 1) {
    return {
      ok: false,
      reason: 'More than one unfinished workout is stored. Nothing was deleted or chosen.',
    }
  }
  return { ok: true, data: parsed as unknown as AppData }
}

function routinesValid(routines: unknown[]): boolean {
  return routines.every((routine) => {
    if (!isRecord(routine)) return false
    if (typeof routine.id !== 'string' || typeof routine.name !== 'string') return false
    if (typeof routine.isSample !== 'boolean') return false
    if (!Array.isArray(routine.exercises)) return false
    return routine.exercises.every(exerciseValid)
  })
}

function exerciseValid(exercise: unknown): boolean {
  if (!isRecord(exercise)) return false
  if (typeof exercise.id !== 'string' || typeof exercise.name !== 'string') return false
  if (!isWhole(exercise.targetSets) || exercise.targetSets < 0) return false
  if (!isWhole(exercise.targetReps) || exercise.targetReps < 0) return false
  if (!isWhole(exercise.restSeconds) || exercise.restSeconds < 0) return false
  if (exercise.startWeightKg !== undefined && !isFiniteNumber(exercise.startWeightKg)) return false
  return true
}

function sessionsValid(sessions: unknown[]): boolean {
  return sessions.every((session) => {
    if (!isRecord(session)) return false
    if (typeof session.id !== 'string' || typeof session.routineId !== 'string') return false
    if (typeof session.routineName !== 'string' || typeof session.isSample !== 'boolean') return false
    if (typeof session.startedAt !== 'string') return false
    if (session.finishedAt !== undefined && typeof session.finishedAt !== 'string') return false
    if (session.note !== undefined && typeof session.note !== 'string') return false
    if (!Array.isArray(session.exercises)) return false
    return session.exercises.every(sessionExerciseValid)
  })
}

function sessionExerciseValid(exercise: unknown): boolean {
  if (!isRecord(exercise)) return false
  if (typeof exercise.routineExerciseId !== 'string' || typeof exercise.name !== 'string') return false
  if (!isWhole(exercise.targetSets) || exercise.targetSets < 0) return false
  if (!isWhole(exercise.targetReps) || exercise.targetReps < 0) return false
  if (!isWhole(exercise.restSeconds) || exercise.restSeconds < 0) return false
  if (!Array.isArray(exercise.sets)) return false
  return exercise.sets.every(setValid)
}

function setValid(set: unknown): boolean {
  if (!isRecord(set)) return false
  if (typeof set.id !== 'string' || typeof set.doneAt !== 'string') return false
  if (!isFiniteNumber(set.weightKg) || !isFiniteNumber(set.reps)) return false
  if (set.editedAt !== undefined && typeof set.editedAt !== 'string') return false
  return true
}

function settingsValid(settings: unknown): boolean {
  if (!isRecord(settings)) return false
  if (settings.unit !== 'kg' && settings.unit !== 'lb') return false
  if (typeof settings.sound !== 'boolean') return false
  if (typeof settings.vibration !== 'boolean') return false
  if (typeof settings.keepScreenAwake !== 'boolean') return false
  if (settings.reduceMotion !== 'system' && settings.reduceMotion !== 'on' && settings.reduceMotion !== 'off') {
    return false
  }
  return true
}

function activeValid(active: unknown): boolean {
  if (active === null) return true
  if (!isRecord(active)) return false
  if (typeof active.sessionId !== 'string') return false
  if (!isWhole(active.exerciseIndex) || !isWhole(active.setIndex)) return false
  if (typeof active.phase !== 'string' || !PHASES.has(active.phase)) return false
  if (active.restEndsAt !== undefined && !isFiniteNumber(active.restEndsAt)) return false
  if (active.restTotalMs !== undefined && !isFiniteNumber(active.restTotalMs)) return false
  if (active.lastCommittedSetId !== undefined && typeof active.lastCommittedSetId !== 'string') return false
  return draftValid(active.draft)
}

function draftValid(draft: unknown): boolean {
  if (!isRecord(draft)) return false
  if (draft.weightKg !== null && !isFiniteNumber(draft.weightKg)) return false
  if (draft.reps !== null && !isFiniteNumber(draft.reps)) return false
  if (typeof draft.source !== 'string' || !SOURCES.has(draft.source)) return false
  if (draft.sourceLabel !== undefined && typeof draft.sourceLabel !== 'string') return false
  return true
}
