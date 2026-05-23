"use client";

import { useEffect, useState } from "react";

interface TopbarProps {
  eventCount: number;
  highCount: number;
  medCount: number;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  sources: never[];
  vesselCount: number;
}

const SOURCES = [
  { name: "ERR", active: true },
  { name: "LSM", active: true },
  { name: "LRT", active: false },
  { name: "AIS", active: true },
];

export default function Topbar({
  highCount,
  medCount,
  onRefresh,
  isLoading,
  lastUpdated,
  vesselCount,
}: TopbarProps) {
  const [time, setTime] = useState("");
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toUTCString().slice(17, 25) + " UTC");
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const freshnessLabel = secondsAgo === null ? null
    : secondsAgo < 60 ? "live"
    : secondsAgo < 300 ? `${Math.floor(secondsAgo/60)}m ago`
    : `${Math.floor(secondsAgo/60)}m ago`;

  const freshnessColor = secondsAgo === null ? "#475569"
    : secondsAgo < 120 ? "#34d399"
    : secondsAgo < 360 ? "#fbbf24"
    : "#f87171";

  return (
    <header style={{
      height: 44,
      flexShrink: 0,
      background: "var(--surface-1)",
      borderBottom: "1px solid var(--border-subtle)",
      display: "flex",
      alignItems: "center",
      padding: "0 18px",
      gap: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 24 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", letterSpacing: "0.06em" }}>
          BALTIC MONITOR
        </span>
        <span style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 500, letterSpacing: "0.08em" }}>
          BETA
        </span>
      </div>

      <div style={{ width: 1, height: 16, background: "var(--border-subtle)", marginRight: 20 }} />

      {/* Alert counts — only show if present */}
      <div style={{ display: "flex", gap: 8, marginRight: 20 }}>
        {highCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171" }} />
            <span style={{ fontSize: 11, color: "#fca5a5", fontWeight: 600 }}>{highCount} critical</span>
          </div>
        )}
        {medCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24" }} />
            <span style={{ fontSize: 11, color: "#fde68a", fontWeight: 500 }}>{medCount} active</span>
          </div>
        )}
      </div>

      {/* Source status */}
      <div style={{ display: "flex", gap: 10, marginRight: 20 }}>
        {SOURCES.map(src => (
          <div key={src.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: src.active ? "#34d399" : "#2d3748" }} />
            <span style={{ fontSize: 10, color: src.active ? "var(--text-muted)" : "var(--text-faint)", letterSpacing: "0.04em" }}>
              {src.name}
            </span>
          </div>
        ))}
      </div>

      {/* Vessel count */}
      {vesselCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#22d3ee" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{vesselCount} vessels</span>
        </div>
      )}

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        {freshnessLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: freshnessColor }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{freshnessLabel}</span>
          </div>
        )}

        <span style={{ fontSize: 10, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{time}</span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            fontSize: 11,
            color: isLoading ? "var(--text-faint)" : "var(--text-muted)",
            background: "transparent",
            border: "1px solid var(--border-subtle)",
            padding: "3px 10px",
            borderRadius: 4,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "···" : "Refresh"}
        </button>
      </div>
    </header>
  );
}