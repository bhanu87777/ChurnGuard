# 🏗️ ChurnGuard — Architecture

How a raw stream of product-usage events becomes an explainable churn-risk score,
a plain-English reason, and a recommended save action.

---

## 1. The big picture

ChurnGuard is a single **Next.js 16 (App Router)** application — the API route
handlers *are* the backend. Nothing touches the database or the AI except code in
`src/lib/`. State lives in **PostgreSQL** through **Prisma**.

```
┌──────────────────────────────┐        ┌─────────────────────────────────────┐
│  Client (React 19)           │        │  Next.js route handlers (server)      │
│  • Dashboard (charts, table) │        │  /api/customers            (CRUD)     │
│  • Customer detail + trend   │ ─────▶ │  /api/customers/:id/events (ingest)   │
│  • Log-event / re-score loop │        │  /api/customers/:id/score  (re-score) │
│  • Recharts visuals          │        │  /api/score-all · /api/auth · /register│
└──────────────────────────────┘        └──────────────────┬──────────────────────┘
                                                            │ Prisma
                        ┌───────────────────────────────────┼───────────────────┐
                        ▼                                    ▼                   ▼
                  scoring.ts                          PostgreSQL            Claude / Gemini
             (feature extraction                (Customer, ActivityEvent,   (tool-use →
              + band thresholds)                 RiskScore, +History)       structured verdict)
```

The core idea: **churn risk is explainable, not a mystery.** Deterministic code
extracts the churn signals and sets the band thresholds; the LLM only supplies
*judgment* (the score within range, the reason, and the action) — and even that
degrades gracefully to a rule-based heuristic.

---

## 2. The scoring pipeline — `src/lib/scoring.ts` (the headline)

```
Customer + ActivityEvent[]
   │
   ├─ 1. extractFeatures()   ← DETERMINISTIC
   │     daysSinceSignup · daysSinceLastLogin · logins30d · featureUses30d
   │     · supportTickets30d · failedPayments30d · latestNps · mrr · plan
   │
   ├─ 2. Ask the model to judge, via a TOOL-USE call `report_churn_risk`
   │     that FORCES a structured { score, band, reason, action } response
   │     — no fragile JSON parsing.
   │     Provider order:  Claude (if ANTHROPIC_API_KEY)
   │                   →  Gemini (if GEMINI_API_KEY)
   │                   →  rule-based heuristic  (always available)
   │
   └─ 3. Persist:  upsert RiskScore  +  append a RiskScoreHistory snapshot
                   (the snapshot powers the risk-over-time trend chart)
```

**Band thresholds are code, not vibes:** `score ≥ 66 → HIGH`, `≥ 33 → MEDIUM`,
else `LOW`. Because the features and thresholds are deterministic, the same input
always lands in the same band — the LLM can't silently move the goalposts.

> **Why this split?** Deterministic feature extraction + LLM judgment keeps scoring
> **explainable** — you can always point at *which signals* drove a score — while
> the tool-use contract guarantees a well-typed result every time.

---

## 3. The live loop (what makes the demo click)

`POST /api/customers/:id/events` is the real-world **ingestion path** — where a
product would stream its usage events. The customer-detail page uses it directly:
log an event (e.g. *Payment failed*) → trigger a re-score → watch the risk score,
band and trend line move in real time.

---

## 4. Data model (`prisma/schema.prisma`)

| Model | Purpose |
|-------|---------|
| `User` | Dashboard operator (bcrypt password hash). |
| `Customer` | A monitored account: `plan`, `mrr`, `signupDate`, `status`. |
| `ActivityEvent` | One raw churn signal (`type` + optional `metadata` JSON + `occurredAt`). |
| `RiskScore` | The current AI verdict (1-per-customer): `score`, `band`, `reason`, `action`, `model`. |
| `RiskScoreHistory` | A point-in-time snapshot written on **every** (re)score — powers the trend chart. |

**Enums** — `Plan` (FREE / STARTER / PRO / ENTERPRISE) · `CustomerStatus`
(ACTIVE / CHURNED) · `ActivityType` (LOGIN / FEATURE_USE / SUPPORT_TICKET /
PAYMENT / PAYMENT_FAILED / NPS_RESPONSE) · `RiskBand` (LOW / MEDIUM / HIGH).

---

## 5. Project layout

```
src/
├── app/
│   ├── api/
│   │   ├── customers/route.ts              # list + create
│   │   ├── customers/[id]/route.ts         # fetch / update / delete
│   │   ├── customers/[id]/events/route.ts  # ingest an activity event
│   │   ├── customers/[id]/score/route.ts   # re-score one customer
│   │   ├── score-all/route.ts              # re-score the whole book
│   │   ├── register/route.ts               # sign-up
│   │   └── auth/[...nextauth]/route.ts     # next-auth (credentials, JWT)
│   ├── dashboard/page.tsx                  # churn-risk overview
│   ├── customers/[id]/page.tsx             # one account, fully explained
│   ├── login/page.tsx  · page.tsx          # auth + landing
│   └── layout.tsx
├── components/
│   ├── dashboard/   # StatCard · RiskCharts (Recharts) · CustomerTable
│   ├── customer/    # RiskTrend · LogEventForm · CustomerActions
│   ├── RiskBadge.tsx · Navbar.tsx · Providers.tsx
└── lib/
    ├── scoring.ts        # feature extraction + tool-use scoring + heuristic
    ├── score-service.ts  # orchestrates score → persist RiskScore + History
    ├── auth.ts · session.ts
    └── prisma.ts · utils.ts   # band colours, formatMoney, timeAgo
```

Seed & batch scripts live in `prisma/`: `seed.ts` (demo operator + customers +
event streams) and `score-all.ts` (compute initial scores for everyone).

---

## 6. Auth

Email/password via **next-auth** (credentials provider, JWT sessions,
bcrypt-hashed passwords). Every protected page and API route requires a valid
session; the combined login/register screen pre-fills the demo operator so the
app is one click from the dashboard.
