import { useStore } from '../state/store'

const WRITE_COPY =
  "Can't save on this device. Your changes will be lost if you close this tab. Export a backup now."

const READ_COPY =
  "Can't read saved data on this device. This tab is running in memory and will not overwrite whatever is already stored."

const CONFLICT_COPY =
  'Saved data was found on this device. Your unsaved edits in this tab were kept as a separate export and were not applied or merged.'

export function Banners() {
  const store = useStore()
  return (
    <>
      {store.readBlocked ? (
        <div className="banner" role="alert">
          <p>{READ_COPY}</p>
          <button className="ghost" type="button" onClick={() => store.exportAppData(store.data, 'spot-backup.json')}>
            Export
          </button>
        </div>
      ) : null}
      {store.writeFailed ? (
        <div className="banner" role="alert">
          <p>{WRITE_COPY}</p>
          <button className="ghost" type="button" onClick={() => store.exportAppData(store.data, 'spot-backup.json')}>
            Export
          </button>
        </div>
      ) : null}
      {store.conflictSnapshot ? (
        <div className="notice" role="status">
          <p>{CONFLICT_COPY}</p>
          <button
            className="ghost"
            type="button"
            onClick={() => store.exportAppData(store.conflictSnapshot as NonNullable<typeof store.conflictSnapshot>, 'spot-unsaved.json')}
          >
            Export unsaved edits
          </button>
        </div>
      ) : null}
    </>
  )
}
