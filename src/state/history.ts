import type { AppData, Draft, LoggedSet, Session, SessionExercise } from './types'

export interface PrefillRequest {
  sessions: Session[]
  currentSession: Session
  exerciseIndex: number
  setIndex: number
  startWeightKg?: number
}

function emptyDraft(): Draft {
  return { weightKg: null, reps: null, source: 'none' }
}

function isFinishedReal(session: Session): boolean {
  return session.finishedAt !== undefined && session.isSample === false
}

function exerciseAt(session: Session, index: number): SessionExercise | undefined {
  return session.exercises[index]
}

export function prefillDraft(request: PrefillRequest): Draft {
  const exercise = exerciseAt(request.currentSession, request.exerciseIndex)
  if (!exercise) return emptyDraft()

  if (request.setIndex > 0) {
    const previous = exercise.sets[request.setIndex - 1]
    if (previous) {
      return {
        weightKg: previous.weightKg,
        reps: previous.reps,
        source: 'previous-set',
        sourceLabel: `from set ${request.setIndex}`,
      }
    }
  }

  const prior = lastRealSessionForExercise(
    request.sessions,
    exercise.routineExerciseId,
    request.currentSession.id,
  )
  const sameSet = prior?.exercise.sets[request.setIndex]
  if (prior && sameSet) {
    return {
      weightKg: sameSet.weightKg,
      reps: sameSet.reps,
      source: 'last-session',
      sourceLabel: `from last ${prior.session.routineName}`,
    }
  }

  if (typeof request.startWeightKg === 'number' && Number.isFinite(request.startWeightKg)) {
    return {
      weightKg: request.startWeightKg,
      reps: null,
      source: 'starting-target',
      sourceLabel: 'starting target',
    }
  }

  return emptyDraft()
}

function lastRealSessionForExercise(
  sessions: Session[],
  routineExerciseId: string,
  exceptSessionId: string,
): { session: Session; exercise: SessionExercise } | null {
  const matches = sessions.filter((session) => {
    if (session.id === exceptSessionId || !isFinishedReal(session)) return false
    return session.exercises.some((exercise) => exercise.routineExerciseId === routineExerciseId)
  })
  const latest = mostRecent(matches)
  if (!latest) return null
  const exercise = latest.exercises.find((item) => item.routineExerciseId === routineExerciseId)
  if (!exercise) return null
  return { session: latest, exercise }
}

function mostRecent(sessions: Session[]): Session | null {
  if (sessions.length === 0) return null
  return [...sessions].sort((a, b) => {
    const aKey = a.finishedAt ?? a.startedAt
    const bKey = b.finishedAt ?? b.startedAt
    return aKey < bKey ? 1 : aKey > bKey ? -1 : 0
  })[0]
}

export interface LastLog {
  session: Session
  set: LoggedSet
}

/** Last logged set of an exercise in the latest finished session of this routine. */
export function lastLoggedSet(
  sessions: Session[],
  routineId: string,
  routineExerciseId: string,
): LastLog | null {
  const finished = sessions.filter(
    (session) => session.finishedAt !== undefined && session.routineId === routineId,
  )
  const latest = mostRecent(finished)
  if (!latest) return null
  const exercise = latest.exercises.find((item) => item.routineExerciseId === routineExerciseId)
  const set = exercise?.sets[exercise.sets.length - 1]
  if (!exercise || !set) return null
  return { session: latest, set }
}

export function latestFinishedSession(sessions: Session[], routineId: string): Session | null {
  return mostRecent(
    sessions.filter((session) => session.finishedAt !== undefined && session.routineId === routineId),
  )
}

export function draftForCursor(data: AppData, session: Session, exerciseIndex: number, setIndex: number): Draft {
  const exercise = session.exercises[exerciseIndex]
  if (!exercise) return emptyDraft()
  const routine = data.routines.find((item) => item.id === session.routineId)
  const live = routine?.exercises.find((item) => item.id === exercise.routineExerciseId)
  return prefillDraft({
    sessions: data.sessions,
    currentSession: session,
    exerciseIndex,
    setIndex,
    startWeightKg: live?.startWeightKg,
  })
}

export function isFinishedSession(session: Session): boolean {
  return session.finishedAt !== undefined
}

export function finishedSessionsNewestFirst(sessions: Session[]): Session[] {
  return sessions
    .filter((session) => session.finishedAt !== undefined)
    .sort((a, b) => {
      const aKey = a.finishedAt ?? ''
      const bKey = b.finishedAt ?? ''
      return aKey < bKey ? 1 : aKey > bKey ? -1 : 0
    })
}

export function allLoggedSets(session: Session): LoggedSet[] {
  const out: LoggedSet[] = []
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) out.push(set)
  }
  return out
}

export function sessionVolumeKg(session: Session): number {
  let total = 0
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      total += set.weightKg * set.reps
    }
  }
  return total
}

export function sessionTotalReps(session: Session): number {
  let total = 0
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) total += set.reps
  }
  return total
}

export function exercisesWithSetsCount(session: Session): number {
  return session.exercises.filter((exercise) => exercise.sets.length > 0).length
}

export function setsDoneCount(session: Session): number {
  return session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
}

/** Latest finished real session of the same routine, excluding one session id. */
export function previousRealSessionSameRoutine(
  sessions: Session[],
  routineId: string,
  exceptSessionId: string,
): Session | null {
  const matches = sessions.filter(
    (session) =>
      session.id !== exceptSessionId &&
      session.routineId === routineId &&
      isFinishedReal(session),
  )
  return mostRecent(matches)
}

export function repsComparisonLine(
  current: Session,
  previous: Session | null,
): string | null {
  if (current.isSample || !previous) return null
  const currentReps = sessionTotalReps(current)
  const previousReps = sessionTotalReps(previous)
  const delta = currentReps - previousReps
  const name = previous.routineName
  if (delta > 0) return `${delta} more reps than last ${name}`
  if (delta < 0) return `${Math.abs(delta)} fewer reps than last ${name}`
  return `Same reps as last ${name}`
}

export interface TrendPoint {
  finishedAt: string
  weightKg: number
  sessionId: string
}

/** One point per finished non-sample session that logged this exercise (last set weight). */
export function trendPointsForExercise(
  sessions: Session[],
  routineExerciseId: string,
): TrendPoint[] {
  const points: TrendPoint[] = []
  for (const session of sessions) {
    if (!isFinishedReal(session)) continue
    const exercise = session.exercises.find((item) => item.routineExerciseId === routineExerciseId)
    const lastSet = exercise?.sets[exercise.sets.length - 1]
    if (!exercise || !lastSet || !session.finishedAt) continue
    points.push({
      finishedAt: session.finishedAt,
      weightKg: lastSet.weightKg,
      sessionId: session.id,
    })
  }
  points.sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : a.finishedAt > b.finishedAt ? 1 : 0))
  return points
}

export function latestFinishedSessionByTime(sessions: Session[]): Session | null {
  return mostRecent(finishedSessionsNewestFirst(sessions))
}
