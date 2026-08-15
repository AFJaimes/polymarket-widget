import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildOpportunitiesPrompt,
  entryPriceForSide,
  hasMeaningfulUpside,
  OPPORTUNITIES_SYSTEM_PROMPT,
  payoutMultiple,
} from "@/lib/ai-opportunities-prompt";
import { generateGeminiJson, resolveGeminiApiKey } from "@/lib/gemini";
import { parseLlmJson } from "@/lib/parse-llm-json";
import type { Market } from "@/lib/types";

const marketSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string(),
  slug: z.string(),
  eventSlug: z.string().optional(),
  url: z.string().optional(),
  image: z.string().optional(),
  outcomes: z.tuple([z.string(), z.string()]),
  prices: z.tuple([z.number(), z.number()]),
  volume: z.number(),
  endDate: z.string().optional(),
  active: z.boolean(),
  closed: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
});

const opportunitiesSchema = z.object({
  summary: z.string().min(1),
  opportunities: z
    .array(
      z.object({
        marketId: z.string(),
        marketQuestion: z.string(),
        recommendation: z.enum(["YES", "NO"]),
        confidence: z.number().min(0).max(100),
        thesis: z.string().min(1),
        edgeEstimate: z.string().min(1),
        suggestedBetUsd: z.preprocess((value) => {
          const n = typeof value === "string" ? Number(value) : value;
          if (typeof n !== "number" || Number.isNaN(n) || n <= 0) return 1;
          return Math.min(50, Math.round(n * 100) / 100);
        }, z.number().positive().max(50)),
        upsideNote: z.string().min(1),
      }),
    )
    .max(5),
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      markets?: Market[];
      bankrollUsd?: number;
      apiKey?: string;
    };

    const apiKey = resolveGeminiApiKey(body.apiKey);
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "missing_api_key",
          message:
            "Connect a Gemini API key to research opportunities. Add GEMINI_API_KEY on the server or paste a key in Ask AI.",
        },
        { status: 401 },
      );
    }

    const markets = z.array(marketSchema).min(1).max(16).parse(body.markets);
    const bankrollUsd = body.bankrollUsd ?? 1000;
    const tradable = markets.filter(
      (market) => market.closed !== true && market.acceptingOrders !== false,
    );

    if (tradable.length === 0) {
      return NextResponse.json(
        { error: "No tradable markets available to analyze." },
        { status: 400 },
      );
    }

    const normalized = tradable.map((market) => ({
      ...market,
      eventSlug: market.eventSlug ?? market.slug,
      url: market.url ?? `https://polymarket.com/event/${market.slug}`,
      closed: market.closed ?? false,
      acceptingOrders: market.acceptingOrders ?? true,
    }));

    const prompt = `${OPPORTUNITIES_SYSTEM_PROMPT}\n\n${buildOpportunitiesPrompt(normalized, bankrollUsd)}`;
    const generated = await generateGeminiJson({
      apiKey,
      prompt,
      useSearch: true,
    });

    const parsed = opportunitiesSchema.parse(parseLlmJson(generated.text));
    const byId = new Map(normalized.map((market) => [market.id, market]));
    const opportunities = parsed.opportunities.filter((item) => {
      const market = byId.get(item.marketId);
      if (!market) return false;
      const entry = entryPriceForSide(market, item.recommendation);
      return hasMeaningfulUpside(entry);
    });

    const sources = generated.sources.map(
      (source) => `${source.title}${source.uri ? ` — ${source.uri}` : ""}`,
    );

    const summary =
      opportunities.length > 0
        ? parsed.summary
        : "No picks cleared the bar: need solid sources plus ~1.4x+ payout if correct (not penny favorites).";

    return NextResponse.json({
      summary,
      opportunities: opportunities.map((item) => {
        const market = byId.get(item.marketId)!;
        const entry = entryPriceForSide(market, item.recommendation);
        const mult = payoutMultiple(entry).toFixed(1);
        return {
          ...item,
          upsideNote: item.upsideNote.includes("x")
            ? item.upsideNote
            : `~${mult}x if correct · ${item.upsideNote}`.slice(0, 80),
        };
      }),
      sources,
      source: "gemini" as const,
      model: generated.model,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "AI returned incomplete opportunity data. Retry research."
        : error instanceof Error
          ? error.message
          : "Opportunity research failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
