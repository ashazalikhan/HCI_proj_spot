import { createId } from './ids'
import { draftForCursor } from './history'
import { adjustRestTiming, toRestOverActive } from './rest'
import { cursorFromLoggedSets, unfinishedSessions } from './repair'
import { createInitialData, createSampleRoutine } from './seed'
import type { ActiveState, AppData, LoggedSet, Session, Settings } from './types'

export type Action =
  | { type: 'add-routine'; name: string }
  | { type: 'rename-routine'; routineId: string; name: string }
  | { type: 'delete-routine'; routineId: string }
  | {
      type: 'add-exercise'
      routineId: string
      name: string
      targetSets: number
      targetReps: number
      restSeconds: number
    }
  | {
      type: 'update-exercise'
      routineId: string
      exerciseId: string
      name: string
      targetSets: number
      targetReps: number
      restSeconds: number
    }
  | { type: 'delete-exercise'; routineId: string; exerciseId: string }
  | { type: 'add-sample' }
  | { type: 'start-workout'; routineId: string }
  | { type: 'discard-workout' }
  | { type: 'attach-active' }
  | { type: 'update-draft'; weightKg: number | null; reps: number | null }
  | { type: 'commit-set' }
  | { type: 'undo-last-set' }
  | { type: 'skip-exercise' }
  | { type: 'edit-set'; setId: string; weightKg: number; reps: number }
  | { type: 'start-set' }
  | { type: 'expire-rest'; now: number }
  | { type: 'adjust-rest'; deltaMs: number; now: number }
  | { type: 'update-settings'; settings: Partial<Settings> }
  | { type: 'set-session-note'; sessionId: string; note: string }
  | { type: 'delete-all' }
  | { type: 'load-snapshot'; data: AppData }

const NAME_LIMIT = 80

function cleanName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return trimmed.slice(0, NAME_LIMIT)
}

function cleanCount(value: number, min: number, max: number): number | null {
  if (!Number.isInteger(value) || value < min || value > max) return null
  return value
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'add-routine': {
      const name = cleanName(action.name)
      if (!name) return state
      return {
        ...state,
        routines: [
          ...state.routines,
          { id: createId(), name, isSample: false, exercises: [] },
        ],
      }
    }
    case 'rename-routine': {
      const name = cleanName(action.name)
      if (!name) return state
      return {
        ...state,
        routines: state.routines.map((routine) =>
          routine.id === action.routineId ? { ...routine, name } : routine,
        ),
      }
    }
    case 'delete-routine': {
      const removed = state.routines.find((routine) => routine.id === action.routineId)
      const nextSessions =
        removed?.isSample === true
          ? state.sessions.filter(
              (session) => !(session.isSample && session.routineId === action.routineId),
            )
          : state.sessions
      const activeSessionGone =
        state.active &&
        !nextSessions.some((session) => session.id === state.active?.sessionId)
      return {
        ...state,
        routines: state.routines.filter((routine) => routine.id !== action.routineId),
        sessions: nextSessions,
        active: activeSessionGone ? null : state.active,
      }
    }
    case 'add-exercise':
    case 'update-exercise': {
      const name = cleanName(action.name)
      const targetSets = cleanCount(action.targetSets, 1, 20)
      const targetReps = cleanCount(action.targetReps, 1, 100)
      const restSeconds = cleanCount(action.restSeconds, 0, 600)
      if (!name || targetSets === null || targetReps === null || restSeconds === null) return state
      return {
        ...state,
        routines: state.routines.map((routine) => {
          if (routine.id !== action.routineId) return routine
          if (action.type === 'add-exercise') {
            return {
              ...routine,
              exercises: [
                ...routine.exercises,
                { id: createId(), name, targetSets, targetReps, restSeconds },
              ],
            }
          }
          return {
            ...routine,
            exercises: routine.exercises.map((exercise) =>
              exercise.id === action.exerciseId
                ? { ...exercise, name, targetSets, targetReps, restSeconds }
                : exercise,
            ),
          }
        }),
      }
    }
    case 'delete-exercise':
      return {
        ...state,
        routines: state.routines.map((routine) =>
          routine.id === action.routineId
            ? {
                ...routine,
                exercises: routine.exercises.filter((exercise) => exercise.id !== action.exerciseId),
              }
            : routine,
        ),
      }
    case 'add-sample':
      if (state.routines.some((routine) => routine.isSample)) return state
      return { ...state, routines: [...state.routines, createSampleRoutine()] }
    case 'start-workout':
      return startWorkout(state, action.routineId)
    case 'discard-workout':
      return discardWorkout(state)
    case 'attach-active':
      return attachActive(state)
    case 'update-draft':
      return updateDraft(state, action.weightKg, action.reps)
    case 'commit-set':
      return commitSet(state)
    case 'undo-last-set':
      return undoLastSet(state)
    case 'skip-exercise':
      return skipExercise(state)
    case 'edit-set':
      return editSet(state, action.setId, action.weightKg, action.reps)
    case 'start-set':
      return startSet(state)
    case 'expire-rest':
      return expireRest(state, action.now)
    case 'adjust-rest':
      return adjustRest(state, action.deltaMs, action.now)
    case 'update-settings':
      return updateSettings(state, action.settings)
    case 'set-session-note':
      return setSessionNote(state, action.sessionId, action.note)
    case 'delete-all':
      return createInitialData()
    case 'load-snapshot':
      return action.data
    default:
      return state
  }
}

