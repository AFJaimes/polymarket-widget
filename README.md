# Polymarket AI Widget

Single-page Next.js widget for searching live Polymarket markets, getting structured AI advice, and placing **paper trades** against a $1,000 demo balance. No real money, wallets, or on-chain orders.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Polymarket **Gamma API** (public live market data)
- Zustand + `localStorage` for the demo wallet
- Gemini via `/api/ai-advisor` and `/api/ai-opportunities` with Google Search grounding
- Deep links to the real market on [polymarket.com](https://polymarket.com)

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Gemini API key

The AI features **do not use mock recommendations**.

1. Preferred: set `GEMINI_API_KEY` in `.env.local`
2. Or paste a key in the Ask AI modal → **Verify & connect** (stored in `localStorage` only)

Get a free key: [Google AI Studio](https://aistudio.google.com/apikey).

## Demo flow

1. Browse live markets (sorted by volume) or search.
2. Click **Ask AI for good opportunities** → scout mid-priced picks with sourced edge and meaningful payout.
3. Click **Ask AI** on a tile → single-market recommendation, confidence, sources, Kelly-sized stake (or Pass).
4. Click **Use suggested bet** / **Use bet** or place manually → paper order updates balance + positions.

## AI parameters

Source of truth lives in:

- `src/lib/ai-prompts.ts` — single-market Ask AI
- `src/lib/ai-opportunities-prompt.ts` — board opportunity scout
- `src/lib/gemini.ts` — model fallbacks + generation config
- `src/app/api/ai-advisor/route.ts` / `src/app/api/ai-opportunities/route.ts` — validation + filters

### Shared (Gemini)

| Parameter | Value | Notes |
|-----------|--------|--------|
| Models (fallback order) | `gemini-2.5-flash` → `gemini-flash-latest` → `gemini-2.0-flash` | First model that responds wins |
| Grounding | Google Search when available | Prefer Reuters, AP, Bloomberg, FT, BBC, official / strong local sources |
| Output | Strict JSON | No markdown fences; repaired if truncated |
| Thinking budget | `0` | Keeps responses short and JSON-stable |
| Max output tokens | `8192` | Advisor / opportunities generation |
| Outcome mapping | `YES` = first label, `NO` = second | Labels may be team names, not literal Yes/No |
| Disclaimer | Not financial advice | Paper trading only |

### Ask AI (single market) — bet suggestions

| Parameter | Value | Notes |
|-----------|--------|--------|
| Endpoint | `POST /api/ai-advisor` | One live market + bankroll |
| Sizing rule | Fractional Kelly **0.25** | Cap at **5% of bankroll** and **$50** max |
| `suggestedBetUsd` | `1–50` when betting; **`0` = Pass** | Pass when there is no actionable edge vs crowd |
| Confidence | `0–100` | Lower when evidence is thin or conflicting |
| Sources | Model list + grounding URIs | Never invent citations |
| UI when Pass | Stake shows **Pass**; **Use suggested bet** disabled | Avoids forcing penny / no-edge trades |

Example: a market priced **No @ 0.99** may correctly recommend **BET No** at high confidence but still suggest **Pass**, because winning only pays ~1% (~cents of revenue).

### Ask AI for good opportunities — scout

| Parameter | Value | Notes |
|-----------|--------|--------|
| Endpoint | `POST /api/ai-opportunities` | Up to **16** tradable markets from the live board |
| Max picks returned | **3** (empty allowed) | Empty if nothing clears the bar |
| Preferred entry price | ~**0.20–0.65** | Aim for ~**1.5x–5x** payout if correct |
| Hard filter min entry | **`MIN_ENTRY_PRICE_FOR_UPSIDE = 0.12`** | Rejects pure lottery tickets without evidence |
| Hard filter max entry | **`MAX_ENTRY_PRICE_FOR_UPSIDE = 0.72`** | Rejects near-certain / penny-upside favorites |
| Min payout multiple | **`MIN_PAYOUT_MULTIPLE = 1.4`** | `1 / entryPrice` must be ≥ 1.4× |
| Evidence bar | Reputable recent coverage required | “Crowd looks wrong” alone is not enough |
| `suggestedBetUsd` | Fractional Kelly, **≤ $50** | Coerced to ≥ `$1` if the model returns ≤ 0 on a kept pick |
| Server filter | Re-checks entry price after parse | Drops penny favorites even if the model proposes them |

**Rejected by design**

- Buying outcomes above ~0.72 (under ~1.4× payout)
- Longshots under ~0.12 with vibes only
- Closed / non-tradable markets
- Invented headlines, polls, or citations

Tunable constants: `MIN_ENTRY_PRICE_FOR_UPSIDE`, `MAX_ENTRY_PRICE_FOR_UPSIDE`, `MIN_PAYOUT_MULTIPLE` in `src/lib/ai-opportunities-prompt.ts`.

## Architecture

```
src/
  app/
    api/markets/route.ts           # Gamma proxy
    api/ai-advisor/route.ts        # Single-market Gemini advisor
    api/ai-opportunities/route.ts  # Board opportunity scout
    api/ai-key/route.ts            # Key verify helper
    page.tsx                       # Widget shell
  components/                      # Board, search, modals, wallet
  lib/polymarket.ts                # Gamma client + formatters
  lib/ai-prompts.ts                # Ask AI prompts
  lib/ai-opportunities-prompt.ts   # Scout prompts + upside filters
  lib/gemini.ts                    # Gemini client
  store/use-paper-wallet.ts        # Demo balance + positions
```

## Design notes

Operate-mode trading desk UI (see `DESIGN.md` / `PRODUCT.md`).

Local tooling that must **not** be committed (already in `.gitignore`):

- `.cursor/` (Impeccable skill + agents + hooks)
- `.impeccable/`, `.agent/`, `.agents/`, `skills/`
- `AGENTS.md`, `CLAUDE.md`
- `.env*` (except `.env.example`)

## Scripts

| Command         | Description       |
|-----------------|-------------------|
| `npm run dev`   | Local development |
| `npm run build` | Production build  |
| `npm run start` | Serve production  |
| `npm run lint`  | ESLint            |

## Disclaimer

This is a technical demo for paper trading only. AI output is not financial advice.
