export const routes = ['today', 'routines', 'workout', 'rest', 'finish', 'history', 'settings'] as const

export type RouteName = (typeof routes)[number]

export function parseHash(hash: string): RouteName {
  const name = hash.replace(/^#\/?/, '').split('/')[0]
  if (name === 'routines' || name === 'workout' || name === 'rest' || name === 'finish' || name === 'history' || name === 'settings') {
    return name
  }
  return 'today'
}

export function routeTitle(route: RouteName): string {
  switch (route) {
    case 'today':
      return 'Today'
    case 'routines':
      return 'Routines'
    case 'workout':
      return 'Workout'
    case 'rest':
      return 'Rest'
    case 'finish':
      return 'Finish'
    case 'history':
      return 'History'
    case 'settings':
      return 'Settings'
  }
}
