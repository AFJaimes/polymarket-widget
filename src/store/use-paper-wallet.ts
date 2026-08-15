"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PaperPosition, PlaceBetInput } from "@/lib/types";

const STARTING_BALANCE = 1000;

interface PaperWalletState {
  balanceUsd: number;
  positions: PaperPosition[];
  connected: boolean;
  connectDemo: () => void;
  disconnect: () => void;
  placeBet: (
    input: PlaceBetInput,
  ) => { ok: true; positionId: string } | { ok: false; error: string };
  closePosition: (
    positionId: string,
  ) => { ok: true; refundedUsd: number } | { ok: false; error: string };
  resetDemo: () => void;
}

export const usePaperWallet = create<PaperWalletState>()(
  persist(
    (set, get) => ({
      balanceUsd: STARTING_BALANCE,
      positions: [],
      connected: true,
      connectDemo: () => set({ connected: true }),
      disconnect: () => set({ connected: false }),
      placeBet: (input) => {
        const { balanceUsd, positions, connected } = get();
        if (!connected) {
          return { ok: false, error: "Connect the demo wallet first." };
        }
        if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
          return { ok: false, error: "Enter a valid bet amount." };
        }
        if (input.amountUsd > balanceUsd) {
          return { ok: false, error: "Insufficient demo balance." };
        }
        if (input.amountUsd < 0.01) {
          return { ok: false, error: "Minimum paper bet is $0.01." };
        }
        if (input.entryPrice <= 0 || input.entryPrice >= 1) {
          return { ok: false, error: "Invalid market price." };
        }

        const shares = input.amountUsd / input.entryPrice;
        const position: PaperPosition = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          marketId: input.marketId,
          marketQuestion: input.marketQuestion,
          marketSlug: input.marketSlug,
          marketUrl: input.marketUrl,
          marketEndDate: input.marketEndDate,
          outcome: input.outcome,
          outcomeLabel: input.outcomeLabel,
          amountUsd: input.amountUsd,
          entryPrice: input.entryPrice,
          shares,
          potentialPayout: shares,
          createdAt: new Date().toISOString(),
        };

        set({
          balanceUsd: Number((balanceUsd - input.amountUsd).toFixed(2)),
          positions: [position, ...positions],
        });

        return { ok: true, positionId: position.id };
      },
      closePosition: (positionId) => {
        const { balanceUsd, positions } = get();
        const position = positions.find((p) => p.id === positionId);
        if (!position) {
          return { ok: false, error: "Position not found." };
        }

        // Paper exit: refund stake at cost (demo simplification of selling shares).
        const refundedUsd = position.amountUsd;
        set({
          balanceUsd: Number((balanceUsd + refundedUsd).toFixed(2)),
          positions: positions.filter((p) => p.id !== positionId),
        });

        return { ok: true, refundedUsd };
      },
      resetDemo: () =>
        set({
          balanceUsd: STARTING_BALANCE,
          positions: [],
          connected: true,
        }),
    }),
    { name: "polymarket-paper-wallet" },
  ),
);

export const PAPER_STARTING_BALANCE = STARTING_BALANCE;
