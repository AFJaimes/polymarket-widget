"use client";

import { MarketCountdown } from "@/components/market-countdown";
import {
  formatPercent,
  formatVolume,
  getOutcomeLabel,
  getOutcomePrice,
  isMarketTradable,
  shortOutcomeLabel,
} from "@/lib/polymarket";
import type { Market, OutcomeSide } from "@/lib/types";

interface MarketCardProps {
  market: Market;
  onAskAi: (market: Market) => void;
  onBet: (market: Market, outcome?: OutcomeSide) => void;
  highlighted?: boolean;
}

export function MarketCard({
  market,
  onAskAi,
  onBet,
  highlighted = false,
}: MarketCardProps) {
  const tradable = isMarketTradable(market);
  const labelA = getOutcomeLabel(market, "YES");
  const labelB = getOutcomeLabel(market, "NO");
  const priceA = getOutcomePrice(market, "YES");
  const priceB = getOutcomePrice(market, "NO");
  const chanceA = Math.round(priceA * 100);

  return (
    <article className={`market-card ${highlighted ? "opportunity" : ""}`}>
      <a
        className="market-card-top"
        href={market.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on Polymarket"
      >
        {market.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={market.image}
            alt=""
            className="market-card-thumb"
            width={44}
            height={44}
          />
        ) : (
          <div className="market-card-thumb placeholder" aria-hidden />
        )}
        <h2>{market.question}</h2>
      </a>

      <div className="market-card-odds" aria-label="Current odds">
        <div className="chance-row">
          <span className="chance-label">{shortOutcomeLabel(labelA, 18)} chance</span>
          <strong className="tabular yes">{formatPercent(priceA)}</strong>
        </div>
        <div
          className="chance-bar"
          style={{ ["--yes-pct" as string]: `${chanceA}%` }}
          aria-hidden
        >
          <span className="chance-fill" />
        </div>
        <div className="outcome-btns">
          <button
            type="button"
            className="outcome-btn yes"
            disabled={!tradable}
            title={labelA}
            onClick={() => onBet(market, "YES")}
          >
            <span className="outcome-name">{shortOutcomeLabel(labelA)}</span>
            <span className="tabular">{formatPercent(priceA)}</span>
          </button>
          <button
            type="button"
            className="outcome-btn no"
            disabled={!tradable}
            title={labelB}
            onClick={() => onBet(market, "NO")}
          >
            <span className="outcome-name">{shortOutcomeLabel(labelB)}</span>
            <span className="tabular">{formatPercent(priceB)}</span>
          </button>
        </div>
      </div>

      <footer className="market-card-foot">
        <div className="market-card-meta">
          <span>{formatVolume(market.volume)} Vol.</span>
          {market.endDate || market.closed ? (
            <MarketCountdown
              endDate={market.endDate}
              closed={market.closed}
              acceptingOrders={market.acceptingOrders}
              compact
            />
          ) : (
            <span className="live-dot">Active</span>
          )}
        </div>
        <div className="market-card-actions">
          <button type="button" className="btn ghost" onClick={() => onAskAi(market)}>
            Ask AI
          </button>
        </div>
      </footer>
    </article>
  );
}
