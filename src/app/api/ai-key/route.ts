import { NextResponse } from "next/server";
import { resolveGeminiApiKey, verifyGeminiApiKey } from "@/lib/gemini";

export async function GET() {
  const serverConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  return NextResponse.json({ serverConfigured });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { apiKey?: string };
    const apiKey = resolveGeminiApiKey(body.apiKey);
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Paste a Gemini API key to continue." },
        { status: 400 },
      );
    }

    const result = await verifyGeminiApiKey(apiKey);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "Invalid Gemini API key." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      model: result.model,
      source: process.env.GEMINI_API_KEY?.trim() ? "server" : "client",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify API key";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
