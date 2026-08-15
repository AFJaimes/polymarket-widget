"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AiModal } from "@/components/ai-modal";
import { BetModal } from "@/components/bet-modal";
import { MarketCard } from "@/components/market-card";
import { MarketSearch } from "@/components/market-search";
import { OpportunitiesModal } from "@/components/opportunities-modal";
import { PositionModal } from "@/components/position-modal";
import { WalletHeader } from "@/components/wallet-header";
import { MarketCountdown } from "@/components/market-countdown";
import { formatPercent, formatUsd, polymarketEventUrl } from "@/lib/polymarket";
import type { Market, OutcomeSide, PaperPosition } from "@/lib/types";
import { usePaperWallet } from "@/store/use-paper-wallet";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiMarket, setAiMarket] = useState<Market | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSeedKey, setAiSeedKey] = useState(false);
  const [opportunitiesOpen, setOpportunitiesOpen] = useState(false);
  const [opportunityIds, setOpportunityIds] = useState<string[]>([]);

  const [betMarket, setBetMarket] = useState<Market | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [betOutcome, setBetOutcome] = useState<OutcomeSide>("YES");
  const [betAmount, setBetAmount] = useState<number | undefined>(undefined);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [managePosition, setManagePosition] = useState<PaperPosition | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const highlightTimer = useRef<number | null>(null);

  const positions = usePaperWallet((s) => s.positions);
  const balanceUsd = usePaperWallet((s) => s.balanceUsd);
  const positionsRef = useRef<HTMLElement | null>(null);

  const loadMarkets = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = q.trim()
        ? `/api/markets?q=${encodeURIComponent(q.trim())}&limit=24`
        : "/api/markets?limit=24";
      const res = await fetch(url);
      const data = (await res.json()) as {
        markets?: Market[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load markets");
      setMarkets(data.markets ?? []);
    } catch (err) {
      setMarkets([]);
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkets("");
  }, [loadMarkets]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  function openBet(market: Market, outcome: OutcomeSide = "YES", amount?: number) {
    setBetMarket(market);
    setBetOutcome(outcome);
    setBetAmount(amount);
    setBetOpen(true);
  }

  function openAskAi(market: Market, seedKey = false) {
    setAiMarket(market);
    setAiSeedKey(seedKey);
    setAiOpen(true);
  }

  function focusPosition(positionId: string) {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    setHighlightedId(positionId);

    window.requestAnimationFrame(() => {
      const el = document.getElementById(`position-${positionId}`);
      positionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    highlightTimer.current = window.setTimeout(() => {
      setHighlightedId(null);
      highlightTimer.current = null;
    }, 2800);
  }

  return (
    <div className="app-shell">
      {/*
        THESIS: Polymarket-like scan board + AI scout for liquid edge — paper trading only.
        OWN-WORLD: Ink canvas, market tiles with yes/no actions, mint/coral odds, blue CTAs.
        STORY: Browse tiles, scout opportunities, deep-dive one market, place/manage paper bets.
        FIRST VIEWPORT: Wallet, search + Ask AI for good opportunities, live market grid.
        FORM: Operate trading desk · Polymarket board density without copying brand chrome.
        FINISH: DESIGN.md documents the tile system.
      */}
      <WalletHeader />

      <main className="app-main">
        <section className="toolbar">
          <div className="toolbar-row">
            <div style={{ flex: 1, minWidth: "220px" }}>
              <MarketSearch
                value={query}
                onChange={setQuery}
                onSubmitSearch={(value) => {
                  void loadMarkets(value);
                }}
              />
            </div>
            <button
              type="button"
              className="btn primary"
              disabled={loading || markets.length === 0}
              onClick={() => setOpportunitiesOpen(true)}
            >
              Ask AI for good opportunities
            </button>
          </div>
        </section>

        <section className="markets-panel" aria-live="polite">
          <div className="section-head section-head-row">
            <div>
              <h1>Live markets</h1>
              <p>Polymarket-style board · realtime Gamma odds · paper execution only</p>
            </div>
          </div>

          {loading ? (
            <div className="market-grid" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="market-card market-card-skel">
                  <div className="skel thumb" />
                  <div className="skel-stack">
                    <div className="skel line wide" />
                    <div className="skel line" />
                    <div className="skel line short" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="state-box">
              <p>{error}</p>
              <p className="state-hint">
                If you are in a restricted region, connect a VPN and retry.
              </p>
              <button type="button" className="btn primary" onClick={() => void loadMarkets(query)}>
                Retry
              </button>
            </div>
          ) : null}

          {!loading && !error && markets.length === 0 ? (
            <div className="state-box">
              <p>No markets matched that search. Try a broader term like “election” or “Fed”.</p>
            </div>
          ) : null}

          {!loading && !error && markets.length > 0 ? (
            <div className="market-grid">
              {markets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  highlighted={opportunityIds.includes(market.id)}
                  onAskAi={(m) => openAskAi(m)}
                  onBet={(m, outcome) => openBet(m, outcome ?? "YES")}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section
          className="positions-panel"
          ref={positionsRef}
          id="paper-positions"
        >
          <div className="section-head">
            <h2>Paper positions</h2>
            <p>
              Multiple bets on the same market are allowed · click a row to manage or close
            </p>
          </div>
          {positions.length === 0 ? (
            <p className="empty-copy">
              No positions yet. Scout opportunities, ask AI on a card, or tap Yes/No to paper trade.
            </p>
          ) : (
            <ul className="position-list">
              {positions.map((pos) => {
                const href =
                  pos.marketUrl ||
                  polymarketEventUrl(pos.marketSlug || pos.marketId);
                const isHighlighted = highlightedId === pos.id;
                return (
                  <li
                    key={pos.id}
                    id={`position-${pos.id}`}
                    className={isHighlighted ? "highlighted" : undefined}
                  >
                    <div className="position-row">
                      <button
                        type="button"
                        className="position-main"
                        onClick={() => {
                          setManagePosition(pos);
                          setManageOpen(true);
                        }}
                      >
                        <div>
                          <p className="pos-q">{pos.marketQuestion}</p>
                          <p className="pos-meta">
                          <span className={pos.outcome === "YES" ? "yes" : "no"}>
                            {pos.outcomeLabel || pos.outcome}
                          </span>{" "}
                          @ {formatPercent(pos.entryPrice)} · {formatUsd(pos.amountUsd)}
                            {pos.marketEndDate ? (
                              <>
                                {" · "}
                                <MarketCountdown endDate={pos.marketEndDate} compact />
                              </>
                            ) : null}
                          </p>
                        </div>
                        <p className="pos-payout tabular">
                          {formatUsd(pos.potentialPayout)}
                          <span> if correct</span>
                        </p>
                      </button>
                      <a
                        className="position-external"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Polymarket ↗
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <AiModal
        market={aiMarket}
        open={aiOpen}
        forceKeySetup={aiSeedKey}
        onClose={() => {
          setAiOpen(false);
          setAiSeedKey(false);
        }}
        onApplyBet={(outcome, amount) => {
          setAiOpen(false);
          setAiSeedKey(false);
          if (aiMarket) openBet(aiMarket, outcome, amount);
        }}
      />

      <OpportunitiesModal
        open={opportunitiesOpen}
        markets={markets}
        bankrollUsd={balanceUsd}
        onClose={() => setOpportunitiesOpen(false)}
        onAskAi={(market) => {
          setOpportunitiesOpen(false);
          openAskAi(market);
        }}
        onBet={(market, outcome, amount) => {
          setOpportunityIds((ids) =>
            ids.includes(market.id) ? ids : [...ids, market.id],
          );
          setOpportunitiesOpen(false);
          openBet(market, outcome, amount);
        }}
        onConnectKey={() => {
          setOpportunitiesOpen(false);
          if (markets[0]) openAskAi(markets[0], true);
        }}
      />

      <BetModal
        market={betMarket}
        open={betOpen}
        initialOutcome={betOutcome}
        initialAmount={betAmount}
        onClose={() => setBetOpen(false)}
        onPlaced={focusPosition}
      />

      <PositionModal
        position={managePosition}
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          setManagePosition(null);
        }}
      />
    </div>
  );
}