/** Commit boundary: finite kg at or above 0, and a whole rep count of at least 1. */
export function commitWeightAndReps(
  weightKg: number | null,
  reps: number | null,
): { weightKg: number; reps: number } | null {
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg < 0) return null
  if (typeof reps !== 'number' || !Number.isFinite(reps) || !Number.isInteger(reps) || reps < 1) return null
  return { weightKg: weightKg === 0 ? 0 : weightKg, reps }
}

export function commitBlockReason(weightKg: number | null, reps: number | null): string | null {
  if (commitWeightAndReps(weightKg, reps)) return null
  const weightOk = typeof weightKg === 'number' && Number.isFinite(weightKg) && weightKg >= 0
  const repsPresent = typeof reps === 'number' && Number.isFinite(reps)
  if (!weightOk || !repsPresent) return 'Enter weight and reps'
  return 'Enter at least 1 rep'
}

export function findLoggedSet(
  session: Session,
  setId: string,
): { exerciseIndex: number; setIndex: number; set: LoggedSet } | null {
  for (let exerciseIndex = 0; exerciseIndex < session.exercises.length; exerciseIndex += 1) {
    const exercise = session.exercises[exerciseIndex]
    if (!exercise) continue
    const setIndex = exercise.sets.findIndex((set) => set.id === setId)
    const set = exercise.sets[setIndex]
    if (setIndex >= 0 && set) return { exerciseIndex, setIndex, set }
  }
  return null
}

function startWorkout(state: AppData, routineId: string): AppData {
  if (unfinishedSessions(state).length > 0) return state
  const routine = state.routines.find((item) => item.id === routineId)
  if (!routine || routine.exercises.length === 0) return state
  const session: Session = {
    id: createId(),
    routineId: routine.id,
    routineName: routine.name,
    isSample: routine.isSample,
    startedAt: new Date().toISOString(),
    exercises: routine.exercises.map((exercise) => ({
      routineExerciseId: exercise.id,
      name: exercise.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      restSeconds: exercise.restSeconds,
      sets: [],
    })),
  }
  return {
    ...state,
    sessions: [...state.sessions, session],
    active: {
      sessionId: session.id,
      exerciseIndex: 0,
      setIndex: 0,
      phase: 'logging',
      draft: draftForCursor(
        { ...state, sessions: [...state.sessions, session] },
        session,
        0,
        0,
      ),
    },
  }
}

function discardWorkout(state: AppData): AppData {
  const open = unfinishedSessions(state)
  if (open.length !== 1) return state
  const sessionId = open[0]?.id
  if (!sessionId) return state
  return {
    ...state,
    sessions: state.sessions.filter((session) => session.id !== sessionId),
    active: state.active?.sessionId === sessionId ? null : state.active,
  }
}

function attachActive(state: AppData): AppData {
  const open = unfinishedSessions(state)
  if (open.length !== 1) return state
  const session = open[0]
  if (!session) return state
  if (state.active?.sessionId === session.id) return state
  const cursor = cursorFromLoggedSets(session)
  return {
    ...state,
    active: {
      sessionId: session.id,
      exerciseIndex: cursor.exerciseIndex,
      setIndex: cursor.setIndex,
      phase: 'logging',
      draft: draftForCursor(state, session, cursor.exerciseIndex, cursor.setIndex),
    },
  }
}

function cleanDraftWeight(value: number | null): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
  return value === 0 ? 0 : value
}

function cleanDraftReps(value: number | null): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return undefined
  }
  return value
}

