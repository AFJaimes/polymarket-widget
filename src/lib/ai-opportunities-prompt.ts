import type { Market, OutcomeSide } from "./types";

/** Reject near-certain prices where a win pays only pennies. */
export const MAX_ENTRY_PRICE_FOR_UPSIDE = 0.72;
/** Avoid pure lottery tickets unless evidence is exceptional (still capped). */
export const MIN_ENTRY_PRICE_FOR_UPSIDE = 0.12;
/** Minimum payout multiple if the pick resolves correct (1 / entryPrice). */
export const MIN_PAYOUT_MULTIPLE = 1.4;

export const OPPORTUNITIES_SYSTEM_PROMPT = `You are a selective prediction-market scout for a paper-trading widget.
Mission: find a few paper trades with MEANINGFUL revenue potential if correct — not penny-upside favorites.

Hard reject (never recommend):
- Buying an outcome priced above ~0.72 (pays under ~1.4x; "almost sure" wins that net cents).
- Pure longshots under ~0.12 with only vibes / no reputable sources.
- Closed or non-tradable markets.
- Picks whose only thesis is "crowd price looks high/low" with no external evidence.

Prefer:
- Entry prices roughly 0.20–0.65 where a correct call can roughly 1.5x–5x the stake.
- Liquid markets with clear rules and recent reputable coverage (Reuters, AP, Bloomberg, FT, BBC, official releases, strong local papers).
- Asymmetric payoff PLUS a concrete, sourced reason the crowd may be wrong.
- Confidence only when sources support it; otherwise skip the market.

Use Google Search. Never invent headlines, polls, or citations.
Cap each suggestedBetUsd with fractional Kelly; never exceed $50.
This is not financial advice.

IMPORTANT: recommendation "YES" = first outcome label, "NO" = second outcome label (labels may be team names, not literal Yes/No).
If nothing on the board clears the bar, return an empty opportunities array and say so in summary.`;

export function payoutMultiple(entryPrice: number): number {
  if (entryPrice <= 0) return 0;
  return 1 / entryPrice;
}

export function hasMeaningfulUpside(entryPrice: number): boolean {
  return (
    entryPrice >= MIN_ENTRY_PRICE_FOR_UPSIDE &&
    entryPrice <= MAX_ENTRY_PRICE_FOR_UPSIDE &&
    payoutMultiple(entryPrice) >= MIN_PAYOUT_MULTIPLE
  );
}

export function entryPriceForSide(
  market: Pick<Market, "prices">,
  side: OutcomeSide,
): number {
  return side === "YES" ? market.prices[0] : market.prices[1];
}

export function buildOpportunitiesPrompt(
  markets: Market[],
  bankrollUsd: number,
): string {
  const catalog = markets
    .slice(0, 16)
    .map((market, index) => {
      const description = market.description
        ? market.description.slice(0, 220).replace(/\s+/g, " ")
        : "No description";
      const multA = payoutMultiple(market.prices[0]).toFixed(2);
      const multB = payoutMultiple(market.prices[1]).toFixed(2);
      return `${index + 1}. id=${market.id}
question=${market.question}
outcomeA=${market.outcomes[0]} priceA=${market.prices[0].toFixed(3)} payoutIfAWins=${multA}x
outcomeB=${market.outcomes[1]} priceB=${market.prices[1].toFixed(3)} payoutIfBWins=${multB}x
volumeUsd=${Math.round(market.volume)}
endDate=${market.endDate || "unknown"}
url=${market.url}
rules=${description}`;
    })
    .join("\n\n");

  return `Scout paper-trading opportunities from these live Polymarket markets.
Prioritize picks where a correct call can earn solid revenue (aim for ~1.5x+ payout multiple), backed by sources — not 0.90–0.99 favorites that only earn cents.

Bankroll: $${bankrollUsd}

Markets:
${catalog}

Return JSON with this exact shape:
{
  "summary": "one short sentence",
  "opportunities": [
    {
      "marketId": "must match an id above",
      "marketQuestion": "copy the question",
      "recommendation": "YES" | "NO",
      "confidence": number 0-100,
      "thesis": "max 160 characters — cite the concrete reason",
      "edgeEstimate": "max 80 characters — why crowd may be wrong",
      "suggestedBetUsd": number,
      "upsideNote": "max 80 characters — state approx payout multiple if correct"
    }
  ]
}

YES = outcomeA, NO = outcomeB.
Only include markets that clear the upside + evidence bar.
Return at most 3 opportunities; return [] if none qualify.
Never invent market ids. Do not wrap JSON in markdown.`;
}
