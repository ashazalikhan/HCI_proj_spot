# SPOT - Technical Requirements Document (includes Data Schema)

## 1. Stack

- **Vite + React + TypeScript.** Static single-page app, no build-time backend.
- **No server, no account, no database service.** All state lives in the browser.
- **No external runtime assets:** system font stack only (no Google Fonts), no stock images, no icon CDN (inline SVG icons), no analytics, no telemetry. This is what makes the privacy claim true.
- Hash-based routes (`#/today`, `#/workout`, `#/rest`, `#/finish`, `#/history`, `#/routines`, `#/settings`) so every screen has an address and a refresh mid-workout resumes correctly.

## 2. Architecture

```
src/
  state/        store.ts        - single app state + reducer
                storage.ts      - localStorage read/write, versioning, export/import
                history.ts      - derives pre-fill values from real (non-sample) sessions only
  screens/      Today.tsx, Workout.tsx, Rest.tsx, Finish.tsx,
                History.tsx, Routines.tsx, Settings.tsx
  components/   Stepper.tsx, Sheet.tsx, PrefillInput.tsx, BigButton.tsx, ...
  audio/        beep.ts         - Web Audio rest-end tone (generated, no audio file)
  theme.css     - design tokens (colors, spacing, type) as CSS variables
```

- One reducer owns all mutations. Screens are pure renderers of state.
- Every state change is written to localStorage immediately. Writes can fail (quota, private mode, storage disabled), so every write goes through `storage.ts`, which reports failure to the UI (see section 3.3). Nothing is silently dropped.

## 3. Data schema (localStorage key `spot.v1`)

### 3.1 Types

```ts
interface AppData {
  version: 1;
  routines: Routine[];          // user-entered, plus at most one labeled sample
  sessions: Session[];          // finished sessions, plus the in-progress one if any
  active: ActiveState | null;   // exactly what is needed to resume after refresh
  settings: Settings;
}

interface Routine {
  id: string;
  name: string;                 // e.g. "Push Day" - user-typed, or the sample
  isSample: boolean;            // true only for the built-in sample day
  exercises: RoutineExercise[];
}

interface RoutineExercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;          // default 90
  startWeightKg?: number;       // optional starting point the user types in
}

interface Session {
  id: string;
  routineId: string;
  routineName: string;          // snapshot
  isSample: boolean;            // copied from the routine at start
  startedAt: string;            // ISO
  finishedAt?: string;          // absent while in progress
  note?: string;                // session-level, post-workout only
  exercises: SessionExercise[];
}

// SNAPSHOT of the routine exercise at session start. Editing or deleting the
// routine later never changes an in-progress or past session.
interface SessionExercise {
  routineExerciseId: string;
  name: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
  sets: LoggedSet[];
}

interface LoggedSet {
  id: string;
  weightKg: number;             // canonical unit is always kg
  reps: number;
  doneAt: string;               // ISO
  editedAt?: string;
}

interface ActiveState {
  sessionId: string;            // must match a Session without finishedAt
  exerciseIndex: number;
  setIndex: number;             // 0-based: the set being logged next
  phase: 'logging' | 'resting' | 'rest-over';
  restEndsAt?: number;          // epoch ms; the single source of truth for the timer
  restTotalMs?: number;         // for the progress ring only
  lastCommittedSetId?: string;  // target of undo / edit-last-set
  draft: {                      // the unconfirmed values currently in the inputs
    weightKg: number | null;
    reps: number | null;
    source: 'previous-set' | 'last-session' | 'starting-target' | 'edited' | 'none';
    sourceLabel?: string;       // e.g. "from set 1", "from last Push Day"
  };
}

interface Settings {
  unit: 'kg' | 'lb';
  sound: boolean;
  vibration: boolean;
  keepScreenAwake: boolean;
  reduceMotion: 'system' | 'on' | 'off';
}
```

### 3.2 Rules

**Pre-fill rule (hard requirement).** The draft opens pre-filled from the most recent source: the previous set in this session, else the same set number from the last REAL session of the same exercise (from `history.ts`), else the typed `startWeightKg`, else empty. Pre-filled values render with distinct carried-over styling plus the `sourceLabel`, so they cannot be mistaken for logged data. The draft is persisted so a refresh keeps partly adjusted values, but the draft is NOT history. A `LoggedSet` is created ONLY when the user taps "Set done".

**Sample data rule.** The sample day has `isSample: true`; sessions started from it copy that flag. Sample sessions are excluded from pre-fill, "vs last time" comparisons and per-exercise trends. History lists them under a clear SAMPLE tag so they can be deleted. Deleting the sample routine never touches real sessions.

**Unit rules.** Stored values are always kg. `unit: 'lb'` only changes display and input: displayed lb = kg x 2.20462262, shown to 1 decimal; typed lb is converted back to kg and kept at full precision (4 decimals) so a value round-trips without drifting. Stepper sizes: kg mode 2.5 on the main screen and in the editing sheet; lb mode 5 (fine 1). Switching units never rewrites stored data. Volume is computed in kg and converted for display.

