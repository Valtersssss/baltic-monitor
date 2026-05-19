"use client";

import { useEffect, useState } from "react";

interface TopbarProps {
  eventCount: number;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function Topbar({ eventCount, onRefresh, isLoading }: TopbarProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={{
      height: 48,
      background: "var(--bg-secondary)",
      borderBottom: "1px solid var(--border-accent)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      flexShrink: 0,
      zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Logo */}
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "0.1em",
        }}>
          BALTIC<span style={{ color: "var(--accent-blue)" }}>_</span>MONITOR
        </div>

        {/* Live dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent-green)",
            animation: "pulse 2s infinite",
          }} />
          <span style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "var(--accent-green)",
            letterSpacing: "0.1em",
            opacity: 0.8,
          }}>LIVE</span>
        </div>

        {/* Count */}
        {eventCount > 0 && (
          <span style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "2px 8px",
          }}>
            {eventCount} events
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: "var(--text-secondary)",
        }}>{time}</span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: isLoading ? "var(--text-muted)" : "var(--text-secondary)",
            background: "transparent",
            border: "1px solid var(--border-accent)",
            padding: "5px 12px",
            borderRadius: 4,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
            transition: "all 0.15s",
          }}
        >
          {isLoading ? "LOADING..." : "↻ REFRESH"}
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </header>
  );
}