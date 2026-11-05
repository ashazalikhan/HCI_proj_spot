# SPOT - Implementation Plan (single build sequence)

Deadline driving this plan: Drive upload before **Thu 5 Nov, 23:59 IST** (folder `<RegistrationNo>_<Name>_HCI_MiniProject` with report PDF + source + demo video). In-person demo is on a later, professor-approved date.

## Build order (6 steps, each ends in a working app)

### Step 1 - Scaffold + design system + data layer
**Cursor prompt 1 (paste as-is):**

> Create a new Vite + React + TypeScript app called "spot", a personal gym workout companion. No backend, no accounts, no external assets: system font stack only, inline SVG icons, no analytics. Use hash routing (#/today, #/routines, #/workout, #/rest, #/finish, #/history, #/settings).
>
> Read docs/02-TRD.md and implement exactly: (a) the data schema as src/state/types.ts (including ActiveState, session snapshots, isSample and kg-canonical units exactly as in section 3 of the TRD), (b) a reducer-based store in src/state/store.ts, (c) localStorage persistence in src/state/storage.ts that wraps every read/write in try/catch, surfaces a visible "can't save" banner on failure, validates on load, never overwrites invalid or unknown-version data (backup key + recovery screen), and supports validated JSON export/import, (d) history derivation in src/state/history.ts that computes per-exercise pre-fill values (previous set this session, else same set number from last session) from REAL logged sessions only - pre-filled values are committed to history ONLY via the "Set done" tap, never silently.
>
> Read docs/04-UI-UX.md and implement theme.css with the exact design tokens (warm dark theme, lime accent #D4F34E, 8px grid, tabular-nums for all numbers, 48px minimum touch targets, focus-visible rings, prefers-reduced-motion support).
>
> Build the Routines screen and Today screen only: create/edit workout days with exercises (name, target sets, target reps, rest seconds), one clearly labeled SAMPLE day, Today screen listing a day's exercises with last-session values as secondary text, and a "Start workout" button that creates an in-progress session, persists `active`, and routes to a bounded placeholder at #/workout showing the day name, "Workout screen arrives in step 2", and a "Back to Today" button (the session stays resumable from Today). Empty states per the UI/UX doc. Stop there - do not build the real workout logging UI yet.

**Acceptance:** can create a day, add exercises, see it on Today, refresh without losing anything, export the JSON; Start workout lands on the placeholder (no dead route) and Today then shows Resume; blocking site data in the browser shows the banner; corrupt data in storage is not overwritten.

### Step 2 - Workout logging state
**Prompt 2 (gist):** implement the Workout screen per docs/03-APP-FLOW.md and 04-UI-UX.md: current set header, pre-filled inputs fed from history.ts with provenance labels and carried-over styling, large steppers, bottom-sheet value editor, completed-set list, giant "Set done", undo last set, skip exercise, "Finish workout" on last set. Sets are written ONLY on "Set done".
**Acceptance:** common case is one tap on "Set done" with pre-filled values (provenance visible); adjustments via steppers; values appear from a previous set or previous real session correctly sourced; undo toast works; keyboard-only flow works.

### Step 3 - Rest state (the hero)
**Prompt 3 (gist):** full-screen rest state per the UI/UX spec: persisted `restEndsAt` as the only timer source (remaining = restEndsAt - Date.now(), recomputed on tick and visibilitychange), huge tabular numerals, next-set preview, +15s/-15s/Skip, `rest-over` state per TRD section 4 (static "Go", tone/vibration only if enabled and available, no flashing, calm "Start set N" state when returning after expiry, nothing replays), transition with reduced-motion fallback, best-effort Wake Lock, aria-hidden numerals with one polite announcement at end, and the "Last set - Edit" row.
**Acceptance:** readable at 2m; refresh and tab-backgrounding mid-rest show correct remaining time or `rest-over`; no flashing at rest end; sound/vibration toggles work where supported; reduced motion shows instant cuts; a wrong set is correctable after the toast is gone.

### Step 4 - Finish + History + Settings
**Prompt 4 (gist):** Finish screen (duration, exercises, sets, volume; comparison line only from real history; optional session note), History (session list, drill-in, per-exercise trend with >= 2 real points), Settings (unit, sound, vibration, wake, reduce motion, export/import, delete-all with typed confirm).
**Acceptance:** complete a full workout end-to-end; history shows only real entries; export -> clear -> import restores exactly.

### Step 5 - Polish + accessibility pass (this produces the report's iteration log)
Run the acceptance bar in docs/04-UI-UX.md section 5 on every screen, on a real phone. Log every defect found and fixed in `docs/iteration-log.md` with date and one-line cause (this becomes report Ch4's iteration section). Prompt Cursor with the specific defects, one batch at a time.

### Step 5.5 - PWA checks + README
Add manifest + icons + a precaching service worker and run the three verification checks in TRD section 4 (DevTools manifest, DevTools offline reload, real phone in airplane mode). Report only what passed. Write the README with a "Why each screen looks this way" section - short design-rationale notes pulled from docs/01-PRD.md's HCI map. This README is both repo documentation and raw material for the report.

### Step 6 - Report assets
- Screenshots: every screen + both modes, phone-sized, real content (no filler).
- 2-min demo video: screen recording, one full mini-workout (2 exercises x 2 sets with real rest), narrated: problem -> pre-fill from real history -> logging -> rest -> finish -> history.
- Write the report using the structure map in docs/01-PRD.md section 9. His name + registration number on the cover and folder.

## Submission checklist (from the official guidelines doc)
- [ ] Drive folder named exactly `<RegistrationNo>_<Name>_HCI_MiniProject`
- [ ] Inside: complete project report PDF + source code (zip or repo link) + demo video
- [ ] Uploaded before Thu 5 Nov, 23:59 IST
- [ ] 20-30s clip of the app in real use (the pasted research's suggestion - fold into the 2-min video or keep as a standalone quick demo)
- [ ] Printed/spiral-bound report ready before the professor-approved later demo date (not needed for tonight's upload)

## Iteration log template (docs/iteration-log.md)
```
| Date | Screen | Defect found (how) | Fix | Principle violated |
```
Example row pattern only - fill with REAL defects found during Step 5, never pre-written.

## Rules for the whole build
- No backend, accounts, analytics, web fonts, stock images, or CDNs - the privacy claim depends on it.
- No invented workout data, study results, or health claims anywhere (app, video, report).
- Mock/sample content stays labeled SAMPLE and deletable; user history is always real.
- One plan. If Cursor suggests extra features mid-build, they go to a "later" list, not into v1.
