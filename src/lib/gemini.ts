import { parseLlmJson } from "@/lib/parse-llm-json";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
] as const;

export type GeminiGenerateResult = {
  text: string;
  model: string;
  sources: Array<{ title: string; uri: string }>;
};

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export async function verifyGeminiApiKey(apiKey: string): Promise<{
  ok: boolean;
  model?: string;
  error?: string;
}> {
  const key = apiKey.trim();
  if (!key) return { ok: false, error: "API key is required." };

  let lastError = "Unable to verify Gemini API key.";

  for (const model of GEMINI_MODELS) {
    const res = await fetch(geminiUrl(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
        generationConfig: {
          maxOutputTokens: 16,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (res.ok) return { ok: true, model };

    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    lastError = body?.error?.message || `Gemini returned ${res.status}`;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      // Some models reject thinkingConfig — retry without it once for this model.
      const retry = await fetch(geminiUrl(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
          generationConfig: { maxOutputTokens: 16, temperature: 0 },
        }),
      });
      if (retry.ok) return { ok: true, model };
      continue;
    }
  }

  return { ok: false, error: lastError };
}

async function requestGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  useSearch: boolean;
  forceJsonMime: boolean;
}): Promise<GeminiGenerateResult | null> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingBudget: 0 },
  };

  if (params.forceJsonMime) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
    generationConfig,
  };

  if (params.useSearch) {
    body.tools = [{ google_search: {} }];
  }

  let res = await fetch(geminiUrl(params.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify(body),
  });

  // Retry without thinkingConfig if the model rejects it.
  if (!res.ok && res.status === 400) {
    const { thinkingConfig: _ignored, ...withoutThinking } = generationConfig;
    res = await fetch(geminiUrl(params.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        ...body,
        generationConfig: withoutThinking,
      }),
    });
  }

  if (!res.ok) return null;

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { title?: string; uri?: string };
        }>;
      };
    }>;
  };

  const candidate = json.candidates?.[0];
  const text =
    candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  if (!text) return null;

  const sources =
    candidate?.groundingMetadata?.groundingChunks
      ?.map((chunk) => ({
        title: chunk.web?.title?.trim() || "Source",
        uri: chunk.web?.uri?.trim() || "",
      }))
      .filter((s) => Boolean(s.uri))
      .slice(0, 5) ?? [];

  return { text, model: params.model, sources };
}

export async function generateGeminiJson(params: {
  apiKey: string;
  prompt: string;
  useSearch?: boolean;
}): Promise<GeminiGenerateResult> {
  const key = params.apiKey.trim();
  const preferSearch = params.useSearch !== false;
  let lastError = "Gemini request failed.";

  // Pass 1: search grounding (richer research). Pass 2: strict JSON mime (more reliable parse).
  const attempts: Array<{ useSearch: boolean; forceJsonMime: boolean }> = preferSearch
    ? [
        { useSearch: true, forceJsonMime: false },
        { useSearch: false, forceJsonMime: true },
      ]
    : [{ useSearch: false, forceJsonMime: true }];

  for (const attempt of attempts) {
    for (const model of GEMINI_MODELS) {
      try {
        const result = await requestGemini({
          apiKey: key,
          model,
          prompt: params.prompt,
          useSearch: attempt.useSearch,
          forceJsonMime: attempt.forceJsonMime,
        });
        if (!result?.text) {
          lastError = `Gemini returned an empty response from ${model}.`;
          continue;
        }

        try {
          parseLlmJson(result.text);
          return result;
        } catch (error) {
          lastError =
            error instanceof Error
              ? `Invalid JSON from ${model}: ${error.message}`
              : `Invalid JSON from ${model}`;
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Gemini request failed.";
      }
    }
  }

  throw new Error(lastError);
}

export function resolveGeminiApiKey(clientKey?: string | null): string | null {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const fromClient = clientKey?.trim();
  return fromClient || null;
}
