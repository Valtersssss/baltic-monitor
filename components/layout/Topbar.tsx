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
    const tick = () => {
      setTime(new Date().toUTCString().slice(17, 25) + " UTC");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        height: 44,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Logo */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "0.08em",
          }}
        >
          BALTIC<span style={{ color: "var(--accent-blue)" }}>_</span>MONITOR
        </div>

        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10b981",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "rgba(16,185,129,0.7)",
              letterSpacing: "0.1em",
            }}
          >
            LIVE
          </span>
        </div>

        {/* Event count */}
        {eventCount > 0 && (
          <div
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 8px",
              fontFamily: "monospace",
              fontSize: 10,
              color: "var(--text-secondary)",
            }}
          >
            {eventCount} events
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {time}
        </span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: isLoading ? "var(--text-muted)" : "var(--text-secondary)",
            background: "transparent",
            border: "1px solid var(--border)",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
            transition: "all 0.15s",
          }}
        >
          {isLoading ? "LOADING..." : "↻ REFRESH"}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </header>
  );
}