import { routeTitle, type RouteName } from '../router'

export function Later({ route }: { route: Exclude<RouteName, 'today' | 'routines' | 'workout'> }) {
  return (
    <>
      <h1 id="screen-title" tabIndex={-1}>
        {routeTitle(route)}
      </h1>
      <p>This screen arrives in a later step.</p>
      <a className="primary" href="#/today">
        Back to Today
      </a>
    </>
  )
}
