import { useEffect, useState } from 'react'
import { Banners } from './components/Banners'
import { CommitToast } from './components/CommitToast'
import { RestAnnounceProvider } from './components/RestAnnounce'
import { parseHash, routeTitle, type RouteName } from './router'
import { Finish } from './screens/Finish'
import { History } from './screens/History'
import { Recovery } from './screens/Recovery'
import { Rest } from './screens/Rest'
import { Routines } from './screens/Routines'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { Workout } from './screens/Workout'
import { useStore } from './state/store'

export function App() {
  const store = useStore()
  const [route, setRoute] = useState<RouteName>(() => parseHash(window.location.hash))
  const [restEndMessage, setRestEndMessage] = useState<string | null>(null)

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

  useEffect(() => {
    setRestEndMessage(null)
  }, [route])

  if (store.recovery) return <Recovery />

  const title = routeTitle(route)
  const flowRoute = route === 'workout' || route === 'rest'

  return (
    <RestAnnounceProvider announce={setRestEndMessage}>
      <div className={`shell${route === 'rest' ? ' shell-rest' : ''}`}>
        <header className="topbar">
          <p className="brand">SPOT</p>
          <nav className="nav" aria-label="Primary">
            <a href="#/today" aria-current={route === 'today' ? 'page' : undefined}>
              Today
            </a>
            <a href="#/routines" aria-current={route === 'routines' ? 'page' : undefined}>
              Routines
            </a>
            <a href="#/history" aria-current={route === 'history' ? 'page' : undefined}>
              History
            </a>
            <a href="#/settings" aria-current={route === 'settings' ? 'page' : undefined}>
              Settings
            </a>
          </nav>
        </header>
        <div className="sr-only" aria-live="polite">
          {restEndMessage ?? title}
        </div>
        <Banners />
        <CommitToast />
        <main className={flowRoute ? 'session-flow' : undefined}>
          {route === 'today' ? <Today /> : null}
          {route === 'routines' ? <Routines /> : null}
          {route === 'workout' ? <Workout /> : null}
          {route === 'rest' ? <Rest /> : null}
          {route === 'finish' ? <Finish /> : null}
          {route === 'history' ? <History /> : null}
          {route === 'settings' ? <Settings /> : null}
        </main>
      </div>
    </RestAnnounceProvider>
  )
}
