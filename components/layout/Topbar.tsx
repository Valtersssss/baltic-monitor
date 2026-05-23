"use client";
import { useEffect, useState } from "react";

interface TopbarProps {
  highCount: number;
  medCount: number;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  sources: never[];
  vesselCount: number;
  eventCount: number;
}

const SOURCES = [
  { name: "ERR", ok: true },
  { name: "LSM", ok: true },
  { name: "LRT", ok: false },
  { name: "AIS", ok: true },
];

export default function Topbar({ highCount, medCount, onRefresh, isLoading, lastUpdated, vesselCount }: TopbarProps) {
  const [time, setTime] = useState("");
  const [age, setAge]   = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toUTCString().slice(17, 25));
      if (lastUpdated) setAge(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const liveColor = age === null ? "var(--t3)" : age < 120 ? "var(--green)" : age < 360 ? "var(--amber)" : "var(--red)";
  const liveLabel = age === null ? "" : age < 60 ? "live" : `${Math.floor(age/60)}m ago`;

  return (
    <header style={{
      height: 44, flexShrink: 0,
      background: "var(--g1)",
      borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center",
      padding: "0 18px",
    }}>
      {/* Wordmark */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:24 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="0" y="0" width="6" height="6" fill="#4580c4" opacity="0.9"/>
          <rect x="8" y="0" width="6" height="6" fill="#4580c4" opacity="0.4"/>
          <rect x="0" y="8" width="6" height="6" fill="#4580c4" opacity="0.4"/>
          <rect x="8" y="8" width="6" height="6" fill="#4580c4" opacity="0.2"/>
        </svg>
        <span style={{ fontSize:13, fontWeight:600, color:"var(--t1)", letterSpacing:"-0.01em" }}>Baltic Monitor</span>
        <span style={{ fontSize:9, color:"var(--t3)", fontWeight:500, letterSpacing:"0.06em" }}>BETA</span>
      </div>

      {/* Alert pills */}
      <div style={{ display:"flex", gap:6, marginRight:20 }}>
        {highCount > 0 && (
          <span style={{ fontSize:11, color:"#e88080", background:"rgba(192,57,43,0.12)", border:"1px solid rgba(192,57,43,0.22)", borderRadius:4, padding:"2px 8px", fontWeight:600 }}>
            {highCount} critical
          </span>
        )}
        {medCount > 0 && (
          <span style={{ fontSize:11, color:"#d4956a", background:"rgba(200,121,65,0.1)", border:"1px solid rgba(200,121,65,0.2)", borderRadius:4, padding:"2px 8px" }}>
            {medCount} active
          </span>
        )}
      </div>

      {/* Source dots */}
      <div style={{ display:"flex", gap:14, marginRight:20 }}>
        {SOURCES.map(s => (
          <div key={s.name} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background: s.ok ? "var(--green)" : "var(--t4)" }} />
            <span style={{ fontSize:11, color: s.ok ? "var(--t2)" : "var(--t3)" }}>{s.name}</span>
          </div>
        ))}
      </div>

      {vesselCount > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--cyan)" }} />
          <span style={{ fontSize:11, color:"var(--t3)" }}>{vesselCount} vessels</span>
        </div>
      )}

      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:16 }}>
        {liveLabel && (
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:liveColor }} />
            <span style={{ fontSize:11, color:"var(--t3)" }}>{liveLabel}</span>
          </div>
        )}
        <span style={{ fontSize:11, color:"var(--t4)", fontVariantNumeric:"tabular-nums" }}>{time} UTC</span>
        <button onClick={onRefresh} disabled={isLoading} style={{
          fontSize:11, color: isLoading ? "var(--t3)" : "var(--t2)",
          background:"var(--g2)", border:"1px solid var(--line-2)",
          padding:"3px 10px", borderRadius:4, cursor: isLoading ? "default" : "pointer",
        }}>
          {isLoading ? "···" : "Refresh"}
        </button>
      </div>
    </header>
  );
}