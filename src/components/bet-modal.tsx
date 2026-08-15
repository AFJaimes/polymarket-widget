"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MarketCountdown } from "@/components/market-countdown";
import {
  formatPercent,
  formatUsd,
  getOutcomeLabel,
  getOutcomePrice,
  isMarketTradable,
  shortOutcomeLabel,
} from "@/lib/polymarket";
import type { Market, OutcomeSide } from "@/lib/types";
import { usePaperWallet } from "@/store/use-paper-wallet";

interface BetModalProps {
  market: Market | null;
  initialOutcome?: OutcomeSide;
  initialAmount?: number;
  open: boolean;
  onClose: () => void;
  onPlaced?: (positionId: string) => void;
}

export function BetModal({
  market,
  initialOutcome = "YES",
  initialAmount,
  open,
  onClose,
  onPlaced,
}: BetModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const placeBet = usePaperWallet((s) => s.placeBet);
  const balanceUsd = usePaperWallet((s) => s.balanceUsd);

  const [outcome, setOutcome] = useState<OutcomeSide>(initialOutcome);
  const [amount, setAmount] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && market) {
      if (!dialog.open) dialog.showModal();
      setOutcome(initialOutcome);
      setAmount(formatAmountInput(initialAmount ?? 25));
      setError(null);
      setSubmitting(false);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, market, initialOutcome, initialAmount]);

  if (!market) return null;

  const tradable = isMarketTradable(market);
  const label = getOutcomeLabel(market, outcome);
  const price = getOutcomePrice(market, outcome);
  const amountNum = parseAmountInput(amount);
  const shares = price > 0 && amountNum > 0 ? amountNum / price : 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!market || submitting) return;
    if (!isMarketTradable(market)) {
      setError("This market is closed for trading on Polymarket.");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum < 0.01) {
      setError("Enter a valid amount of at least $0.01.");
      return;
    }
    if (amountNum > balanceUsd) {
      setError("Insufficient demo balance.");
      return;
    }

    setSubmitting(true);
    const result = placeBet({
      marketId: market.id,
      marketQuestion: market.question,
      marketSlug: market.slug,
      marketUrl: market.url,
      marketEndDate: market.endDate,
      outcome,
      outcomeLabel: getOutcomeLabel(market, outcome),
      amountUsd: Number(amountNum.toFixed(2)),
      entryPrice: price,
    });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onClose();
    onPlaced?.(result.positionId);
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form className="dialog-panel" onSubmit={onSubmit}>
        <header className="dialog-head">
          <h2 id={titleId}>Place paper bet</h2>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="dialog-market">{market.question}</p>
        <p className="dialog-meta">
          Available {formatUsd(balanceUsd)} · {label} @ {formatPercent(price)}
          {" · "}
          <MarketCountdown
            endDate={market.endDate}
            closed={market.closed}
            acceptingOrders={market.acceptingOrders}
          />{" "}
          ·{" "}
          <a
            className="inline-link"
            href={market.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Polymarket ↗
          </a>
        </p>

        {!tradable ? (
          <p className="form-error">
            Trading is closed on Polymarket for this market. Paper bets are disabled.
          </p>
        ) : null}

        <div className="outcome-toggle" role="group" aria-label="Outcome">
          <button
            type="button"
            className={outcome === "YES" ? "active yes" : "yes"}
            onClick={() => setOutcome("YES")}
            disabled={!tradable}
            title={market.outcomes[0]}
          >
            {shortOutcomeLabel(market.outcomes[0], 16)}{" "}
            {formatPercent(market.prices[0])}
          </button>
          <button
            type="button"
            className={outcome === "NO" ? "active no" : "no"}
            onClick={() => setOutcome("NO")}
            disabled={!tradable}
            title={market.outcomes[1]}
          >
            {shortOutcomeLabel(market.outcomes[1], 16)}{" "}
            {formatPercent(market.prices[1])}
          </button>
        </div>

        <label className="field">
          <span>Amount (USDC)</span>
          <input
            type="number"
            min={0.01}
            max={balanceUsd}
            step={0.01}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(normalizeAmountTyping(e.target.value))}
            required
            disabled={!tradable || submitting}
          />
        </label>

        <div className="quick-amounts" aria-label="Quick amounts">
          {[1, 5, 10, 25].map((value) => (
            <button
              key={value}
              type="button"
              className="btn ghost compact"
              disabled={!tradable || submitting}
              onClick={() => setAmount(formatAmountInput(value))}
            >
              +${value}
            </button>
          ))}
        </div>

        <dl className="bet-math">
          <div>
            <dt>Est. shares</dt>
            <dd className="tabular">{shares.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Potential payout</dt>
            <dd className="tabular">{formatUsd(shares)}</dd>
          </div>
        </dl>

        {error ? <p className="form-error">{error}</p> : null}

        <footer className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={!tradable || submitting}
          >
            Confirm bet
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return "25";
  return Number(value.toFixed(2)).toString();
}

function normalizeAmountTyping(value: string): string {
  return value.replace(",", ".");
}

function parseAmountInput(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}
