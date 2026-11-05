# SPOT - App Flow

## Journey overview

```
Setup (once)          Every gym visit
┌───────────┐        ┌───────┐   ┌─────────┐   ┌──────┐   ┌────────┐   ┌─────────┐
│ Routines  │───────▶│ Today │──▶│ Workout │──▶│ Rest │──▶│ Workout│─▶│ Finish  │
│ (create/  │        │       │   │ (log    │   │      │   │ (next  │   │ (summary│
│  edit)    │        │       │   │  sets)  │◀──│      │   │  set)  │   │  + note)│
└───────────┘        └───────┘   └─────────┘   └──────┘   └────────┘   └────┬────┘
                                     ▲                                       │
                                     │        ┌─────────┐                    │
                                     └────────│ History │◀───────────────────┘
                                              └─────────┘
```

Core loop during the session: **Workout (set state) -> tap "Set done" -> Rest -> rest ends -> Workout (next set)** until the last set, then Finish.

## Screen inventory

### 1. Routines (setup, used rarely)
- **Job:** define workout days and their exercises once.
- **Content:** list of days -> each day lists exercises with target sets/reps/rest.
- **Primary action:** "Add day" / "Add exercise".
- **Editing** a routine affects future sessions only; started sessions keep their snapshot.
- **First launch:** empty state with one labeled sample day ("Sample Push Day - try it, edit it, delete it") plus a clear "Create my own day". Sample is visually tagged SAMPLE and never mixes with real history.

### 2. Today
- **Job:** get from pocket to logging in one tap.
- **Content:** today's date, the day to run (most recent used day preselected, switchable), exercise list with last session's weight/reps per exercise as secondary text, "Last: Tue 4 Nov" line.
- **Primary action:** "Start workout".
- **Resume:** if an unfinished session exists, the primary action is "Resume workout" instead.

### 3. Workout (the main state)
- **Job:** log the current set in under 5 seconds, one-handed.
- **Content:** exercise name; "Set 2 of 4 - Exercise 1 of 5"; current-set inputs (weight, reps) pre-filled from the previous set or last session with visible provenance; completed sets of this exercise listed above with actual values; remaining exercises below as a dimmed queue.
- **Controls:** values open pre-filled from the previous set or last session, marked with provenance ("from set 1" / "from last Push Day") and distinct carried-over styling; large +/- steppers flank each value; tapping a value opens a bottom SHEET with bigger steppers (context stays visible behind). The common case is one tap on "Set done" with zero typing (design target: a few seconds per set, self-set - not a researched threshold).
- **Primary action:** giant "Set done" button, bottom thumb zone (bottom third of screen throughout, one-thumb reach).
- **On "Set done":** set is committed with the field values as shown, and the rest screen starts automatically.
- **Secondary (visually quiet):** "Undo last set", exercise note-free by design, skip exercise.
- **Last set of last exercise:** "Set done" becomes "Finish workout".

### 4. Rest (the hero state)
- **Job:** own the 60-120 seconds between sets; be readable from the floor/bench ~2m away.
- **Content:** enormous countdown numerals (tabular figures, ~30vw); "Next: Bench Press - Set 2 of 4 - 60 kg x 8"; progress ring or bar as a SECONDARY cue (time is carried by numerals + ring together, not color).
- **Controls:** +15s, -15s, Skip (all >= 48px, bottom zone). Always visible: a small "Last set: 60 kg x 8 - Edit" row so a wrong entry can be corrected after the undo toast is gone.
- **End of rest:** state becomes `rest-over` (persisted). If visible: static "Go", tone + vibration if enabled and available, return to Workout after about 2s (instant under reduced motion). No flashing. If the app was hidden or reloaded past the end time: calm "Rest over - Set N of M" with one primary "Start set N" button; no sound or animation replays.
- Wake Lock requested while resting (best-effort).

### 5. Finish
- **Job:** close the session with closure and zero pressure.
- **Content:** duration, exercises done, sets done, total volume; comparison line vs last session computed ONLY from real history ("3 more reps than last Push Day" - omitted entirely if no prior session).
- **Optional:** session note field (friction acceptable here - user is cooling down).
- **Primary action:** "Done" -> saves session, returns to Today.

### 6. History
- **Job:** the payoff - proof of progress from real entries only.
- **Content:** sessions list (day, date, duration); drill into a session for set-by-set; per-exercise trend line (weight over sessions) once >= 2 real sessions exist. No charts from fewer than 2 points; no projected/fake data.

### 7. Settings
- Unit (kg/lb), sound on/off, vibration on/off, keep screen awake, reduce motion, export JSON, import JSON, delete-all-data (with typed confirmation).

## Edge flows

- **Refresh/close mid-workout:** state rehydrates from the persisted `active` state (exercise, set, phase, rest end time, unconfirmed draft values); Today shows "Resume workout". This works only if the browser let the write succeed - see storage failure below.
- **Storage failure:** a persistent banner appears ("Can't save on this device...") with an Export button; the app keeps working in memory. Corrupt or unknown-version data is never overwritten: recovery screen offers export raw data, import backup, or start fresh (typed confirmation).
- **Rest ending while tab backgrounded/phone locked** (`restEndsAt` passed -> `rest-over`): timer is timestamp-based; returning always shows the correct state (still resting or "Go"). End-of-rest sound/vibration is NOT promised while locked/backgrounded - mobile browsers don't reliably allow it; tested honestly and stated in the report.
- **Editing a logged set:** from Workout, the Rest screen's "Last set" row, or History: tap the set -> sheet -> adjust -> save. This is the correction path once the undo toast has gone. Edit writes the corrected value as the set's value (no audit trail needed at this scope).
- **Sample day:** labeled SAMPLE; its sessions are tagged SAMPLE, excluded from pre-fill, comparisons and trends, and deletable. Deleting it never touches real data.
- **Units:** kg/lb switch changes display only; stored data stays in kg.
- **No history yet:** inputs pre-fill from the exercise's typed starting weight if the user set one (provenance: "starting target"), else stay empty with a neutral placeholder ("--"). Never invented numbers.
