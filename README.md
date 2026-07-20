# Routine — Gym Membership & Routine Activation App

> **Non-affiliation notice (legal).** This is an independent application inspired by the cult.fit
> member experience, built for a Product Management capstone. It is **not** affiliated with, endorsed
> by, or connected to cult.fit, and uses **no official cult.fit branding or assets**. This notice is
> kept here in the README rather than displayed as a badge inside the product.

A calm, mobile-first fitness app that helps new members build a repeatable routine in their first
45 days — and recover from an imperfect week **without guilt**.

**The product message:** _Your routine can survive an imperfect week._

---

## What it does

The whole app is organised around four simple questions:

1. **What is my next workout?** → the **Today** screen
2. **How much progress have I made?** → the **Progress** screen
3. **What should I do when I feel tired?** → **Tired-Day** support (a bottom sheet inside Today)
4. **How can I restart after missing a workout?** → **Comeback Mode** (contextual, inside Today)

A member "activates" by completing **at least 8 eligible workouts across at least 4 distinct weeks**
within their first 45 days. Progress is **banked, never reset to zero** after a missed session.

---

## Navigation

Just three bottom-nav destinations — no side menus, no dashboards, no nested feature pages:

- **Today** — greeting, day counter, compact progress, one contextual card (next workout **or**
  Comeback Mode), the week at a glance, and a supportive note. Tired-Day and rebooking open as
  bottom sheets. Comeback Mode appears here automatically when a session is missed.
- **Progress** — Day X of 45, two progress bars, a week-by-week Routine Map, recent workouts,
  recovered sessions, Plan B workouts, and the next milestone.
- **Profile** — account, my routine, buddy support, notification preferences, privacy controls, and
  account controls (edit routine, sign out, delete account).

---

## Tech stack

| Layer      | Choice                                                   |
| ---------- | -------------------------------------------------------- |
| Frontend   | React 18 + TypeScript + Vite                             |
| Styling    | Tailwind CSS                                             |
| Components | Hand-built shadcn/ui-style library (Radix UI primitives) |
| Backend    | Node.js + Express (Replit-compatible)                    |
| Database   | SQLite via `better-sqlite3`                              |
| Routing    | React Router                                             |
| Toasts     | Sonner                                                   |

State is stored as a single JSON document in SQLite. The React client owns the state transitions and
persists them through a small REST API (`GET/PUT /api/state`, `POST /api/reset`).

---

## Running the application

### Prerequisites

- Node.js 18+ (tested on Node 20 and 22)

### Local development (API + Vite dev server)

```bash
npm install
npm run dev
```

- Vite dev client: **http://localhost:5173** (proxies `/api` to the backend)
- Express API: **http://localhost:3001**

Open **http://localhost:5173**. On the welcome screen choose **Get started** (new-user onboarding) or
**Sign in** (loads a returning demo member, Maya, mid-journey on Day 21).

### Production / single-server mode (what Replit uses)

```bash
npm install
npm run build      # builds the client into /dist
npm run start      # Express serves /dist AND the API on one port (3001)
```

Then open **http://localhost:3001**.

---

## Key journeys

- **New-user onboarding** — three steps (goal → realistic schedule → backup plan) with a progress
  indicator and a routine preview, then _"Start my routine"_.
- **Returning sign-in** — loads Maya (Day 21, 5/8 workouts, 3/4 active weeks) with a recently missed
  session, so **Comeback Mode** is shown immediately.
- **Start & complete a workout** — clean session screen with overview, start/pause/finish and a safe
  reminder, then a lightweight completion celebration. Progress updates automatically.
- **Tired-Day** — a bottom sheet with realistic alternatives (lighter 20-min, 10-min reset, move),
  supportive copy, undo, and a non-medical safety note.
- **Comeback Mode** — guilt-free copy, a banked-progress reminder, and three recovery choices (rebook
  / 10-min reset / ask buddy). The full recovery path works **without** a buddy, in ≤3 taps.
- **One-tap rebooking** — three suitable times; confirming updates the schedule instantly.
- **Optional buddy** — invite from Profile (name, contact, relationship, invitation preview, strict
  sharing controls). Buddies only ever see the proposed next workout, support requests, and
  confirmation status.

---

## Accessibility & quality

- Semantic HTML and labelled controls; dialogs and sheets use accessible Radix primitives.
- Visible keyboard focus states throughout.
- Minimum 44px touch targets; mobile-first layouts, centred with a sensible max width on desktop.
- Soft, supportive colour language — **no aggressive red** for missed workouts.
- Loading and error states are handled; `prefers-reduced-motion` is respected.

---

## Design system

Warm-white background, deep **navy** headings, **teal** primary actions, an **orange** energetic
accent, and a **magenta** highlight. Completed progress is teal, the current week is orange, upcoming
is light grey, and misses use a neutral outline (never aggressive red). Rounded cards, soft shadows,
generous whitespace, short and supportive copy.

---

## Assumptions & limitations

- **Concept only.** No real authentication, messaging, notifications, or payments. Buddy invitations
  are mocked (nothing is actually sent).
- A "week" counts as **active** once any eligible workout is completed within it. A 10-minute reset /
  Plan B protects momentum and is tracked, but is intentionally **not** counted toward the 8-workout
  target.
- **Get started** creates a fresh routine (progress starts at zero). **Sign in** loads the seeded
  returning demo member. State persists in a local SQLite file (`data/prototype.db`).

---

## Project structure

```
cultfit-routine-builder/
├─ server/
│  ├─ index.js        # Express app + static serving in production
│  ├─ db.js           # SQLite persistence (single JSON document)
│  └─ seed.js         # Seeded returning-member state
├─ src/
│  ├─ components/
│  │  ├─ ui/          # shadcn-style primitives (button, card, sheet, dialog, …)
│  │  ├─ AppLayout.tsx        # centred shell + 3-item bottom nav + global sheets
│  │  ├─ RebookSheet.tsx, TiredSheet.tsx, BuddySheet.tsx
│  │  └─ Brand.tsx, Callout.tsx, StatTile.tsx, states.tsx
│  ├─ lib/
│  │  └─ types.ts, api.ts, store.tsx, actions.ts, selectors.ts, constants.ts, utils.ts
│  ├─ pages/          # Welcome, Onboarding, Today, WorkoutSession, Progress, Profile
│  ├─ App.tsx, main.tsx, index.css
├─ .replit, replit.nix
├─ vite.config.ts, tailwind.config.js, tsconfig.json
└─ package.json
```

---

_Built as a capstone concept case study. Supportive by design — no streaks, no guilt, no pressure._
