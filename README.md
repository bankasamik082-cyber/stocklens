# StockLens

Research any stock with AI — where **every section of the report cites its sources**.
Enter a ticker, pick the sections you want, and StockLens pulls real financials,
news and SEC filings, then writes a clean, plain-English report.

> **StockLens is a research and education tool. It is not financial advice and
> never says “buy” or “sell.”**

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Supabase** — auth + Postgres database
- **OpenAI API** — writes the qualitative parts of the report
- **Financial Modeling Prep (FMP)** — profile, financials, news, politician trades
- **SEC EDGAR** — CIK lookup + links to official 10-K / 10-Q filings

### How the data stays trustworthy

Hard numbers (revenue, market cap, news headlines, politician trades) come
**directly from the data APIs**, never from the model. OpenAI only writes the
qualitative pieces — the plain-English summary, the 1–10 financial score and its
rationale, the bull/bear points, and the final verdict. Real source URLs are
attached to each section during data fetching, so the model can't invent a source.

---

## Folder structure

```
stocklens/
├── .env.example
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── supabase/
│   └── schema.sql              # tables + RLS + signup trigger
└── src/
    ├── middleware.ts           # session refresh + route guard
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx            # 1. Landing page
    │   ├── login/page.tsx      # 2. Login / signup
    │   ├── dashboard/page.tsx  # 3. Dashboard / search
    │   ├── report/[id]/page.tsx# 4. Stock report
    │   └── api/analyze/route.ts# POST /api/analyze
    ├── components/
    │   ├── Navbar.tsx
    │   ├── SearchForm.tsx      # ticker input + section checkboxes
    │   ├── ReportView.tsx      # renders each section + its Sources area
    │   ├── Card.tsx
    │   ├── Badge.tsx
    │   ├── LoadingState.tsx
    │   └── ErrorMessage.tsx
    └── lib/
        ├── types.ts            # shared types + section labels
        ├── fmp.ts              # Financial Modeling Prep wrapper
        ├── edgar.ts            # SEC EDGAR wrapper
        ├── openai.ts           # narrative generation (guardrailed)
        └── supabase/
            ├── client.ts       # browser client
            └── server.ts       # server client
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to <https://supabase.com>, create a project.
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and **Run**.
   This creates `users`, `analyses`, `saved_stocks`, row-level-security policies,
   and a trigger that creates a profile row on signup.
3. (Optional, for instant signup during local dev) **Authentication → Providers →
   Email** and turn **Confirm email** off, so new accounts can sign in right away.

### 3. Get API keys

- **Supabase**: Project Settings → API → copy the **Project URL** and **anon public** key.
- **OpenAI**: <https://platform.openai.com/api-keys>
- **Financial Modeling Prep**: <https://site.financialmodelingprep.com/developer/docs>
  (politician-trading endpoints require a paid plan; the app degrades gracefully if missing).
- **SEC EDGAR**: no key needed, but SEC requires a descriptive `User-Agent`
  with your contact email.

### 4. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
FMP_API_KEY=...
SEC_USER_AGENT=StockLens your-email@example.com
```

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and run your first analysis.

---

## User flow

1. Sign up / log in.
2. On the dashboard, enter a ticker (e.g. `AAPL`) and check the sections you want.
3. **Generate report** → `POST /api/analyze`:
   - verifies you're logged in,
   - fetches only the data the selected sections need (FMP + EDGAR),
   - builds deterministic numbers + a list of real source URLs,
   - asks OpenAI for the narrative pieces (with strict no-advice guardrails),
   - saves the row to `analyses`, and returns its `id`.
4. You're redirected to `/report/[id]`, which reads the saved analysis and renders
   each section with a **Sources** area beneath it.

---

## Notes & gotchas

- **FMP plans**: free tier covers profile, statements and news. Senate/House
  trading (`/v4/senate-trading`, `/v4/senate-disclosure`) needs a paid plan —
  if it returns nothing, the Politician Trading section clearly says so.
- **SEC User-Agent**: without a valid `SEC_USER_AGENT`, EDGAR returns 403 and
  filing sources simply won't appear; the rest of the report still works.
- **Endpoints change**: FMP periodically revises its API paths. If a call returns
  empty, check the current docs and adjust the path in `src/lib/fmp.ts`.
- All data fetches fail soft — a missing source never crashes a report; the
  section shows “Data is limited” instead.
```
