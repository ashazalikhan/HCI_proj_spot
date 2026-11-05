import { useState } from 'react'
import { Banners } from '../components/Banners'
import { useStore } from '../state/store'

export function Recovery() {
  const store = useStore()
  const recovery = store.recovery
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!recovery) return null

  return (
    <main className="shell">
      <p className="sr-only" aria-live="polite">
        Saved data needs recovery
      </p>
      <Banners />
      <h1 id="screen-title" tabIndex={-1}>
        Saved data needs recovery
      </h1>
      <p>{recovery.reason}</p>
      <div className="stack">
        <button className="ghost" type="button" onClick={() => store.exportRaw(recovery.raw)}>
          Export raw data
        </button>
        <label className="field">
          <span>Try import from backup file</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              void file.text().then(
                (text) => {
                  const result = store.importText(text)
                  if (!result.ok) setError(result.message)
                },
                () => setError('That file could not be read. Saved data was not changed.'),
              )
            }}
          />
        </label>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="field">
          <span>Type DELETE to start fresh</span>
          <input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
        </label>
        <button
          className="danger"
          type="button"
          disabled={confirm !== 'DELETE'}
          onClick={() => {
            const result = store.startFresh()
            if (!result.ok) setError(result.message)
          }}
        >
          Start fresh
        </button>
      </div>
    </main>
  )
}
