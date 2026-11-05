import { SampleMark } from '../components/SampleMark'
import { resumeHash, unfinishedSessions } from '../state/repair'
import { useStore } from '../state/store'

export function Finish() {
  const store = useStore()
  const active = unfinishedSessions(store.data)[0] ?? null
  const finished = [...store.data.sessions]
    .filter((session) => session.finishedAt !== undefined)
    .sort((a, b) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1))[0]

  return (
    <>
      <h1 id="screen-title" tabIndex={-1}>
        Finish
      </h1>
      {active ? <p>This workout is still in progress.</p> : null}
      {!active && finished ? (
        <p>
          {finished.routineName} is saved. {finished.isSample ? <SampleMark /> : null}
        </p>
      ) : null}
      {!active && !finished ? <p>No finished workout to show.</p> : null}
      <p>Finish arrives in step 4.</p>
      <a className="primary" href={active ? resumeHash(store.data) : '#/today'}>
        {active ? 'Back to workout' : 'Back to Today'}
      </a>
    </>
  )
}
