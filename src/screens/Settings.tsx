import { useState } from 'react'
import {
  playRestTone,
  playRestVibration,
  unlockAudioFromGesture,
} from '../cues'
import { useStore } from '../state/store'
import type { Settings as SettingsType } from '../state/types'

export function Settings() {
  const store = useStore()
  const settings = store.data.settings
  const [importError, setImportError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState('')

  function patch(partial: Partial<SettingsType>) {
    store.dispatch({ type: 'update-settings', settings: partial })
  }

  function onSoundChange(enabled: boolean) {
    patch({ sound: enabled })
    if (enabled) {
      unlockAudioFromGesture()
      playRestTone({ ...settings, sound: true })
    }
  }

  function onVibrationChange(enabled: boolean) {
    patch({ vibration: enabled })
    if (enabled) playRestVibration({ ...settings, vibration: true })
  }

  return (
    <>
      <h1 id="screen-title" tabIndex={-1}>
        Settings
      </h1>
      <div className="stack settings-block">
        <fieldset className="field-group">
          <legend>Units</legend>
          <label className="row-inline">
            <input
              type="radio"
              name="unit"
              checked={settings.unit === 'kg'}
              onChange={() => patch({ unit: 'kg' })}
            />
            kg
          </label>
          <label className="row-inline">
            <input
              type="radio"
              name="unit"
              checked={settings.unit === 'lb'}
              onChange={() => patch({ unit: 'lb' })}
            />
            lb
          </label>
        </fieldset>
        <label className="row-inline">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(event) => onSoundChange(event.target.checked)}
          />
          Sound at rest end
        </label>
        <label className="row-inline">
          <input
            type="checkbox"
            checked={settings.vibration}
            onChange={(event) => onVibrationChange(event.target.checked)}
          />
          Vibration at rest end
        </label>
        <label className="row-inline">
          <input
            type="checkbox"
            checked={settings.keepScreenAwake}
            onChange={(event) => patch({ keepScreenAwake: event.target.checked })}
          />
          Keep screen awake while resting
        </label>
        <fieldset className="field-group">
          <legend>Reduced motion</legend>
          {(['system', 'on', 'off'] as const).map((value) => (
            <label key={value} className="row-inline">
              <input
                type="radio"
                name="reduceMotion"
                checked={settings.reduceMotion === value}
                onChange={() => patch({ reduceMotion: value })}
              />
              {value === 'system' ? 'Use system setting' : value === 'on' ? 'On' : 'Off'}
            </label>
          ))}
        </fieldset>
        <p className="dim">
          Vibration is not available on iOS Safari. Wake Lock support varies; the rest timer stays
          correct without it.
        </p>
        <button
          className="ghost"
          type="button"
          onClick={() => store.exportAppData(store.data, 'spot-backup.json')}
        >
          Export JSON backup
        </button>
        <p className="dim">
          This file is the real backup. The browser can clear or evict site data at any time.
        </p>
        <label className="field">
          <span>Import JSON backup</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              setImportError(null)
              const file = event.target.files?.[0]
              if (!file) return
              void file.text().then(
                (text) => {
                  const result = store.importText(text)
                  if (!result.ok) setImportError(result.message)
                },
                () => setImportError('That file could not be read. Saved data was not changed.'),
              )
              event.target.value = ''
            }}
          />
        </label>
        {importError ? (
          <p className="error" role="alert">
            {importError}
          </p>
        ) : null}
        <label className="field">
          <span>Type DELETE to delete all data</span>
          <input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
        </label>
        <button
          className="danger"
          type="button"
          disabled={confirm !== 'DELETE'}
          onClick={() => {
            setDeleteError(null)
            const result = store.deleteAll()
            if (!result.ok) setDeleteError(result.message)
            else setConfirm('')
          }}
        >
          Delete all data
        </button>
        {deleteError ? (
          <p className="error" role="alert">
            {deleteError}
          </p>
        ) : null}
      </div>
    </>
  )
}
