# SPOT - Product Requirements Document

**One line:** SPOT replaces the workout note in your Notes app with a tool built for the 60 seconds between sets: today's workout, the current set, your previous numbers already in place, and a rest screen you can read from across the room.

## 1. Problem

I keeps my workout routine as a static note and follow it in the gym. A note cannot tell me what i lifted last time, cannot time my rest, and forces me to hunt through text mid-workout with sweaty hands.

Existing trackers solve logging, but evidence shows they solve it as *data entry*, not as a between-sets interaction:

- Hevy and Strong (the market leaders, both 4.9-rated) use dense data-entry tables designed for looking at the phone up close. Verified in their App Store screenshots (Nov 5, 2026).
- Developers of gym apps document the same friction: keyboards fail with sweaty hands and reduced fine motor control; modals hide workout context; feature creep (RPE dropdowns, notes fields) adds taps between sets. (VigiGym Journal, Feb 2026; GymOps essay, Apr 2026 - sources at bottom.)

## 2. Users

- **Primary:** Ashaz, 5-day hostel gym routine, already knows his program. He needs a tool that keeps up with him, not one that coaches him.
- **Demo audience:** course coordinator evaluating an HCI mini-project. The demo must show *why* each design decision exists.

## 3. Design bar (the selling point)

**UI and feel are the product.** The bar is: fewer, better interactions. Every screen has one job and one primary action. The app must be operable one-handed, with tired hands, in 60-second windows of attention. If a feature adds a tap between sets, it does not ship.

## 4. Scope

