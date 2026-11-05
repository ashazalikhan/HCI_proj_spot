export interface AppData {
  version: 1
  routines: Routine[]
  sessions: Session[]
  active: ActiveState | null
  settings: Settings
}

export interface Routine {
  id: string
  name: string
  isSample: boolean
  exercises: RoutineExercise[]
}

export interface RoutineExercise {
  id: string
  name: string
  targetSets: number
  targetReps: number
  restSeconds: number
  startWeightKg?: number
}

export interface Session {
  id: string
  routineId: string
  routineName: string
  isSample: boolean
  startedAt: string
  finishedAt?: string
  note?: string
  exercises: SessionExercise[]
}

/** Snapshot of the routine exercise at session start. */
export interface SessionExercise {
  routineExerciseId: string
  name: string
  targetSets: number
  targetReps: number
  restSeconds: number
  sets: LoggedSet[]
}

export interface LoggedSet {
  id: string
  weightKg: number
  reps: number
  doneAt: string
  editedAt?: string
}

export type DraftSource =
  | 'previous-set'
  | 'last-session'
  | 'starting-target'
  | 'edited'
  | 'none'

export interface Draft {
  weightKg: number | null
  reps: number | null
  source: DraftSource
  sourceLabel?: string
}

export interface ActiveState {
  sessionId: string
  exerciseIndex: number
  setIndex: number
  phase: 'logging' | 'resting' | 'rest-over'
  restEndsAt?: number
  restTotalMs?: number
  lastCommittedSetId?: string
  draft: Draft
}

export interface Settings {
  unit: 'kg' | 'lb'
  sound: boolean
  vibration: boolean
  keepScreenAwake: boolean
  reduceMotion: 'system' | 'on' | 'off'
}
