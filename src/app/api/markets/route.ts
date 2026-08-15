import { NextResponse } from "next/server";
import { fetchMarkets } from "@/lib/polymarket";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "24");

  try {
    const markets = await fetchMarkets({
      query,
      limit: Number.isFinite(limit) ? Math.min(limit, 50) : 24,
    });
    return NextResponse.json({ markets });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load markets";
    return NextResponse.json({ error: message, markets: [] }, { status: 502 });
  }
}
