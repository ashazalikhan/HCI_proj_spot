import { createId } from './ids'
import { draftForCursor } from './history'
import { cursorFromLoggedSets, unfinishedSessions } from './repair'
import { createSampleRoutine } from './seed'
import type { AppData, Session } from './types'

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
    case 'delete-routine':
      return {
        ...state,
        routines: state.routines.filter((routine) => routine.id !== action.routineId),
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
    default:
      return state
  }
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
