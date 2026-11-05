import { draftForCursor } from './history'
import { restRemainingMs, toRestOverActive } from './rest'
import type { ActiveState, AppData, Session } from './types'

export interface RepairResult {
  data: AppData
  notice: string | null
  changed: boolean
}

export function unfinishedSessions(data: AppData): Session[] {
  return data.sessions.filter((session) => session.finishedAt === undefined)
}

export function clampCursor(session: Session, exerciseIndex: number, setIndex: number): {
  exerciseIndex: number
  setIndex: number
} {
  if (session.exercises.length === 0) return { exerciseIndex: 0, setIndex: 0 }
  const maxExercise = session.exercises.length - 1
  const nextExercise = Math.min(Math.max(exerciseIndex, 0), maxExercise)
  const targetSets = session.exercises[nextExercise]?.targetSets ?? 0
  const nextSet = Math.min(Math.max(setIndex, 0), targetSets)
  return { exerciseIndex: nextExercise, setIndex: nextSet }
}

export function cursorFromLoggedSets(session: Session): { exerciseIndex: number; setIndex: number } {
  if (session.exercises.length === 0) return { exerciseIndex: 0, setIndex: 0 }
  const openIndex = session.exercises.findIndex((exercise) => exercise.sets.length < exercise.targetSets)
  if (openIndex === -1) {
    const last = session.exercises.length - 1
    return clampCursor(session, last, session.exercises[last]?.sets.length ?? 0)
  }
  return clampCursor(session, openIndex, session.exercises[openIndex]?.sets.length ?? 0)
}

/**
 * Clear a dangling pointer or clamp indices on the matching unfinished session.
 * A changed cursor gets a new draft from history. Logged sets are never created or removed.
 */
export function repairAppData(data: AppData): RepairResult {
  if (unfinishedSessions(data).length > 1) {
    return { data, notice: null, changed: false }
  }
  if (!data.active) return { data, notice: null, changed: false }

  const active = data.active
  const session = data.sessions.find((item) => item.id === active.sessionId)
  if (!session || session.finishedAt !== undefined) {
    return {
      data: { ...data, active: null },
      notice:
        "The in-progress pointer didn't match an open workout, so it was cleared. Routines and history were kept.",
      changed: true,
    }
  }

  const now = Date.now()
  if (
    active.phase === 'resting' &&
    active.restEndsAt !== undefined &&
    restRemainingMs(active.restEndsAt, now) === 0
  ) {
    return {
      data: { ...data, active: toRestOverActive(active) },
      notice: null,
      changed: true,
    }
  }

  const clamped = clampCursor(session, active.exerciseIndex, active.setIndex)
  const moved = clamped.exerciseIndex !== active.exerciseIndex || clamped.setIndex !== active.setIndex
  if (!moved) return { data, notice: null, changed: false }

  const nextActive: ActiveState = {
    ...active,
    exerciseIndex: clamped.exerciseIndex,
    setIndex: clamped.setIndex,
    draft: draftForCursor(data, session, clamped.exerciseIndex, clamped.setIndex),
  }
  return {
    data: { ...data, active: nextActive },
    notice:
      'The workout position was out of range, so it was moved back onto this session and the suggested weight was recalculated. No set was logged.',
    changed: true,
  }
}

export function resumeHash(data: AppData): '#/rest' | '#/workout' {
  const session = unfinishedSessions(data)[0]
  if (!session || data.active?.sessionId !== session.id) return '#/workout'
  if (data.active.phase === 'resting' || data.active.phase === 'rest-over') return '#/rest'
  return '#/workout'
}

export function resumeLabel(data: AppData): string {
  const session = unfinishedSessions(data)[0]
  if (!session) return 'Resume'
  const active = data.active?.sessionId === session.id ? data.active : null
  const cursor = active
    ? { exerciseIndex: active.exerciseIndex, setIndex: active.setIndex }
    : cursorFromLoggedSets(session)
  const exercise = session.exercises[cursor.exerciseIndex]
  if (!exercise || exercise.targetSets < 1) return `Resume - ${session.routineName}`
  const setNumber = Math.min(cursor.setIndex, exercise.targetSets - 1) + 1
  return `Resume - Set ${setNumber} of ${exercise.targetSets} - ${exercise.name}`
}

export function preferredRoutineId(data: AppData, selectedId: string | null): string | null {
  if (selectedId && data.routines.some((routine) => routine.id === selectedId)) return selectedId
  const ids = new Set(data.routines.map((routine) => routine.id))
  const latest = [...data.sessions]
    .filter((session) => ids.has(session.routineId))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))[0]
  if (latest) return latest.routineId
  return data.routines.find((routine) => !routine.isSample)?.id ?? data.routines[0]?.id ?? null
}
