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

export default function Topbar({ highCount, medCount, onRefresh, isLoading, lastUpdated, vesselCount }: TopbarProps) {
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
    : secondsAgo < 60 ? "Live"
    : secondsAgo < 300 ? `${Math.floor(secondsAgo / 60)}m ago`
    : `${Math.floor(secondsAgo / 60)}m ago`;

  const freshnessColor = secondsAgo === null ? "#94a3b8"
    : secondsAgo < 120 ? "#059669"
    : secondsAgo < 360 ? "#d97706"
    : "#dc2626";

  return (
    <header style={{
      height: 48, flexShrink: 0,
      background: "#fff",
      borderBottom: "1px solid var(--ui-border)",
      display: "flex", alignItems: "center",
      padding: "0 20px", gap: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 28 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: "#2563eb" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
          Baltic Monitor
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600, color: "#fff",
          background: "#2563eb", borderRadius: 3,
          padding: "1px 5px", letterSpacing: "0.05em",
        }}>
          BETA
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: "var(--ui-border)", marginRight: 20 }} />

      {/* Alert badges */}
      <div style={{ display: "flex", gap: 8, marginRight: 20 }}>
        {highCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 5, padding: "3px 9px",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#dc2626" }} />
            <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>{highCount} critical</span>
          </div>
        )}
        {medCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 5, padding: "3px 9px",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#d97706" }} />
            <span style={{ fontSize: 11, color: "#92400e", fontWeight: 500 }}>{medCount} active</span>
          </div>
        )}
      </div>

      {/* Sources */}
      <div style={{ display: "flex", gap: 12 }}>
        {SOURCES.map(src => (
          <div key={src.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: src.active ? "#059669" : "#e2e8f0" }} />
            <span style={{ fontSize: 11, color: src.active ? "#475569" : "#cbd5e1", fontWeight: 500 }}>
              {src.name}
            </span>
          </div>
        ))}
      </div>

      {/* Right */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        {vesselCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0891b2" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>{vesselCount} vessels</span>
          </div>
        )}

        {freshnessLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: freshnessColor }} />
            <span style={{ fontSize: 11, color: "#475569" }}>{freshnessLabel}</span>
          </div>
        )}

        <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{time}</span>

        <button onClick={onRefresh} disabled={isLoading} style={{
          fontSize: 11, fontWeight: 500,
          color: isLoading ? "#94a3b8" : "#475569",
          background: "var(--ui-bg-2)",
          border: "1px solid var(--ui-border)",
          padding: "4px 12px", borderRadius: 5,
          cursor: isLoading ? "not-allowed" : "pointer",
        }}>
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </div>
    </header>
  );
}