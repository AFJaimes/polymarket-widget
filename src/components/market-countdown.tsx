"use client";

import { useEffect, useState } from "react";

export type CountdownParts = {
  totalMs: number;
  pastTarget: boolean;
  label: string;
  shortLabel: string;
  prefix: string;
  shortPrefix: string;
};

function formatTargetDate(endMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(endMs));
}

function formatRemaining(totalMs: number): { label: string; shortLabel: string } {
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (days >= 1) {
    return {
      label: `${days}d ${pad(hours)}h ${pad(minutes)}m`,
      shortLabel: `${days}d ${pad(hours)}h`,
    };
  }

  return {
    label: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    shortLabel: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

export function getCountdownParts(
  endDate: string | undefined,
  nowMs = Date.now(),
): CountdownParts | null {
  if (!endDate) return null;
  const endMs = Date.parse(endDate);
  if (!Number.isFinite(endMs)) return null;

  const totalMs = endMs - nowMs;
  if (totalMs <= 0) {
    const dateLabel = formatTargetDate(endMs);
    return {
      totalMs: 0,
      pastTarget: true,
      label: dateLabel,
      shortLabel: dateLabel,
      prefix: "Target",
      shortPrefix: "Target",
    };
  }

  const remaining = formatRemaining(totalMs);
  return {
    totalMs,
    pastTarget: false,
    label: remaining.label,
    shortLabel: remaining.shortLabel,
    prefix: "Resolves in",
    shortPrefix: "Resolves",
  };
}

export function useCountdown(endDate: string | undefined): CountdownParts | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endDate) return;
    const endMs = Date.parse(endDate);
    if (!Number.isFinite(endMs) || endMs <= Date.now()) return;

    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endDate]);

  return getCountdownParts(endDate, now);
}

interface MarketCountdownProps {
  endDate?: string;
  closed?: boolean;
  acceptingOrders?: boolean;
  compact?: boolean;
  className?: string;
}

export function MarketCountdown({
  endDate,
  closed = false,
  acceptingOrders = true,
  compact = false,
  className = "",
}: MarketCountdownProps) {
  const parts = useCountdown(endDate);
  const tradable = !closed && acceptingOrders;

  if (!tradable) {
    return (
      <span className={`countdown ended ${className}`.trim()} title="Trading closed on Polymarket">
        <span className="countdown-label">Closed</span>
      </span>
    );
  }

  if (!parts) return null;

  const urgent = !parts.pastTarget && parts.totalMs < 24 * 60 * 60 * 1000;
  const pastOpen = parts.pastTarget;

  return (
    <span
      className={`countdown ${pastOpen ? "past-open" : ""} ${urgent ? "urgent" : ""} ${className}`.trim()}
      title={
        endDate
          ? pastOpen
            ? `Scheduled target ${new Date(endDate).toLocaleString()} — market still accepting orders`
            : `Scheduled resolution ${new Date(endDate).toLocaleString()}`
          : undefined
      }
    >
      <span className="countdown-label">
        {compact ? parts.shortPrefix : parts.prefix}
      </span>{" "}
      <time className="tabular" dateTime={endDate}>
        {compact ? parts.shortLabel : parts.label}
      </time>
      {pastOpen && compact ? <span className="countdown-open"> · open</span> : null}
      {pastOpen && !compact ? <span className="countdown-open"> · still open</span> : null}
    </span>
  );
}
