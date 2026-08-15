"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getStoredGeminiApiKey } from "@/lib/ai-key";
import {
  formatPercent,
  formatUsd,
  getOutcomeLabel,
  getOutcomePrice,
} from "@/lib/polymarket";
import type {
  AiOpportunitiesResult,
  AiOpportunity,
  Market,
  OutcomeSide,
} from "@/lib/types";

interface OpportunitiesModalProps {
  open: boolean;
  markets: Market[];
  bankrollUsd: number;
  onClose: () => void;
  onAskAi: (market: Market) => void;
  onBet: (market: Market, outcome: OutcomeSide, amount: number) => void;
  onConnectKey: () => void;
}

export function OpportunitiesModal({
  open,
  markets,
  bankrollUsd,
  onClose,
  onAskAi,
  onBet,
  onConnectKey,
}: OpportunitiesModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiOpportunitiesResult | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const clientKey = getStoredGeminiApiKey();
        const res = await fetch("/api/ai-opportunities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markets: markets.slice(0, 16),
            bankrollUsd,
            apiKey: clientKey || undefined,
          }),
        });
        const data = (await res.json()) as AiOpportunitiesResult & {
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          if (data.error === "missing_api_key") {
            throw new Error("missing_api_key");
          }
          throw new Error(data.message || data.error || "Research failed");
        }
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Research failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, markets, bankrollUsd, reloadToken]);

  function resolveMarket(item: AiOpportunity): Market | undefined {
    return markets.find((market) => market.id === item.marketId);
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog opportunities-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog-panel opportunities-panel">
        <header className="dialog-head">
          <div>
            <h2 id={titleId}>AI good opportunities</h2>
            <p className="dialog-meta opportunities-lede">
              Scouts for solid, sourced edge with real payout upside — not penny favorites.
            </p>
          </div>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {loading ? (
          <div className="opportunities-result" aria-busy="true" aria-label="Scanning opportunities">
            <div className="opportunities-loading">
              <div className="opportunity-card skel-card">
                <div className="skel line wide" />
                <div className="skel line" />
                <div className="skel line short" />
              </div>
              <div className="opportunity-card skel-card">
                <div className="skel line wide" />
                <div className="skel line" />
                <div className="skel line short" />
              </div>
              <div className="opportunity-card skel-card">
                <div className="skel line wide" />
                <div className="skel line" />
                <div className="skel line short" />
              </div>
            </div>
          </div>
        ) : null}

        {error === "missing_api_key" ? (
          <div className="ai-error-box">
            <p className="form-error">
              Connect a Gemini API key first so the scout can research real sources.
            </p>
            <button type="button" className="btn primary" onClick={onConnectKey}>
              Connect API key
            </button>
          </div>
        ) : null}

        {error && error !== "missing_api_key" ? (
          <div className="ai-error-box">
            <p className="form-error">{error}</p>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Retry research
            </button>
          </div>
        ) : null}

        {result ? (
          <div className="opportunities-result">
            <div className="opportunities-banner">
              <p className="opportunities-summary">{result.summary}</p>
              <p className="confidence">
                {result.source}
                {result.model ? `/${result.model}` : ""} · {result.opportunities.length} picks
              </p>
            </div>

            {result.opportunities.length === 0 ? (
              <p className="disclaimer">
                Nothing on this board cleared the revenue bar. Try refreshing markets or a deeper Ask AI on a mid-priced tile.
              </p>
            ) : null}

            <ul className="opportunity-list">
              {result.opportunities.map((item) => {
                const market = resolveMarket(item);
                const label = market
                  ? getOutcomeLabel(market, item.recommendation)
                  : item.recommendation;
                const crowd = market
                  ? formatPercent(getOutcomePrice(market, item.recommendation))
                  : null;

                return (
                  <li key={`${item.marketId}-${item.recommendation}`}>
                    <article className="opportunity-card">
                      <div className="opportunity-main">
                        <header className="opportunity-head">
                          <p className="opportunity-q">{item.marketQuestion}</p>
                          <p
                            className={`opportunity-pill ${item.recommendation === "YES" ? "yes" : "no"}`}
                          >
                            {label}
                            <span className="tabular"> · {Math.round(item.confidence)}%</span>
                          </p>
                        </header>
                        <p className="opportunity-thesis">{item.thesis}</p>
                      </div>

                      <div className="opportunity-stats">
                        <div className="opportunity-stat opportunity-stat--edge">
                          <span>Edge</span>
                          <strong>{item.edgeEstimate}</strong>
                        </div>
                        <div className="opportunity-stat opportunity-stat--upside">
                          <span>Upside</span>
                          <strong>{item.upsideNote}</strong>
                        </div>
                        <div className="opportunity-stat opportunity-stat--meta">
                          <div>
                            <span>Crowd</span>
                            <strong className="tabular">{crowd ?? "—"}</strong>
                          </div>
                          <div>
                            <span>Bet</span>
                            <strong className="tabular">
                              {formatUsd(item.suggestedBetUsd)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="opportunity-foot">
                        <div className="opportunity-actions">
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={!market}
                            onClick={() => market && onAskAi(market)}
                          >
                            Deep dive
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={!market}
                            onClick={() =>
                              market &&
                              onBet(market, item.recommendation, item.suggestedBetUsd)
                            }
                          >
                            Use bet
                          </button>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>

            {result.sources && result.sources.length > 0 ? (
              <div className="ai-sources">
                <p className="ai-sources-label">Sources</p>
                <ul>
                  {result.sources.slice(0, 4).map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="disclaimer">
              Not financial advice. Paper trading only. Edge estimates can be wrong.
            </p>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
