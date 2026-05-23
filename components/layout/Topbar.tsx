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
    : `${Math.floor(secondsAgo / 60)}m ago`;

  const freshnessColor = secondsAgo === null ? "#4a5d75"
    : secondsAgo < 120 ? "#10b981"
    : secondsAgo < 360 ? "#f59e0b"
    : "#ef4444";

  return (
    <header style={{
      height: 46, flexShrink: 0,
      background: "var(--surface-1)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 20px", gap: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 24 }}>
        <div style={{ width: 7, height: 7, borderRadius: 2, background: "#3b82f6" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f4f8", letterSpacing: "-0.01em" }}>
          Baltic Monitor
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "#3b82f6", letterSpacing: "0.06em", opacity: 0.7 }}>
          BETA
        </span>
      </div>

      <div style={{ width: 1, height: 16, background: "var(--border)", marginRight: 20 }} />

      {/* Alert badges */}
      <div style={{ display: "flex", gap: 8, marginRight: 20 }}>
        {highCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, padding: "2px 8px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />
            <span style={{ fontSize: 11, color: "#fca5a5", fontWeight: 600 }}>{highCount} critical</span>
          </div>
        )}
        {medCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 4, padding: "2px 8px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ fontSize: 11, color: "#fde68a", fontWeight: 500 }}>{medCount} active</span>
          </div>
        )}
      </div>

      {/* Sources */}
      <div style={{ display: "flex", gap: 14 }}>
        {SOURCES.map(src => (
          <div key={src.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: src.active ? "#10b981" : "#2d3d52" }} />
            <span style={{ fontSize: 11, color: src.active ? "#8899b0" : "#2d3d52" }}>{src.name}</span>
          </div>
        ))}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        {vesselCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22d3ee" }} />
            <span style={{ fontSize: 11, color: "#8899b0" }}>{vesselCount} vessels</span>
          </div>
        )}

        {freshnessLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: freshnessColor }} />
            <span style={{ fontSize: 11, color: "#8899b0" }}>{freshnessLabel}</span>
          </div>
        )}

        <span style={{ fontSize: 11, color: "#4a5d75", fontVariantNumeric: "tabular-nums" }}>{time}</span>

        <button onClick={onRefresh} disabled={isLoading} style={{
          fontSize: 11, color: isLoading ? "#4a5d75" : "#8899b0",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          padding: "4px 12px", borderRadius: 5,
          cursor: isLoading ? "not-allowed" : "pointer",
        }}>
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </div>
    </header>
  );
}