function openSession(state: AppData): { index: number; session: Session } | null {
  const active = state.active
  if (!active) return null
  const index = state.sessions.findIndex((session) => session.id === active.sessionId)
  const session = state.sessions[index]
  if (index < 0 || !session || session.finishedAt !== undefined) return null
  return { index, session }
}

function replaceSession(state: AppData, index: number, session: Session): AppData {
  return {
    ...state,
    sessions: state.sessions.map((item, itemIndex) => (itemIndex === index ? session : item)),
  }
}

function updateDraft(state: AppData, weightKg: number | null, reps: number | null): AppData {
  const active = state.active
  if (!active || active.phase !== 'logging') return state
  const nextWeight = cleanDraftWeight(weightKg)
  const nextReps = cleanDraftReps(reps)
  if (nextWeight === undefined || nextReps === undefined) return state
  const draft = active.draft
  if (
    draft.weightKg === nextWeight &&
    draft.reps === nextReps &&
    draft.source === 'edited' &&
    draft.sourceLabel === undefined
  ) {
    return state
  }
  return {
    ...state,
    active: {
      ...active,
      draft: { weightKg: nextWeight, reps: nextReps, source: 'edited' },
    },
  }
}

function commitSet(state: AppData): AppData {
  const active = state.active
  if (!active || active.phase !== 'logging') return state
  const open = openSession(state)
  if (!open) return state
  const exercise = open.session.exercises[active.exerciseIndex]
  if (!exercise) return state
  if (active.setIndex >= exercise.targetSets || exercise.sets.length !== active.setIndex) return state
  const values = commitWeightAndReps(active.draft.weightKg, active.draft.reps)
  if (!values) return state

  const logged: LoggedSet = {
    id: createId(),
    weightKg: values.weightKg,
    reps: values.reps,
    doneAt: new Date().toISOString(),
  }
  const exercises = open.session.exercises.map((item, index) =>
    index === active.exerciseIndex ? { ...item, sets: [...item.sets, logged] } : item,
  )
  const updated: Session = { ...open.session, exercises }
  const isLastSet = active.setIndex + 1 >= exercise.targetSets
  const isLastExercise = active.exerciseIndex + 1 >= open.session.exercises.length
  if (isLastSet && isLastExercise) {
    const finished: Session = { ...updated, finishedAt: new Date().toISOString() }
    return { ...replaceSession(state, open.index, finished), active: null }
  }

  const exerciseIndex = isLastSet ? active.exerciseIndex + 1 : active.exerciseIndex
  const setIndex = isLastSet ? 0 : active.setIndex + 1
  const nextState = replaceSession(state, open.index, updated)
  const nextSession = nextState.sessions[open.index]
  if (!nextSession) return state
  const restMs = exercise.restSeconds * 1000
  const nextActive: ActiveState = {
    sessionId: updated.id,
    exerciseIndex,
    setIndex,
    phase: 'resting',
    restEndsAt: Date.now() + restMs,
    restTotalMs: restMs,
    lastCommittedSetId: logged.id,
    draft: draftForCursor(nextState, nextSession, exerciseIndex, setIndex),
  }
  return { ...nextState, active: nextActive }
}

function undoLastSet(state: AppData): AppData {
  const active = state.active
  if (!active?.lastCommittedSetId) return state
  const open = openSession(state)
  if (!open) return state
  const found = findLoggedSet(open.session, active.lastCommittedSetId)
  if (!found) return state
  const exercise = open.session.exercises[found.exerciseIndex]
  if (!exercise || found.setIndex !== exercise.sets.length - 1) return state
  const exercises = open.session.exercises.map((item, index) =>
    index === found.exerciseIndex ? { ...item, sets: item.sets.slice(0, -1) } : item,
  )
  const updated: Session = { ...open.session, exercises }
  const nextState = replaceSession(state, open.index, updated)
  return {
    ...nextState,
    active: {
      sessionId: updated.id,
      exerciseIndex: found.exerciseIndex,
      setIndex: found.setIndex,
      phase: 'logging',
      draft: {
        weightKg: found.set.weightKg,
        reps: found.set.reps,
        source: 'edited',
      },
    },
  }
}

