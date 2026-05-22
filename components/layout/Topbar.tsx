"use client";

import { useEffect, useState } from "react";

interface Source {
  name: string;
  country: string;
  active: boolean;
}

interface TopbarProps {
  eventCount: number;
  highCount: number;
  medCount: number;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  sources: Source[];
  vesselCount: number;
}

const SOURCES: Source[] = [
  { name: "ERR", country: "EE", active: true },
  { name: "LSM", country: "LV", active: true },
  { name: "LRT", country: "LT", active: false },
  { name: "AIS", country: "—", active: true },
];

export default function Topbar({
  eventCount,
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
      if (lastUpdated) {
        setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const freshness = secondsAgo === null ? null
    : secondsAgo < 60 ? { label: "just now", color: "#10b981" }
    : secondsAgo < 180 ? { label: `${secondsAgo}s ago`, color: "#10b981" }
    : secondsAgo < 360 ? { label: `${Math.floor(secondsAgo/60)}m ago`, color: "#f59e0b" }
    : { label: `${Math.floor(secondsAgo/60)}m ago`, color: "#ef4444" };

  return (
    <header style={{
      height: 48, flexShrink: 0,
      background: "#09090d",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center",
      padding: "0 20px", gap: 0,
      zIndex: 100,
    }}>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 20 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} />
        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.1em" }}>
          BALTIC<span style={{ color: "#3b82f6" }}>_</span>MONITOR
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#374151", letterSpacing: "0.08em", marginLeft: 4 }}>
          BETA
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.06)", marginRight: 16 }} />

      {/* Severity counters */}
      <div style={{ display: "flex", gap: 6, marginRight: 16 }}>
        {highCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "3px 8px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fca5a5", fontWeight: 700 }}>{highCount} HIGH</span>
          </div>
        )}
        {medCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 4, padding: "3px 8px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fcd34d", fontWeight: 700 }}>{medCount} MED</span>
          </div>
        )}
      </div>

      {/* Source status pills */}
      <div style={{ display: "flex", gap: 5, marginRight: 16 }}>
        {SOURCES.map(src => (
          <div key={src.name} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "2px 7px", borderRadius: 3,
            background: src.active ? "rgba(255,255,255,0.03)" : "transparent",
            border: `1px solid ${src.active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"}`,
          }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: src.active ? "#10b981" : "#374151" }} />
            <span style={{ fontFamily: "monospace", fontSize: 9, color: src.active ? "#6b7280" : "#374151", letterSpacing: "0.05em" }}>
              {src.name}
            </span>
          </div>
        ))}
      </div>

      {/* Vessel count */}
      {vesselCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 16 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22d3ee" }} />
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#374151" }}>{vesselCount} vessels</span>
        </div>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Last updated */}
        {freshness && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: freshness.color, animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#374151" }}>
              updated {freshness.label}
            </span>
          </div>
        )}

        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#374151" }}>{time}</span>

        <button onClick={onRefresh} disabled={isLoading} style={{
          fontFamily: "monospace", fontSize: 10,
          color: isLoading ? "#374151" : "#6b7280",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "4px 10px", borderRadius: 4,
          cursor: isLoading ? "not-allowed" : "pointer",
          letterSpacing: "0.05em",
        }}>
          {isLoading ? "···" : "↻"}
        </button>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </header>
  );
}