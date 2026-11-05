# SPOT - UI/UX Specification

## 1. Design principles (in priority order)

1. **Glanceable beats dense.** The two states (logging, resting) have different visual modes. Logging = focused form. Resting = full-screen display. Never mix them.
2. **One primary action per state.** It is the biggest, highest-contrast element, bottom-center in the thumb zone.
3. **Every number earns its place.** Tabular figures, aligned to a grid, no orphan text, no decorative numerals.
4. **Physical, not digital-looking.** Warm dark surface, soft elevation, motion that feels like mass (ease-out, 150-250ms), no bounce, no gimmicks.
5. **Honest UI.** Pre-filled values are visually distinct from logged values (carried-over tint + provenance caption) until the user touches them. No fake badges, no fake streaks, no placeholder charts.

## 2. Visual system (tokens for theme.css)

```
/* Color - warm dark, one accent */
--bg:            #121110   /* warm near-black */
--surface:       #1C1A17   /* cards */
--surface-2:     #26231F   /* raised sheet */
--text:          #F2EFE9   /* warm white */
--text-dim:      #9A938A   /* secondary - check AA on --surface */
--accent:        #D4F34E   /* electric lime - primary action, current set */
--accent-ink:    #121110   /* text ON accent */
--warn:          #FF6B57   /* destructive/undo-adjacent actions only */
--rest-bg:       #0E1A12   /* rest state shifts to a calm green-black - MODE change,
                              never the sole signal: numerals + label change too */

/* Type - system stack, no web fonts (privacy + offline) */
--font: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
Numbers: font-variant-numeric: tabular-nums; everywhere.
Scale: 13 / 15 / 17 / 22 / 28 / 40 / rest-numerals min(30vw, 220px)

/* Space - 8px grid: 4 8 12 16 24 32 48 */
/* Radius: 12px cards, 16px sheet, 999px pills */
/* Elevation: single soft shadow, 0 8px 24px rgba(0,0,0,.35) on sheet only */
```

## 3. Interaction rules

- **Targets:** >= 48px on touch. Primary action full-width, bottom, min 56px tall.
- **Sheet, not modal:** value editing and set editing slide up from bottom; the workout stays visible behind; swipe-down or Escape closes.
- **Steppers:** - and + flank the value; hold repeats; weight steps 2.5kg (0.5kg via sheet's fine control); reps step 1.
- **Undo and correction:** after each committed set a toast with an Undo action appears (role=status, at least 6 seconds, paused while hovered or focused, dismissible, keyboard-reachable). It is a convenience, not the only path: the last committed set stays visible as an editable row ("Last set: 60 kg x 8 - Edit") on both Workout and Rest screens, and any set can be edited from History. No confirmation dialogs mid-workout.
- **Transitions:** 150-250ms ease-out transform/opacity only. State change Workout<->Rest is a 200ms vertical slide - the two modes feel like two physical positions of one object.
- **Reduced motion:** when on (system or toggle), all transitions become instant cuts. No exceptions, including the rest ring.
- **Haptics/sound:** short beep + 200ms vibration at rest end; a softer tick when logging a set. Both toggleable; preview plays when enabling.
- **Focus:** every interactive element has a visible focus ring (2px accent outline, offset 2px). Route change moves focus to the screen's h1.

## 4. Screen visual specs

### Today
Top: date small-caps dimmed. Center: day name at 28px, exercise rows (name 17px, "last: 60 kg x 8" in --text-dim 13px). Bottom: lime "Start workout" bar. If resuming: bar reads "Resume - Set 3 of 4 - Bench Press" (status up front).

### Workout (logging mode)
Header: "Set 2 of 4" 13px dimmed + exercise name 22px. Middle: two value blocks side by side (WEIGHT kg / REPS), values 40px tabular, pre-filled from the previous set or last session with a small provenance caption ("from set 1" / "from last Push Day") in --text-dim; carried-over values use a distinct tint until the user touches them, so pre-filled is never confused with logged. Completed sets: compact rows above, dimmed, with check icon + values. Bottom: full-width lime "Set done" (56px). Undo is a small text button, never near the primary action.

### Rest (hero)
Full-bleed --rest-bg. Numerals min(30vw,220px) tabular, center. Above: "REST" 13px letter-spaced. Below numerals: "Next: Bench Press - Set 2 of 4 - 60 kg x 8" at 17px. Thin progress ring behind numerals as secondary cue. Bottom row: -15s | +15s | Skip, 48px, outline style (not filled). At zero: numerals become a static "Go", tone/vibration if enabled and available, then a 200ms slide back to Workout after about 2s (instant under reduced motion). No flashing or strobing. If the user returns after the end time, show the calm `rest-over` state with one primary "Start set N" button instead; nothing replays.

### Finish
"Done for today" 28px. Stats as 2x2 grid (Duration / Exercises / Sets / Volume), values 28px tabular. Comparison line only if computable from real history. Session note field collapsed behind "Add a note" disclosure. Primary: "Done".

### History
Session rows: day name, date, duration, volume. Drill-in: set-by-set table. Per-exercise trend: simple line, >= 2 real points only, axis labeled, no smoothing tricks.

### Empty/error states (designed, not default)
- No routines: illustration-free empty state, one line of copy, one action ("Create my first day") + sample option.
- No history: "Your history starts after your first logged workout."
- Import failure: plain-language error naming the problem (bad file, wrong version), data untouched.

## 5. Acceptance bar (check before calling any screen done)

- [ ] Readable with phone at arm's length; rest screen readable at 2 meters
- [ ] One primary action per state, in thumb zone, >= 48px
- [ ] All numbers tabular, aligned, no clipping at 200% text zoom
- [ ] Color never the only signal (icons + labels on set states and mode changes)
- [ ] Pre-filled values unmistakable as carried-over references, never stored without the "Set done" tap
- [ ] A wrong set can be corrected after the undo toast has gone (Last set row / History)
- [ ] Rest end causes no flashing; returning after expiry shows `rest-over`, not a replay
- [ ] Storage-failure banner visible and keyboard-reachable (test by blocking site data)
- [ ] kg/lb switch changes display only; values round-trip
- [ ] Every control has hover/active/focus/disabled states
- [ ] Reduced-motion mode: zero animation, verified by toggle
- [ ] Keyboard: full flow Today -> log 3 sets -> rest -> finish, no mouse
- [ ] Contrast AA on all text (check --text-dim on --surface especially)
- [ ] No lorem ipsum, no "Exercise 1 / Workout A" filler - sample content is realistic and labeled SAMPLE