function skipExercise(state: AppData): AppData {
  const active = state.active
  if (!active || active.phase !== 'logging') return state
  const open = openSession(state)
  if (!open) return state
  const nextIndex = active.exerciseIndex + 1
  if (nextIndex >= open.session.exercises.length) {
    const anySets = open.session.exercises.some((exercise) => exercise.sets.length > 0)
    if (!anySets) return discardWorkout(state)
    const finished: Session = { ...open.session, finishedAt: new Date().toISOString() }
    return { ...replaceSession(state, open.index, finished), active: null }
  }
  const nextActive: ActiveState = {
    sessionId: open.session.id,
    exerciseIndex: nextIndex,
    setIndex: 0,
    phase: 'logging',
    draft: draftForCursor(state, open.session, nextIndex, 0),
  }
  if (active.lastCommittedSetId) nextActive.lastCommittedSetId = active.lastCommittedSetId
  return { ...state, active: nextActive }
}

function editSet(state: AppData, setId: string, weightKg: number, reps: number): AppData {
  const values = commitWeightAndReps(weightKg, reps)
  if (!values) return state

  const open = openSession(state)
  if (open) {
    const active = state.active
    if (!active) return state
    const found = findLoggedSet(open.session, setId)
    if (!found) return state
    const exercises = open.session.exercises.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== found.exerciseIndex) return exercise
      return {
        ...exercise,
        sets: exercise.sets.map((set) =>
          set.id === setId
            ? { ...set, weightKg: values.weightKg, reps: values.reps, editedAt: new Date().toISOString() }
            : set,
        ),
      }
    })
    return {
      ...replaceSession(state, open.index, { ...open.session, exercises }),
      active,
    }
  }

  let changed = false
  const sessions = state.sessions.map((session) => {
    if (session.finishedAt === undefined) return session
    const found = findLoggedSet(session, setId)
    if (!found) return session
    changed = true
    const exercises = session.exercises.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== found.exerciseIndex) return exercise
      return {
        ...exercise,
        sets: exercise.sets.map((set) =>
          set.id === setId
            ? { ...set, weightKg: values.weightKg, reps: values.reps, editedAt: new Date().toISOString() }
            : set,
        ),
      }
    })
    return { ...session, exercises }
  })
  return changed ? { ...state, sessions } : state
}

function startSet(state: AppData): AppData {
  const active = state.active
  if (!active || (active.phase !== 'resting' && active.phase !== 'rest-over')) return state
  return {
    ...state,
    active: {
      sessionId: active.sessionId,
      exerciseIndex: active.exerciseIndex,
      setIndex: active.setIndex,
      phase: 'logging',
      ...(active.lastCommittedSetId ? { lastCommittedSetId: active.lastCommittedSetId } : {}),
      draft: active.draft,
    },
  }
}

function expireRest(state: AppData, now: number): AppData {
  const active = state.active
  if (!active || active.phase !== 'resting') return state
  if (active.restEndsAt !== undefined && active.restEndsAt > now) return state
  return { ...state, active: toRestOverActive(active) }
}

function adjustRest(state: AppData, deltaMs: number, now: number): AppData {
  const active = state.active
  if (!active || active.phase !== 'resting') return state
  if (active.restEndsAt === undefined || active.restTotalMs === undefined) return state
  const next = adjustRestTiming(active.restEndsAt, active.restTotalMs, deltaMs, now)
  if (next.expired) {
    return { ...state, active: toRestOverActive(active) }
  }
  return {
    ...state,
    active: {
      ...active,
      restEndsAt: next.restEndsAt,
      restTotalMs: next.restTotalMs,
    },
  }
}

function updateSettings(state: AppData, patch: Partial<Settings>): AppData {
  const next = { ...state.settings, ...patch }
  if (next.unit !== 'kg' && next.unit !== 'lb') return state
  if (next.reduceMotion !== 'system' && next.reduceMotion !== 'on' && next.reduceMotion !== 'off') {
    return state
  }
  if (
    typeof next.sound !== 'boolean' ||
    typeof next.vibration !== 'boolean' ||
    typeof next.keepScreenAwake !== 'boolean'
  ) {
    return state
  }
  return { ...state, settings: next }
}

function setSessionNote(state: AppData, sessionId: string, note: string): AppData {
  const trimmed = note.trim()
  let changed = false
  const sessions = state.sessions.map((session) => {
    if (session.id !== sessionId || session.finishedAt === undefined) return session
    changed = true
    if (!trimmed) {
      const { note: _removed, ...rest } = session
      return rest as Session
    }
    return { ...session, note: trimmed }
  })
  if (!changed) return state
  let active = state.active
  if (active?.sessionId === sessionId) active = null
  return { ...state, sessions, active }
}