**Resume rule.** On load, if `active` exists and its session exists without `finishedAt`, route to that session's phase. If `active` points to a missing or finished session, clear it and show a one-line notice. If `phase` is `resting` and `restEndsAt` has passed, treat it as `rest-over` (see section 4).

**Routine edits.** Editing routines never mutates any Session snapshot. Editing the routine of the in-progress session affects only the next session.

### 3.3 Storage failure, validation and recovery

localStorage is NOT guaranteed: it can be full, blocked (privacy settings), disabled, or cleared by the browser. Required behavior:

- `storage.ts` wraps every read and write in try/catch and returns a result. On write failure the app keeps working from in-memory state and shows a persistent, visible banner: "Can't save on this device. Your changes will be lost if you close this tab. Export a backup now." with an Export button (export works from memory).
- On load, parse and validate against the schema (version, required fields, types, `active` consistency). If data is missing: first-run state. If data is present but invalid or from an unknown version: do NOT overwrite. Copy the raw string to `spot.v1.backup` (if storage allows), show a recovery screen with "Export raw data", "Try import from backup file" and "Start fresh" (start fresh requires an explicit tap and a typed confirmation, and only then replaces data).
- Import: parse and validate fully in memory first; write only if valid; keep the previous data under `spot.v1.backup` until the new write succeeds; on failure restore and show a plain error. Never partial-write.
- Write order for risky operations (import, delete-all): write new data, read it back, compare, then remove the backup.
- The browser can still evict storage; the export file is the real backup and the Settings screen says so.

## 4. Browser APIs (progressive enhancements, each with a stated limit)

| API | Use | Limit to state honestly | Behavior when unavailable |
| --- | --- | --- | --- |
| localStorage | persistence | can throw, hit quota, be blocked or evicted (section 3.3) | in-memory mode + visible banner + export |
| Web Audio | rest-end tone | needs a prior user gesture; not reliable while locked/backgrounded | the visible state change still happens (static text + layout change, no flashing) |
| Vibration | rest-end haptic | not on iOS Safari; Android Chrome only | sound and visible state cover it |
| Screen Wake Lock | keep screen on while resting | partial support; released when tab hidden | timer stays correct anyway |
| prefers-reduced-motion | default motion setting | none | manual Settings toggle |

**Timer.** The single source of truth is `active.restEndsAt` (epoch ms), persisted. Remaining = `restEndsAt - Date.now()`, recomputed on a UI tick and on `visibilitychange`; never counted from tick increments. This guarantees correct state on return, NOT background execution.

**Rest end.** When remaining reaches 0 the state becomes `rest-over` and is persisted. If the app is visible: numerals change to a static "Go", the tone plays (if enabled and allowed), vibration fires (if enabled and supported), and the screen returns to Workout after a short pause (about 2 seconds, instant under reduced motion). No flashing, no strobing animation. If the app was hidden or the page reloaded after the end time: do NOT auto-play sound or animation; show the Rest screen in a calm `rest-over` state ("Rest over - Set 3 of 4") with one primary button, "Start set 3", which moves to Workout. `rest-over` is never lost: it persists until the user moves on.

**PWA / offline (precise).** A web app manifest alone does not make the app installable or work offline. Installability needs: HTTPS (or localhost), a valid manifest (name, start_url, display, icons incl. 192 and 512 px), and a registered service worker on browsers that require one. Offline cold-start needs a service worker that precaches the built assets. Verify, do not assume: (1) Chrome DevTools > Application > Manifest shows no installability errors; (2) tick Offline in DevTools, hard reload, app loads; (3) on the actual phone, add to home screen and open in airplane mode. iOS Safari "Add to Home Screen" behaves differently from Android Chrome install; test on his actual device and report what happens. Until those checks pass, the report says "works offline after first load" only if tested, otherwise says nothing.

## 5. Accessibility requirements (technical)

- Storage failure banner is `role=alert` and reachable by keyboard.
- One `h1` per screen; route change moves focus to it and announces via aria-live.
- All controls reachable by keyboard; Enter commits, Escape closes sheets, arrows adjust steppers.
- Visible focus ring everywhere; `:focus-visible` styled, never removed.
- Set states conveyed by icon + text + fill, never color alone.
- Contrast >= WCAG 2.2 AA for text and UI components; check tokens before shipping.
- Touch targets >= 48px (coarse pointer) / 44px minimum.
- Rest countdown: big numerals are `aria-hidden`; a polite live region announces "Rest over, next: Bench Press set 2" once at the end (not every second).

## 6. Testing

- Unit tests (Vitest) for `history.ts` (pre-fill derivation, empty history, sample exclusion, edited routines), `storage.ts` (export/import round-trip, version guard, write-failure result, corrupt data not overwritten), unit conversion round-trip, and timer recovery (`restEndsAt` in the past -> `rest-over`).
- Manual checklist per screen from the UI/UX doc's acceptance bar, run on a real phone at arm's length and at 2 meters for the rest screen.
- No invented metrics anywhere in the repo or report.
