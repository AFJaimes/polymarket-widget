import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_SYSTEM_PROMPT, buildAiUserPrompt } from "@/lib/ai-prompts";
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

const adviceSchema = z.object({
  recommendation: z.enum(["YES", "NO"]),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1),
  keyPoints: z.array(z.string()).min(1).max(6),
  suggestedBetUsd: z.preprocess((value) => {
    const n = typeof value === "string" ? Number(value) : value;
    if (typeof n !== "number" || Number.isNaN(n) || n < 0) return 0;
    return Math.min(50, Math.round(n * 100) / 100);
  }, z.number().min(0).max(50)),
  edgeEstimate: z.string().optional(),
  sources: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      market?: Market;
      bankrollUsd?: number;
      apiKey?: string;
    };

    const apiKey = resolveGeminiApiKey(body.apiKey);
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "missing_api_key",
          message:
            "Connect a Gemini API key to use the AI advisor. Add GEMINI_API_KEY on the server or paste a key in the widget.",
        },
        { status: 401 },
      );
    }

    const market = marketSchema.parse(body.market);
    const normalizedMarket: Market = {
      ...market,
      eventSlug: market.eventSlug ?? market.slug,
      url: market.url ?? `https://polymarket.com/event/${market.slug}`,
      closed: market.closed ?? false,
      acceptingOrders: market.acceptingOrders ?? true,
    };
    const bankrollUsd = body.bankrollUsd ?? 1000;

    const prompt = `${AI_SYSTEM_PROMPT}\n\n${buildAiUserPrompt(normalizedMarket, bankrollUsd)}`;
    const generated = await generateGeminiJson({
      apiKey,
      prompt,
      useSearch: true,
    });

    const parsed = adviceSchema.parse(parseLlmJson(generated.text));
    const groundedSources = generated.sources.map(
      (source) => `${source.title}${source.uri ? ` — ${source.uri}` : ""}`,
    );
    const sources = uniqueStrings([
      ...(parsed.sources ?? []),
      ...groundedSources,
    ]).slice(0, 6);

    return NextResponse.json({
      ...parsed,
      sources,
      source: "gemini" as const,
      model: generated.model,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "AI returned incomplete advice. Retry research."
        : error instanceof Error
          ? error.message
          : "AI advisor failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
