"use client";

import { useEffect, useRef, useState } from "react";

interface MarketSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmitSearch: (value: string) => void;
}

export function MarketSearch({
  value,
  onChange,
  onSubmitSearch,
}: MarketSearchProps) {
  const [local, setLocal] = useState(value);
  const skipFirst = useRef(true);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    const handle = window.setTimeout(() => {
      onChange(local);
      onSubmitSearch(local);
    }, 320);

    return () => window.clearTimeout(handle);
    // Debounce local keystrokes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <label className="search-field">
      <span className="sr-only">Search markets</span>
      <svg
        aria-hidden
        className="search-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M20 20l-3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search live Polymarket markets…"
        autoComplete="off"
      />
      {local ? (
        <button
          type="button"
          className="search-clear"
          onClick={() => {
            setLocal("");
            onChange("");
            onSubmitSearch("");
          }}
        >
          Clear
        </button>
      ) : null}
    </label>
  );
}
