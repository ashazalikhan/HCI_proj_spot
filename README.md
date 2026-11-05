# SPOT

**A workout logger built for the 60 seconds between sets.**

SPOT is an HCI mini-project gym tracker: it replaces a static note in your Notes app with a focused tool—today’s plan, the current set, last session’s numbers already in place, and a rest screen you can read from across the room. No account, no backend; everything stays in your browser.

## Live demo

**Production:** [spot-ashaz.vercel.app](https://spot-ashaz.vercel.app)

Or run locally with `npm run dev`.

## Why SPOT

Most gym trackers optimize for **data entry**—dense tables and keyboards mid-workout. SPOT optimizes for **between-sets interaction**:

- **One primary action per screen** — big targets, thumb-friendly layout
- **Pre-filled weight and reps** — from the previous set or last session, clearly labeled until you confirm
- **Full-screen rest mode** — large countdown, +/−15s, skip, optional sound and vibration
- **Honest history** — only logged sets you confirmed count toward pre-fill; sample data stays labeled

## Features

| Area | What you get |
| --- | --- |
| **Routines** | Build workout days with exercises, target sets/reps, and rest duration |
| **Today** | Pick a day, see last session hints, start or resume in one tap |
| **Workout** | Current exercise and set always visible; steppers; “Set done” commits the set |
| **Rest** | Auto-starts after each set; wake-friendly display; adjust or skip rest |
| **Finish** | Session summary, duration, optional note |
| **History** | Past sessions; edit sets; drives next pre-fill |
| **Settings** | Units, cues, reduced motion, export/import JSON backup |

## Privacy

- **No server** — static SPA; state lives in `localStorage` under `spot.v1`
- **No analytics or telemetry** — no third-party fonts, CDNs, or tracking scripts
- **Export/import** — JSON backup is the durable copy; clearing browser data clears the app

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript
- Hash-based routing (`#/today`, `#/workout`, …) so refresh mid-workout resumes correctly
- [Vitest](https://vitest.dev/) for state and storage tests

## Getting started

**Requirements:** Node.js 20+ (LTS recommended)

```bash
git clone https://github.com/ashazalikhan/HCI_proj_spot.git
cd spot
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit tests once |

## Deploy

Vercel detects Vite automatically:

- **Build command:** `npm run build`
- **Output directory:** `dist`

From the project root:

```bash
npx vercel          # preview
npx vercel --prod   # production
```

Or connect [github.com/ashazalikhan/HCI_proj_spot](https://github.com/ashazalikhan/HCI_proj_spot) in the Vercel dashboard for Git-based deploys on every push.

## Project docs

Design and requirements live in [`docs/`](docs/):

- [`01-prd.md`](docs/01-prd.md) — product scope and HCI rationale  
- [`02-trd.md`](docs/02-trd.md) — architecture and data schema  
- [`04-uiux.md`](docs/04-uiux.md) — visual system and interaction rules  

## License

Private project (`package.json` marks the package as private). All rights reserved unless you add an explicit license file.
