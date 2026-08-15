# Polymarket AI Widget

## Product
A single-page paper-trading widget for Polymarket markets. Users browse live markets, get structured AI recommendations, and place simulated USDC bets — no real money, no wallet signatures.

## Audience
Technical recruiters and reviewers evaluating a take-home: need a working demo in minutes without MetaMask, faucets, or paid trading.

## Jobs to be done
1. Scan live Polymarket markets on a board of active tiles.
2. Ask AI to scout good opportunities across the current board (requires Gemini key) — mid-priced picks with sourced edge and meaningful payout multiple, not near-certain penny favorites.
3. Ask AI for a single-market recommendation with sources and Kelly sizing.
4. Place and manage paper bets against a $1,000 demo balance.

## Constraints
- No on-chain orders, no CLOB trading client, no real funds.
- AI advisor requires a valid Gemini API key (server `.env` or verified browser key). No mock recommendations.
- AI key stays out of git; browser keys live in localStorage only.
- Responsive from mobile through desktop.
- English UI copy.

## Non-goals (v1)
- Wallet connect / Polygon Amoy / EIP-712 signing
- Live news scraping or social sentiment feeds
- Multi-user auth or cloud persistence (localStorage is enough)

## Mode
Operate — task-first trading desk UI.
