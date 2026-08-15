"use client";

import { formatUsd } from "@/lib/polymarket";
import { usePaperWallet } from "@/store/use-paper-wallet";

export function WalletHeader() {
  const balanceUsd = usePaperWallet((s) => s.balanceUsd);
  const positions = usePaperWallet((s) => s.positions);
  const connected = usePaperWallet((s) => s.connected);
  const connectDemo = usePaperWallet((s) => s.connectDemo);
  const resetDemo = usePaperWallet((s) => s.resetDemo);

  return (
    <header className="wallet-header">
      <div className="brand-block">
        <p className="brand">Polymarket AI Widget</p>
        <p className="brand-sub">Paper trading · live Gamma markets</p>
      </div>

      <div className="wallet-status">
        <div className="balance-pill">
          <span className="label">{connected ? "Demo USDC" : "Disconnected"}</span>
          <strong className="tabular">{formatUsd(balanceUsd)}</strong>
        </div>
        <p className="positions-count">
          {positions.length} open position{positions.length === 1 ? "" : "s"}
        </p>
        <div className="wallet-actions">
          {!connected ? (
            <button type="button" className="btn primary" onClick={connectDemo}>
              Connect demo user
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={resetDemo}>
              Reset $1,000
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
