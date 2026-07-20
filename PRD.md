# Product Requirements Document (PRD)
## cult.fit Routine Builder — Buddy-Assisted Momentum Repair

> **Status:** Concept prototype (capstone build) · **Version:** 1.0 · **Author:** Product (Capstone)
> **Type:** Unofficial concept. Not affiliated with or endorsed by cult.fit. No official branding used.

---

## 1. Overview / TL;DR

New cultpass members start motivated but frequently lose momentum in their first weeks when fatigue,
schedule disruption, or a single missed workout breaks their rhythm. Most fitness products respond
with streaks and guilt, which turns a normal slip into a reason to quit.

The **cult.fit Routine Builder** helps a new member build a realistic, repeatable 45-day routine and
— critically — **recover from a missed session without guilt**. Progress is **banked, never reset to
zero**. After a miss (or a multi-day gap), the product surfaces **Comeback Mode**: one small,
judgement-free next action, with an optional privacy-first accountability buddy.

**One-line goal:** Move new-member 45-day routine activation from a **34% baseline to a 50% target**
by reducing drop-off after the first missed workout.

---

## 2. Problem statement

### 2.1 Context
- Segment: new cultpass members, **aged 25–34**, in their **first 45 days**.
- Behavioural pattern (observed): strong initial intent → early consistency → a disruption (fatigue,
  travel, work, illness, a single miss) → guilt/avoidance → churn.

### 2.2 The core problem
A missed workout is experienced as **failure**, not as a normal, recoverable event. Streak-based and
gamified mechanics amplify this: breaking a streak feels like erasing progress, so users disengage
rather than resume.

### 2.3 Why now / why us
Retention in the activation window is the highest-leverage lever for lifetime value. A supportive
recovery loop — rather than pressure — is under-served and aligns with a wellness brand's values.

---

## 3. Goals & success metrics

### 3.1 Product objective
Help a new member establish a repeatable routine such that they **complete ≥ 8 eligible workouts
across ≥ 4 distinct weeks** within 45 days ("activation").

### 3.2 Primary success metric (North Star for this initiative)
| Metric | Baseline | Target |
| --- | --- | --- |
| 45-day routine **activation rate** | 34% | **50%** |

### 3.3 Supporting metrics
- **Missed-session recovery rate** — % of missed sessions recovered within 7 days.
- **First workout within 7 days** of routine activation.
- **Week-two repeat rate** — returned for a workout in week 2.
- **Median time to next workout** after a completed or missed session.
- **Routine setup completion rate** — started → completed setup.
- **Plan B usage** — % of members who use a shorter fallback session.
- **Buddy invitation acceptance** — invites sent → accepted.

### 3.4 Guardrail / anti-metrics (must NOT increase)
- Guilt/notification-driven engagement, streak anxiety, or uninstall/mute rates.
- Buddy feature must not create pressure or privacy concerns (measured via consent-revoke rate).

### 3.5 Non-goals for the metric
- We do **not** optimise for daily streak length. A streak is explicitly rejected as a success proxy.

---

## 4. Target users & personas

**Primary persona — "Maya" (demo user)**
- 29, new cultpass member, Day 21 of 45.
- Goal: build strength and consistency.
- Motivated but time-constrained; low energy on weekday evenings.
- Emotional need: to feel that a missed session is okay and recoverable.

**Secondary persona — "Arjun" (the buddy)**
- A trusted friend/family member who wants to encourage Maya.
- Needs a lightweight, privacy-respecting way to cheer her on — nothing invasive.

---

## 5. Solution summary

A mobile-first web app with seven interlocking capabilities:

1. **Realistic 45-day routine setup** (with a preview before anything is booked).
2. **Routine Map** — progress visualised across weeks, not a fragile daily streak.
3. **Comeback Mode** — guilt-free recovery after a miss or a 4-day gap.
4. **One-tap rebooking** — three suitable alternative times.
5. **Tired-Day Mode** — a shorter Plan B session as a safe fallback.
6. **Trusted buddy** — one optional, privacy-first accountability partner.
7. **Weekly summaries** — recovery-positive progress recaps.

**Guiding principle:** *"You are building consistency across weeks — not chasing a perfect streak."*

---

## 6. Detailed requirements (by feature)

Priority key: **P0** = must-have for the prototype, **P1** = should-have, **P2** = nice-to-have.

### 6.1 Demo login — P0
- One-tap **"Continue as demo user"**; no real authentication.
- Seeded user: Maya, age 29, goal "Build strength and consistency", "New cultpass user", Day 21 of 45.

### 6.2 Routine setup — P0
- Capture: primary goal, preferred formats, workouts/week, available days & times, typical
  low-energy periods, preferred duration, Plan B toggle, buddy-invite toggle.
- Sensible defaults: goal = strength & consistency; schedule = Tue 7:00 PM, Thu 7:00 AM, Sat 10:00 AM;
  low-energy = weekday evenings; Plan B = 10–20 min low-intensity home workout.