### Must have (v1)
1. **Routine setup (once):** create workout days; each day has exercises with target sets, reps, rest seconds. Manual entry, fast, no account.
2. **Today screen:** pick today's day, see the exercise list with last session's values, one-tap start.
3. **Workout screen:** current exercise and set number always visible; weight/reps PRE-FILLED from the most recent source (previous set this session, else last session's same set number), visually marked as carried-over with its provenance ("from set 1" / "from last Push Day"); large steppers; one giant "Set done" action. Common case is one tap on "Set done". A pre-filled value is committed ONLY when the user taps "Set done" - stored history contains only user-confirmed entries, and the carried-over marking is never mistaken for logged data.
4. **Rest screen (the hero):** starts automatically the moment a set is logged; full-screen countdown readable from ~2 meters; next set preview; +15s / -15s / skip; sound + vibration at the end (each toggleable); screen stays awake while resting (best-effort).
5. **Finish screen:** session summary (exercises, sets, volume, duration) and an optional session note (post-workout, where friction is acceptable).
6. **History:** past sessions per day and per exercise; these real entries power the pre-fill next time. No fake history.
7. **Persistence:** localStorage for the active session (exercise, set, rest end time, unconfirmed draft) and history, with visible failure handling, validation that never overwrites unreadable data, and JSON export/import as the real backup. Sample data stays labeled and out of real history.
8. **Undo and correction:** undo via a toast (not a confirmation dialog, which is too slow with tired hands), plus a persistent "Last set - Edit" row so a mistake can still be corrected after the toast is gone; any set editable from History.

### Should have (if time)
- Installable PWA + offline cold-start: needs HTTPS, a valid manifest with icons and a service worker that precaches assets; verified with DevTools and on his phone before any claim is made (see TRD). Separate from localStorage, which only stores data.
- Screen Wake Lock during workout (progressive enhancement).
- kg/lb unit toggle.
- Edit routines between workouts (kept: SPOT must replace the Notes routine).

### Explicitly out of scope (with reasons)
- Social feed, leaderboards, exercise video library, AI coaching, RPE/RIR fields, accounts, backend sync. Each adds friction or build time without serving the between-sets job.
- Speech/voice input (evaluated and cut: adds failure modes in a loud gym).
- Prescribed workout splits or health claims. SPOT records what the user does; it does not prescribe training.

## 5. Competitor lessons folded in

| Lesson | Source | SPOT decision |
| --- | --- | --- |
| Pre-fill previous values; user confirms instead of typing | Hevy teardown | Pre-fill from real history (previous set, else same set number last session), provenance labeled |
| Previous values belong inside the input, not in a separate "PREV" column | GymOps essay | Pre-filled values live inside the inputs, with carried-over styling and a provenance caption |
| No keyboard between sets; steppers/sliders matched to range | VigiGym journal | Large steppers; tap value to open a bottom sheet with bigger controls |
| Bottom sheet, not modal - context stays visible | VigiGym journal | Value editing happens in a sheet over the workout screen |
| Large targets in thumb zone (Fitts); fewer visible options (Hick) | VigiGym journal | 48px+ targets, bottom-weighted layout, one primary action per state |
| Friction tolerance is contextual: zero mid-set, fine post-workout | GymOps essay | Session note lives on the finish screen only |
| Offline, on-device data is table stakes and a privacy feature | FitNotes / Hevy | localStorage + export. To make "nothing leaves the device" literally true: no external fonts, images, CDNs, analytics or telemetry - system font stack and local assets only (enforced in the TRD) |
| Both leaders' logging screens are dense up-close tables (their rest screens were not verified) | App Store screenshots of logging screens | SPOT sets its own bar: the rest screen is a full-screen, distance-readable display. This is a design goal, not a proven gap in competitors |

## 6. HCI rationale map (feeds report chapters 2 and 4)

| Principle | Source framework | Concrete SPOT decision |
| --- | --- | --- |
| Fitts's law | Card/Norman | "Set done" and rest controls >= 48px, bottom thumb zone; giant rest-time tap targets |
| Hick's law | Hick | One primary action per screen state; everything else visually secondary |
| Recognition over recall | Nielsen | Previous weight/reps pre-filled and provenance-labeled; next exercise previewed during rest |
| Visibility of system status | Nielsen | "Set 2 of 4 - Exercise 1 of 5" always on screen; rest countdown unmissable |
| User control and freedom | Nielsen | Undo last set; edit any set; skip/extend rest; no confirmation dialogs mid-set |
| Error prevention | Nielsen / Norman constraints | Steppers cannot go below 0; weight steps by 0.5kg; no destructive action without undo |
| Match with the real world | Nielsen | Gym language (sets, reps, kg), no abstract labels |
| Feedback timing / multimodal | Shneiderman; course Lec 31 | Rest end signalled by sound + vibration + visual change; each channel independently switchable |
| Context preservation | Norman's gulfs | Bottom sheet for value editing; workout stays visible beneath |
| Interaction speed | Course topic | All state changes local and instant; no loading states exist |
| Universal design / accessibility | WCAG 2.2, course Lec 29-30 | Contrast AA, color never the only carrier (icons + labels), full keyboard operation, visible focus, reduced-motion mode, scalable text |
| GOMS (as design model) | Card, Moran & Newell | Goal hierarchy: resume today's workout -> log set -> rest -> repeat. Operators deleted vs the notes-app baseline: no scrolling to find today, no memory lookup for last weight, no external timer app |

## 7. Honest limitations (state these in the report)

- localStorage can fail (full, blocked, disabled) or be evicted, and is per-browser, per-device; clearing site data erases history. SPOT shows a visible warning when it cannot save. The JSON export is the backup route, and the app says so.
- The privacy claim "workout data stays on this device" holds only because the app loads no external assets and runs no analytics (see TRD). If that ever changes, the claim comes down.
- Vibration API does not work on iOS Safari; sound covers that case. Wake Lock support varies by browser; the app works without it.
- Rest-end sound/vibration is only promised while the app is open or the screen is on. Mobile browsers do not reliably fire audio from a locked/backgrounded tab. What IS guaranteed: the timer is timestamp-based, so on returning to the app the state is always correct (still resting, or "Go"). This is stated plainly in the report - not papered over.
- No participant study is claimed. Evaluation is an expert self-review against the heuristics, golden rules and WCAG 2.2, plus - only if actually run - a small hallway test whose real results are reported whatever they show.

## 8. Evaluation plan (for report chapter 5)

1. **Expert self-review** during the polish pass: check the build against Nielsen's 10, Shneiderman's 8, WCAG 2.2 contrast/target size, keyboard flow, reduced motion. Log every defect found and fixed in the iteration log (see implementation plan).
2. **Optional hallway test (only if time):** 2-3 friends each log a 3-set exercise. Record real task time and errors. Report numbers exactly as measured, however small the sample. Do not invent participants or results.
3. **Baseline comparison for the report:** the notes-app workflow is the baseline - the report can honestly compare steps needed to answer "what did I lift last time?" in Notes vs SPOT, using his real note as the artifact.

## 9. How these docs map to the report

Reference structure (calibrated from a classmate's report; structure only, no shared content):
front matter (Declaration, Acknowledgment, Abstract, TOC, figures/tables) -> Ch1 Intro & objectives -> Ch2 Background (theory) -> Ch3 Methodology -> Ch4 Implementation (screens, controls table, feedback, accessibility, iteration log) -> Ch5 Results (evaluation + honest limits) -> Ch6 Conclusion + future scope -> references (cite Shneiderman, Norman, Nielsen, Galitz, WCAG - all in the course handout's reference list).

- This PRD -> Ch1, Ch2 (rationale map), Ch5 (evaluation plan)
- TRD -> Ch3 (methodology/architecture)
- App flow + UI/UX docs -> Ch4
- Iteration log (kept during build) -> Ch4.6-style section

## Sources (competitor evidence, checked Nov 5, 2026)

- https://www.tarunrai.com/post/hevy-app-teardown
- https://www.vigigym.com/journal/no-keyboard-in-the-gym
- https://dan1608272.substack.com/p/friction-free-ux-for-gym-apps-why
- https://kreidebuch.de/en/compare/best-workout-log-apps/ (feature matrix, last checked Oct 25, 2026; publisher is non-neutral - Kreidebuch is their own app)
- https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350
- https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
