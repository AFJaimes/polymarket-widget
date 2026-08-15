"use client";

import { useEffect, useId, useRef } from "react";
import { MarketCountdown } from "@/components/market-countdown";
import { formatPercent, formatUsd, polymarketEventUrl } from "@/lib/polymarket";
import type { PaperPosition } from "@/lib/types";
import { usePaperWallet } from "@/store/use-paper-wallet";

interface PositionModalProps {
  position: PaperPosition | null;
  open: boolean;
  onClose: () => void;
}

export function PositionModal({ position, open, onClose }: PositionModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closePosition = usePaperWallet((s) => s.closePosition);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && position) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, position]);

  if (!position) return null;

  const href =
    position.marketUrl ||
    polymarketEventUrl(position.marketSlug || position.marketId);

  function onClosePosition() {
    if (!position) return;
    const result = closePosition(position.id);
    if (result.ok) onClose();
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
      <div className="dialog-panel">
        <header className="dialog-head">
          <h2 id={titleId}>Manage position</h2>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="dialog-market">{position.marketQuestion}</p>
        <p className="dialog-meta">
          <span className={position.outcome === "YES" ? "yes" : "no"}>
            {position.outcomeLabel || position.outcome}
          </span>{" "}
          @ {formatPercent(position.entryPrice)} · Stake{" "}
          {formatUsd(position.amountUsd)}
          {position.marketEndDate ? (
            <>
              {" · "}
              <MarketCountdown endDate={position.marketEndDate} />
            </>
          ) : null}
        </p>

        <dl className="bet-math">
          <div>
            <dt>Shares</dt>
            <dd className="tabular">{position.shares.toFixed(2)}</dd>
          </div>
          <div>
            <dt>If correct</dt>
            <dd className="tabular">{formatUsd(position.potentialPayout)}</dd>
          </div>
        </dl>

        <p className="position-hint">
          On Polymarket you do not edit a filled bet — you exit by selling shares.
          This paper close refunds your original stake.
        </p>

        <footer className="dialog-actions position-actions">
          <a
            className="btn ghost"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on Polymarket
          </a>
          <button type="button" className="btn danger" onClick={onClosePosition}>
            Close position
          </button>
        </footer>
      </div>
    </dialog>
  );
}