- **Show a routine preview before confirmation.** Nothing is booked without explicit confirmation.

### 6.3 Home dashboard — P0
- Shows: "Day 21 of your 45-day routine", 5 of 8 workouts, 3 of 4 active weeks, next-workout card,
  weekly schedule, buddy status.
- Primary actions: "I'm feeling tired today", "Adjust this week", "View Routine Map".
- Main supportive message rendered prominently (see guiding principle).

### 6.4 Routine Map — P0
- Displays 6–7 weeks: total eligible workouts completed, active weeks completed, remaining workouts,
  remaining active weeks, week-by-week counts, upcoming workout, recovered weeks.
- **A missed workout must never reset progress to zero.**
- Example seed: Wk1: 2, Wk2: 2, Wk3: 1, Wk4: 0/upcoming → 5 of 8 workouts, 3 of 4 active weeks.

### 6.5 Comeback Mode — P0 (most important)
- **Triggers:** a booked workout is marked missed, **or** a 4-day inactivity gap.
- Copy: *"One miss doesn't erase your progress."* + *"You still have 5 workouts and 3 active weeks
  banked."*
- Three recovery choices: **Rebook this workout**, **Do a 10-minute reset workout**, **Ask my buddy
  to support my next session**.
- Also: "Adjust this week" and "Not now".
- **A complete solo recovery path must exist without a buddy** (buddy option degrades gracefully).
- User can **select and confirm a recovery action in ≤ 3 taps**.

### 6.6 One-tap rebooking — P0
- Offer three suitable alternative times from the user's schedule (e.g., Tomorrow 7:00 PM, Thu 7:00 AM,
  Sat 10:00 AM).
- Confirming one updates the dashboard immediately with: *"Your next step is booked. Your progress is
  still intact."*

### 6.7 Tired-Day Mode — P0
- Triggered by "I'm feeling tired today".
- Options: continue original / switch to 20-min lighter / complete 10-min reset / move session.
- Framing: *"Doing something smaller can protect your routine when energy is low."* Plan B is a safe
  fallback, not a punishment.
- **No medical advice.** If pain/injury is reported, tell the user to stop and consult a qualified
  professional.

### 6.8 Trusted buddy — P0
- Mock invitation flow: buddy name, relationship, invitation preview, **explicit consent checkbox**,
  information-sharing controls.
- **Buddy may see only:** the proposed next workout, a support request, confirmation status.
- **Buddy must never see:** full attendance history, missed-workout history, health information, body
  measurements, private notes.
- Controls: mute buddy prompts, disconnect buddy, revoke sharing consent.
- Demo buddy: Arjun, Connected, next confirmation "Saturday yoga at 10:00 AM".

### 6.9 Weekly summary — P0
- Shows: workouts completed, active-week status, missed sessions recovered, Plan B workouts, next
  week's confirmed plan.
- Supportive messaging, e.g., *"You returned after a difficult day. That recovery is part of your
  progress."*

### 6.10 Prototype / demo controls — P0
- Visible panel for evaluators: reset prototype; mark next workout completed; mark next workout missed;
  simulate 4-day inactivity gap; connect/disconnect buddy; change current day; toggle normal/tired-day.

### 6.11 Analytics demonstration — P0
- Mock metrics (§3), with the **activation baseline 34% and target 50%** clearly displayed.
- All analytics labelled as **mock prototype data**.
- **Event-log table** that updates as the demo user acts.
- Tracked events: `routine_setup_started`, `routine_setup_completed`, `workout_booked`,
  `workout_completed`, `workout_missed`, `comeback_card_viewed`, `comeback_option_selected`,
  `workout_rebooked`, `plan_b_started`, `buddy_invite_sent`, `buddy_invite_accepted`,
  `buddy_request_sent`, `routine_map_viewed`, `routine_activated`, `buddy_consent_revoked`.

### 6.12 Accessibility & quality — P0
- Keyboard accessibility, visible focus states, semantic HTML, labelled form controls, adequate colour
  contrast, alt text where required, mobile-friendly touch targets, and handled loading/empty/error
  states. No broken buttons or placeholder-only interactions.

---

## 7. Key user flows

**A. Happy path (setup → activation)**
Login → setup (with preview) → confirm → dashboard → complete workouts across weeks → Routine Map
shows banked progress → weekly summary → activation.

**B. Recovery path (the core loop)**
Booked workout missed **or** 4-day gap → **Comeback Mode** → choose {rebook | 10-min reset | ask
buddy} → confirm (≤3 taps) → dashboard updates, progress intact → missed week marked "recovered".

**C. Low-energy path**
"I'm feeling tired today" → **Tired-Day Mode** → switch to lighter/reset/move → routine protected,
no guilt.

**D. Solo path**
Same as B/C with **no buddy connected** — buddy option is disabled with a supportive message; rebook
and reset remain fully available.

---

## 8. Design principles & system

