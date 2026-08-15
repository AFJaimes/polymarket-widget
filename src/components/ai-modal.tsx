"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MarketCountdown } from "@/components/market-countdown";
import {
  clearStoredGeminiApiKey,
  getStoredGeminiApiKey,
  maskApiKey,
  setStoredGeminiApiKey,
} from "@/lib/ai-key";
import { formatPercent, formatUsd, getOutcomeLabel } from "@/lib/polymarket";
import type { AiAdvice, Market, OutcomeSide } from "@/lib/types";
import { usePaperWallet } from "@/store/use-paper-wallet";

interface AiModalProps {
  market: Market | null;
  open: boolean;
  onClose: () => void;
  onApplyBet: (outcome: OutcomeSide, amount: number) => void;
  forceKeySetup?: boolean;
}

type KeyStatus =
  | { state: "checking" }
  | { state: "ready"; source: "server" | "client"; label: string }
  | { state: "needed" };

export function AiModal({
  market,
  open,
  onClose,
  onApplyBet,
  forceKeySetup = false,
}: AiModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const balanceUsd = usePaperWallet((s) => s.balanceUsd);

  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ state: "checking" });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [ignoreForceSetup, setIgnoreForceSetup] = useState(false);

  const [advice, setAdvice] = useState<AiAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && market) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, market]);

  useEffect(() => {
    if (!open) return;
    setIgnoreForceSetup(false);
  }, [open, forceKeySetup]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function hydrateKeyStatus() {
      setKeyStatus({ state: "checking" });
      setKeyError(null);
      const shouldForce = forceKeySetup && !ignoreForceSetup;

      try {
        const res = await fetch("/api/ai-key");
        const data = (await res.json()) as { serverConfigured?: boolean };
        if (cancelled) return;

        if (data.serverConfigured && !shouldForce) {
          setKeyStatus({
            state: "ready",
            source: "server",
            label: "Server GEMINI_API_KEY",
          });
          return;
        }

        const stored = getStoredGeminiApiKey();
        if (stored && !shouldForce) {
          setKeyStatus({
            state: "ready",
            source: "client",
            label: maskApiKey(stored),
          });
          return;
        }

        setKeyStatus({ state: "needed" });
      } catch {
        if (cancelled) return;
        const stored = getStoredGeminiApiKey();
        if (stored && !(forceKeySetup && !ignoreForceSetup)) {
          setKeyStatus({
            state: "ready",
            source: "client",
            label: maskApiKey(stored),
          });
        } else {
          setKeyStatus({ state: "needed" });
        }
      }
    }

    void hydrateKeyStatus();
    return () => {
      cancelled = true;
    };
  }, [open, reloadToken, forceKeySetup, ignoreForceSetup]);

  useEffect(() => {
    if (!open || !market || keyStatus.state !== "ready") return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setAdvice(null);
      try {
        const clientKey =
          keyStatus.state === "ready" && keyStatus.source === "client"
            ? getStoredGeminiApiKey()
            : null;

        const res = await fetch("/api/ai-advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            market,
            bankrollUsd: balanceUsd,
            apiKey: clientKey || undefined,
          }),
        });
        const data = (await res.json()) as AiAdvice & {
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          if (data.error === "missing_api_key") {
            clearStoredGeminiApiKey();
            setKeyStatus({ state: "needed" });
          }
          throw new Error(data.message || data.error || "Advisor failed");
        }
        if (!cancelled) setAdvice(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Advisor failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, market, balanceUsd, keyStatus, reloadToken]);

  async function onVerifyKey(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        model?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not verify this API key.");
      }

      setStoredGeminiApiKey(apiKeyInput);
      setApiKeyInput("");
      setIgnoreForceSetup(true);
      setReloadToken((value) => value + 1);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function onDisconnectKey() {
    clearStoredGeminiApiKey();
    setAdvice(null);
    setError(null);
    setKeyStatus({ state: "needed" });
  }

  if (!market) return null;

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
      <div className="dialog-panel ai-panel">
        <header className="dialog-head">
          <h2 id={titleId}>AI Market Advisor</h2>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="dialog-market">{market.question}</p>
        <p className="dialog-meta">
          Crowd: {market.outcomes[0]} {formatPercent(market.prices[0])} ·{" "}
          {market.outcomes[1]} {formatPercent(market.prices[1])}
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
            View on Polymarket ↗
          </a>
        </p>

        {keyStatus.state === "checking" ? (
          <div className="ai-skeleton" aria-busy="true" aria-label="Checking API key">
            <div className="skel line wide" />
            <div className="skel line short" />
          </div>
        ) : null}

        {keyStatus.state === "needed" ? (
          <form className="api-key-panel" onSubmit={onVerifyKey}>
            <p className="api-key-copy">
              Connect a Gemini API key to research this market with live web
              sources. No mock recommendations are shown without a valid key.
            </p>
            <label className="field">
              <span>Gemini API key</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="AIza…"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                required
              />
            </label>
            <p className="api-key-help">
              Get a free key at{" "}
              <a
                className="inline-link"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google AI Studio
              </a>
              . Stored only in this browser unless you set{" "}
              <code>GEMINI_API_KEY</code> on the server.
            </p>
            {keyError ? <p className="form-error">{keyError}</p> : null}
            <footer className="dialog-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                Close
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={verifying || !apiKeyInput.trim()}
              >
                {verifying ? "Verifying…" : "Verify & connect"}
              </button>
            </footer>
          </form>
        ) : null}

        {keyStatus.state === "ready" ? (
          <>
            <div className="api-key-status">
              <p>
                Connected · <span className="tabular">{keyStatus.label}</span>
              </p>
              {keyStatus.source === "client" ? (
                <button type="button" className="btn ghost compact" onClick={onDisconnectKey}>
                  Disconnect
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="ai-skeleton" aria-busy="true" aria-label="Researching market">
                <div className="skel line wide" />
                <div className="skel line" />
                <div className="skel line" />
                <div className="skel line short" />
              </div>
            ) : null}

            {error ? (
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

            {advice ? (
              <div className="ai-result">
                <div className="ai-reco">
                  <p>
                    Recommendation:{" "}
                    <strong className={advice.recommendation === "YES" ? "yes" : "no"}>
                      BET {getOutcomeLabel(market, advice.recommendation)}
                    </strong>
                  </p>
                  <p className="confidence">
                    Confidence {Math.round(advice.confidence)}%
                    <span className="source">
                      {" "}
                      · {advice.source}
                      {advice.model ? `/${advice.model}` : ""}
                    </span>
                  </p>
                </div>

                <p className="ai-reasoning">{advice.reasoning}</p>

                <ul className="ai-points">
                  {advice.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>

                {advice.edgeEstimate ? (
                  <p className="ai-edge">{advice.edgeEstimate}</p>
                ) : null}

                {advice.sources && advice.sources.length > 0 ? (
                  <div className="ai-sources">
                    <p className="ai-sources-label">Sources</p>
                    <ul>
                      {advice.sources.map((source) => (
                        <li key={source}>{renderSource(source)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="ai-bet">
                  {advice.suggestedBetUsd > 0 ? (
                    <>
                      Suggested bet:{" "}
                      <strong className="tabular">
                        {formatUsd(advice.suggestedBetUsd)}
                      </strong>
                      <span> (fractional Kelly, capped)</span>
                    </>
                  ) : (
                    <>
                      Suggested stake:{" "}
                      <strong>Pass</strong>
                      <span> — no clear edge vs crowd price</span>
                    </>
                  )}
                </p>

                <p className="disclaimer">
                  Not financial advice. Paper trading only. Research may be incomplete.
                </p>

                <footer className="dialog-actions">
                  <button type="button" className="btn ghost" onClick={onClose}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={advice.suggestedBetUsd <= 0}
                    onClick={() =>
                      onApplyBet(advice.recommendation, advice.suggestedBetUsd)
                    }
                  >
                    {advice.suggestedBetUsd > 0 ? "Use suggested bet" : "No bet suggested"}
                  </button>
                </footer>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </dialog>
  );
}

function renderSource(source: string) {
  const urlMatch = source.match(/https?:\/\/\S+/);
  if (!urlMatch) return source;
  const url = urlMatch[0];
  const label = source.replace(url, "").replace(/[—-]\s*$/, "").trim() || url;
  return (
    <a className="inline-link" href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
