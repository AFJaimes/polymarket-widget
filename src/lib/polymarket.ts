import type { Market } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const POLYMARKET_WEB = "https://polymarket.com";

interface GammaMarketRaw {
  id?: string | number;
  question?: string;
  description?: string;
  slug?: string;
  image?: string;
  icon?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  volume?: string | number;
  volumeNum?: number;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
  events?: Array<{ slug?: string }>;
}

function parseJsonArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function normalizeMarket(raw: GammaMarketRaw): Market | null {
  const question = raw.question?.trim();
  if (!question || !raw.id) return null;

  const rawOutcomes = parseJsonArray(raw.outcomes);
  const prices = parseJsonArray(raw.outcomePrices).map((p) => toNumber(p));

  const labelA = rawOutcomes[0]?.trim() || "Yes";
  const labelB = rawOutcomes[1]?.trim() || "No";

  let priceA = 0.5;
  let priceB = 0.5;

  if (prices[0] !== undefined) priceA = prices[0];
  if (prices[1] !== undefined) priceB = prices[1];
  else priceB = Math.max(0, 1 - priceA);

  const slug = raw.slug ?? String(raw.id);
  const eventSlug = raw.events?.[0]?.slug || slug;

  return {
    id: String(raw.id),
    question,
    description: raw.description?.trim() ?? "",
    slug,
    eventSlug,
    url: polymarketEventUrl(eventSlug),
    image: raw.image || raw.icon || undefined,
    outcomes: [labelA, labelB],
    prices: [clampPrice(priceA), clampPrice(priceB)],
    volume: toNumber(raw.volumeNum ?? raw.volume),
    endDate: raw.endDate,
    active: raw.active !== false && raw.closed !== true,
    closed: raw.closed === true,
    acceptingOrders: raw.acceptingOrders !== false && raw.closed !== true,
  };
}

export function isMarketTradable(market: Pick<Market, "closed" | "acceptingOrders">): boolean {
  return !market.closed && market.acceptingOrders;
}

export function getOutcomeLabel(market: Market, side: "YES" | "NO"): string {
  return side === "YES" ? market.outcomes[0] : market.outcomes[1];
}

export function getOutcomePrice(market: Market, side: "YES" | "NO"): number {
  return side === "YES" ? market.prices[0] : market.prices[1];
}

export function shortOutcomeLabel(label: string, max = 14): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function clampPrice(price: number): number {
  if (!Number.isFinite(price)) return 0.5;
  return Math.min(0.99, Math.max(0.01, price));
}

export function polymarketEventUrl(eventSlug: string): string {
  return `${POLYMARKET_WEB}/event/${encodeURIComponent(eventSlug)}`;
}

export async function fetchMarkets(params?: {
  query?: string;
  limit?: number;
}): Promise<Market[]> {
  const limit = params?.limit ?? 24;
  const query = params?.query?.trim();

  if (query) {
    const url = new URL(`${GAMMA_BASE}/public-search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit_per_type", String(limit));

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Gamma search failed (${res.status})`);
    }

    const data = (await res.json()) as {
      markets?: GammaMarketRaw[];
      events?: Array<{ markets?: GammaMarketRaw[]; slug?: string }>;
    };

    const fromMarkets = data.markets ?? [];
    const fromEvents =
      data.events?.flatMap((event) =>
        (event.markets ?? []).map((market) => ({
          ...market,
          events: market.events?.length
            ? market.events
            : event.slug
              ? [{ slug: event.slug }]
              : undefined,
        })),
      ) ?? [];
    const merged = [...fromMarkets, ...fromEvents];

    return dedupeMarkets(
      merged.map(normalizeMarket).filter((m): m is Market => Boolean(m)),
    ).slice(0, limit);
  }

  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Gamma markets failed (${res.status})`);
  }

  const data = (await res.json()) as GammaMarketRaw[];
  return dedupeMarkets(
    data.map(normalizeMarket).filter((m): m is Market => Boolean(m)),
  );
}

function dedupeMarkets(markets: Market[]): Market[] {
  const seen = new Set<string>();
  return markets.filter((market) => {
    if (seen.has(market.id)) return false;
    seen.add(market.id);
    return true;
  });
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatPercent(price: number): string {
  return `${Math.round(price * 100)}%`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return formatUsd(volume);
}
