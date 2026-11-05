import { useEffect, useState } from 'react'
import { Banners } from './components/Banners'
import { CommitToast } from './components/CommitToast'
import { parseHash, routeTitle, type RouteName } from './router'
import { Finish } from './screens/Finish'
import { Later } from './screens/Later'
import { Recovery } from './screens/Recovery'
import { Rest } from './screens/Rest'
import { Routines } from './screens/Routines'
import { Today } from './screens/Today'
import { Workout } from './screens/Workout'
import { useStore } from './state/store'

export function App() {
  const store = useStore()
  const [route, setRoute] = useState<RouteName>(() => parseHash(window.location.hash))

  useEffect(() => {
    if (!window.location.hash) window.location.hash = '#/today'
    function onHash() {
      setRoute(parseHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = store.data.settings.reduceMotion
  }, [store.data.settings.reduceMotion])

  useEffect(() => {
    document.getElementById('screen-title')?.focus({ preventScroll: true })
  }, [route, store.recovery])

  if (store.recovery) return <Recovery />

  const title = routeTitle(route)

  return (
    <div className="shell">
      <header className="topbar">
        <p className="brand">SPOT</p>
        <nav className="nav" aria-label="Primary">
          <a href="#/today" aria-current={route === 'today' ? 'page' : undefined}>
            Today
          </a>
          <a href="#/routines" aria-current={route === 'routines' ? 'page' : undefined}>
            Routines
          </a>
        </nav>
      </header>
      <div className="sr-only" aria-live="polite">
        {title}
      </div>
      <Banners />
      <CommitToast />
      <main>
        {route === 'today' ? <Today /> : null}
        {route === 'routines' ? <Routines /> : null}
        {route === 'workout' ? <Workout /> : null}
        {route === 'rest' ? <Rest /> : null}
        {route === 'finish' ? <Finish /> : null}
        {route === 'history' || route === 'settings' ? <Later route={route} /> : null}
      </main>
    </div>
  )
}
