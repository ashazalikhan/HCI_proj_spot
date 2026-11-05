import type { AppData, Routine, Settings } from './types'

export const defaultSettings: Settings = {
  unit: 'kg',
  sound: true,
  vibration: true,
  keepScreenAwake: false,
  reduceMotion: 'system',
}

export function createSampleRoutine(): Routine {
  return {
    id: 'sample-push-day',
    name: 'Sample Push Day',
    isSample: true,
    exercises: [
      { id: 'sample-bench', name: 'Bench Press', targetSets: 4, targetReps: 8, restSeconds: 90 },
      { id: 'sample-ohp', name: 'Overhead Press', targetSets: 3, targetReps: 8, restSeconds: 90 },
      {
        id: 'sample-incline',
        name: 'Incline Dumbbell Press',
        targetSets: 3,
        targetReps: 10,
        restSeconds: 90,
      },
      { id: 'sample-lateral', name: 'Lateral Raise', targetSets: 3, targetReps: 12, restSeconds: 60 },
      {
        id: 'sample-pushdown',
        name: 'Triceps Pushdown',
        targetSets: 3,
        targetReps: 12,
        restSeconds: 60,
      },
    ],
  }
}

export function createInitialData(): AppData {
  return {
    version: 1,
    routines: [createSampleRoutine()],
    sessions: [],
    active: null,
    settings: { ...defaultSettings },
  }
}