- Professional wellness aesthetic: clean white background, **deep navy** headings, **teal** primary
  actions, **blue** secondary actions, **soft green** for completed progress, **soft yellow** for
  recovery guidance, **soft red for genuine errors only — never for missed workouts**.
- Rounded cards, subtle shadows, generous spacing.
- **Supportive, non-judgemental language** everywhere. No aggressive streaks, guilt messaging,
  excessive gamification, or notification pressure.

---

## 9. Definitions & business rules

- **Eligible workout:** a scheduled/real session (including a lighter Tired-Day session). Counts
  toward the 8-workout target.
- **Active week:** a calendar week in which the member completes ≥ 1 eligible workout. Counts toward
  the 4-distinct-weeks target.
- **Plan B / 10-minute reset:** a momentum-protecting fallback. **Tracked** and celebrated, but
  intentionally **not** counted toward the 8-workout target (keeps the activation metric honest).
- **Recovered week/session:** a missed session that the member later rebooks or offsets with a reset;
  flagged as "recovered" and surfaced positively. **A miss never subtracts from banked counts.**
- **Activation:** ≥ 8 eligible workouts across ≥ 4 distinct weeks within 45 days.

---

## 10. Technical requirements (as built)

- **Frontend:** React 18 + TypeScript + Vite; Tailwind CSS; shadcn/ui-style components on Radix
  primitives; React Router; Sonner toasts.
- **Backend:** Node.js + Express (Replit-compatible); serves the built client in production.
- **Persistence:** SQLite (`better-sqlite3`) storing the prototype state as a single JSON document;
  seeded on first run; reliable reset-to-seed.
- **API:** `GET/PUT /api/state`, `POST /api/events`, `POST /api/reset`, `GET /api/health`.
- **Responsive:** mobile-first; verified at 390px and desktop.
- **Deliverables:** working Replit app, seeded demo data, persistent state, README with run + deploy
  instructions.

---

## 11. Scope

### In scope (prototype)
All features in §6, seeded demo data, persistent state, demo controls, and a mock analytics view.

### Out of scope (explicitly not built)
AI meal planning, personalised nutrition coaching, camera-based body analysis, medical diagnosis,
stranger matching, payments, real cult.fit account integration, real messaging/notifications, and
aggressive push campaigns. Neutral calorie/meal logging appears only as a **disabled "Future
consideration"** item.

---

## 12. Assumptions

- Single demo user; no real auth, messaging, or notifications (buddy invite/accept are mocked).
- Analytics figures are illustrative/static; only the event log reflects real interactions.
- Day 21 sits near the end of week 3; seed data is representative, not exhaustive.
- State is single-document JSON in SQLite — appropriate for a single-demo-user prototype, not for
  concurrent multi-user editing.

---

## 13. Risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Recovery framing still feels like "you failed" | Undermines core value | Guilt-free copy, banked-progress reminders, no streaks, soft colours |
| Buddy feature feels invasive / creates pressure | Privacy & trust harm | Strict sharing matrix, explicit consent, mute/disconnect/revoke, fully optional |
| Users over-rely on Plan B and never do full sessions | Activation stalls | Plan B is tracked but not counted toward the 8-workout target |
| Notifications become nagging | Churn / mutes | No push campaigns; in-app, opt-in, low-pressure prompts only |
| Perceived as an official cult.fit product | Brand/legal risk | "Concept prototype" labels, no official logo, disclaimers in footer/README |

---

## 14. Release / rollout (hypothetical, beyond prototype)

- **Phase 0 (this build):** clickable prototype + mock analytics for capstone evaluation.
- **Phase 1:** instrument real events; A/B test Comeback Mode vs. control on recovery rate.
- **Phase 2:** roll out to a new-member cohort; monitor activation vs. the 34% → 50% target and
  guardrail metrics.
- **Phase 3:** expand buddy features only if consent-revoke and pressure signals stay low.

---

## 15. Open questions

- Should a 20-minute lighter Tired-Day session count as a full eligible workout, or be weighted?
- What is the ideal inactivity threshold for auto-triggering Comeback Mode (currently 4 days)?
- How many buddies (currently capped at 1) and what nudge cadence avoids pressure?
- Which recovery option drives the best downstream activation (to prioritise in the UI)?

---

## 16. Acceptance criteria (prototype "done")

- [x] Every main flow works end-to-end; no broken buttons or placeholder-only interactions.
- [x] Marking a workout missed opens **Comeback Mode**; banked progress is preserved (never zeroed).
- [x] Completed **and** rebooked workouts update the **Routine Map**.
- [x] A full recovery path works **without a buddy**.
- [x] **Reset** restores the exact seeded demo state.
- [x] Recovery action selectable + confirmable in **≤ 3 taps**.
- [x] TypeScript compiles clean; production build succeeds; responsive on mobile & desktop.
- [x] Analytics shows baseline **34%** vs target **50%**, labelled mock data, with a live event log.
