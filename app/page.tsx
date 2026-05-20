"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";
import ArticlePopup from "@/components/map/ArticlePopup";

const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

const CATEGORIES: { key: Category | "ALL"; label: string; short: string }[] = [
  { key: "ALL",    label: "All Events", short: "ALL" },
  { key: "MIL",   label: "Military",   short: "MIL" },
  { key: "NATO",  label: "NATO",       short: "NATO" },
  { key: "CYBER", label: "Cyber",      short: "CYBER" },
  { key: "POL",   label: "Politics",   short: "POL" },
  { key: "ENERGY",label: "Energy",     short: "NRG" },
  { key: "GEN",   label: "General",    short: "GEN" },
];

const COUNTRIES: { key: Country; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "EE",  label: "EST" },
  { key: "LV",  label: "LAT" },
  { key: "LT",  label: "LTU" },
];

const COUNTRY_COLORS: Record<string, string> = {
  EE: "#4d9ef7",
  LV: "#f56565",
  LT: "#f6d860",
};

// Severity scoring
function getSeverity(article: Article): "HIGH" | "MEDIUM" | "LOW" {
  const text = (article.title + " " + article.description).toLowerCase();
  const high = ["attack", "missile", "threat", "alert", "emergency", "critical", "strike", "invasion", "breach", "explosion", "drills", "escalat", "intercept"];
  const medium = ["military", "nato", "defense", "sanction", "cyber", "border", "exercise", "deploy", "warning", "security"];
  if (high.some(k => text.includes(k))) return "HIGH";
  if (medium.some(k => text.includes(k))) return "MEDIUM";
  return "LOW";
}

const SEVERITY_COLORS = {
  HIGH:   { bg: "#7f1d1d", border: "#ef4444", text: "#fca5a5" },
  MEDIUM: { bg: "#78350f", border: "#f59e0b", text: "#fcd34d" },
  LOW:    { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd" },
};

export default function Dashboard() {
  const [articles, setArticles]       = useState<Article[]>([]);
  const [vessels, setVessels]         = useState<Vessel[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [hoveredArticle, setHoveredArticle] = useState<Article | null>(null);
  const [hoverPos, setHoverPos]       = useState({ x: 0, y: 0 });
  const [filterCat, setFilterCat]     = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [time, setTime]               = useState("");
  const mapContainerRef               = useRef<HTMLDivElement>(null);
  const wsRef                         = useRef<WebSocket | null>(null);

  const filteredArticles = articles.filter(a => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    return true;
  });

  const highCount   = filteredArticles.filter(a => getSeverity(a) === "HIGH").length;
  const mediumCount = filteredArticles.filter(a => getSeverity(a) === "MEDIUM").length;

  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(WORKER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedData = await res.json();
      setArticles(data.articles || []);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  }, []);

  const connectAIS = useCallback(() => {
    if (!AIS_KEY || wsRef.current) return;
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({
      APIKey: AIS_KEY,
      BoundingBoxes: [[[53.5, 9.5], [66.0, 30.0]]],
      FilterMessageTypes: ["PositionReport"],
    }));
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const pos = msg.Message?.PositionReport;
        const meta = msg.MetaData;
        if (!pos || !meta || (pos.Latitude === 0 && pos.Longitude === 0)) return;
        setVessels(prev => [...prev.filter(v => v.mmsi !== meta.MMSI), {
          mmsi: meta.MMSI, name: meta.ShipName?.trim() || `MMSI ${meta.MMSI}`,
          lat: pos.Latitude, lng: pos.Longitude, sog: pos.Sog || 0,
          type: pos.ShipType || 0, ts: Date.now(),
        }].slice(-200));
      } catch {}
    };
    ws.onclose = () => { wsRef.current = null; setTimeout(connectAIS, 10000); };
  }, []);

  useEffect(() => { loadFeed(); const id = setInterval(loadFeed, 5*60*1000); return () => clearInterval(id); }, [loadFeed]);
  useEffect(() => { connectAIS(); return () => { wsRef.current?.close(); wsRef.current = null; }; }, [connectAIS]);

  const handleArticleSelect = useCallback((article: Article) => {
    setActiveArticle(prev => prev?.id === article.id && prev?.country === article.country ? null : article);
    setSelectedArticle(article);
    setHoveredArticle(null);
  }, []);

  const handleArticleHover = useCallback((article: Article | null, x: number, y: number) => {
    setHoveredArticle(article);
    if (article) setHoverPos({ x, y });
  }, []);

  const popup = hoveredArticle;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:"var(--bg-primary)", fontFamily:"Inter, system-ui, sans-serif" }}>

      {/* ── TOPBAR ── */}
      <header style={{
        height: 48, flexShrink: 0,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-accent)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 20,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#4d9ef7", boxShadow:"0 0 8px #4d9ef7" }} />
          <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:"#fff", letterSpacing:"0.1em" }}>
            BALTIC<span style={{ color:"#4d9ef7" }}>_</span>MONITOR
          </span>
        </div>

        {/* Divider */}
        <div style={{ width:1, height:24, background:"var(--border-accent)" }} />

        {/* Severity indicators */}
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:4, padding:"3px 8px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#ef4444" }} />
            <span style={{ fontFamily:"monospace", fontSize:10, color:"#fca5a5", fontWeight:600 }}>{highCount} HIGH</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:4, padding:"3px 8px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#f59e0b" }} />
            <span style={{ fontFamily:"monospace", fontSize:10, color:"#fcd34d", fontWeight:600 }}>{mediumCount} MED</span>
          </div>
        </div>

        {/* Live badge */}
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", animation:"pulse 2s infinite" }} />
          <span style={{ fontFamily:"monospace", fontSize:10, color:"#10b981", letterSpacing:"0.1em" }}>LIVE</span>
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--text-muted)" }}>{time}</span>
          <button onClick={loadFeed} disabled={isLoading} style={{
            fontFamily:"monospace", fontSize:10, color: isLoading ? "var(--text-muted)" : "var(--text-secondary)",
            background:"transparent", border:"1px solid var(--border-accent)",
            padding:"4px 12px", borderRadius:4, cursor: isLoading ? "not-allowed" : "pointer",
          }}>
            {isLoading ? "LOADING..." : "↻ REFRESH"}
          </button>
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </header>

      {/* ── FILTER BAR ── */}
      <div style={{
        height: 40, flexShrink: 0,
        background: "#0d1117",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 2,
        overflowX: "auto",
      }}>
        {/* Category filters */}
        {CATEGORIES.map(({ key, label }) => {
          const isActive = filterCat === key;
          const color = key !== "ALL" ? CAT_COLORS[key as Category] : "#4d9ef7";
          return (
            <button key={key} onClick={() => setFilterCat(key)} style={{
              padding: "4px 14px", borderRadius: 4, border: "none",
              background: isActive ? `${color}20` : "transparent",
              color: isActive ? color : "var(--text-muted)",
              fontFamily: "monospace", fontSize: 11, fontWeight: isActive ? 700 : 400,
              cursor: "pointer", letterSpacing: "0.06em", whiteSpace: "nowrap",
              borderBottom: `2px solid ${isActive ? color : "transparent"}`,
              transition: "all 0.12s",
            }}>
              {label.toUpperCase()}
            </button>
          );
        })}

        <div style={{ width:1, height:20, background:"var(--border)", margin:"0 10px", flexShrink:0 }} />

        {/* Country filters */}
        {COUNTRIES.map(({ key, label }) => {
          const isActive = filterCountry === key;
          const color = key !== "ALL" ? COUNTRY_COLORS[key] : "#fff";
          return (
            <button key={key} onClick={() => setFilterCountry(key)} style={{
              padding: "4px 12px", borderRadius: 4, border: "none",
              background: isActive ? `${color}15` : "transparent",
              color: isActive ? color : "var(--text-muted)",
              fontFamily: "monospace", fontSize: 11, fontWeight: isActive ? 700 : 400,
              cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: `2px solid ${isActive ? color : "transparent"}`,
              transition: "all 0.12s",
            }}>
              {label}
            </button>
          );
        })}

        <span style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:11, color:"var(--text-muted)", flexShrink:0 }}>
          {filteredArticles.length} events
        </span>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 380px", overflow:"hidden" }}>

        {/* MAP */}
        <div ref={mapContainerRef} style={{ position:"relative", overflow:"hidden" }}>
          <Map
            articles={filteredArticles}
            vessels={vessels}
            activeArticle={activeArticle}
            onArticleSelect={handleArticleSelect}
            onArticleHover={handleArticleHover}
          />

          {/* Hover popup */}
          {popup && (
            <ArticlePopup
              article={popup}
              x={hoverPos.x}
              y={hoverPos.y}
              containerRef={mapContainerRef}
              onClose={() => setHoveredArticle(null)}
            />
          )}

          {/* Legend */}
          <div style={{ position:"absolute", bottom:20, left:14, display:"flex", flexDirection:"column", gap:5, pointerEvents:"none", background:"rgba(10,11,14,0.75)", borderRadius:6, padding:"8px 10px", border:"1px solid var(--border)" }}>
            {[
              { color:"#ef4444", label:"Military" },
              { color:"#3b82f6", label:"NATO" },
              { color:"#f59e0b", label:"Cyber" },
              { color:"#8b5cf6", label:"Politics" },
              { color:"#10b981", label:"Energy" },
              { color:"#22d3ee", label:"Vessel" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:color }} />
                <span style={{ fontFamily:"monospace", fontSize:9, color:"rgba(255,255,255,0.4)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", borderLeft:"1px solid var(--border-accent)", background:"var(--bg-secondary)" }}>

          {/* Selected article detail */}
          {selectedArticle && (
            <div style={{
              flexShrink: 0,
              borderBottom: "1px solid var(--border-accent)",
              padding: "14px 16px",
              background: "var(--bg-tertiary)",
            }}>
              {(() => {
                const sev = getSeverity(selectedArticle);
                const sc = SEVERITY_COLORS[sev];
                const color = CAT_COLORS[selectedArticle.category];
                return (
                  <>
                    <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:3, background:sc.bg, border:`1px solid ${sc.border}`, color:sc.text }}>{sev}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, padding:"2px 6px", borderRadius:3, color, border:`1px solid ${color}44`, background:`${color}15` }}>{selectedArticle.category}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", marginLeft:"auto" }}>{selectedArticle.ago}</span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#fff", lineHeight:1.4, marginBottom:8 }}>{selectedArticle.title}</div>
                    {selectedArticle.description && (
                      <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:10 }}>
                        {selectedArticle.description.slice(0, 200)}{selectedArticle.description.length > 200 ? "…" : ""}
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)" }}>{selectedArticle.source} · {selectedArticle.country}</span>
                      <a href={selectedArticle.link} target="_blank" rel="noopener noreferrer" style={{
                        fontFamily:"monospace", fontSize:10, color:"#4d9ef7",
                        border:"1px solid rgba(77,158,247,0.3)", padding:"3px 10px", borderRadius:3, textDecoration:"none",
                      }}>READ →</a>
                    </div>
                    <button onClick={() => setSelectedArticle(null)} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:14 }}>✕</button>
                  </>
                );
              })()}
            </div>
          )}

          {/* Feed header */}
          <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", letterSpacing:"0.15em" }}>INCIDENT FEED</span>
            <span style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)" }}>{filteredArticles.length}</span>
          </div>

          {/* Article list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {filteredArticles.length === 0 ? (
              <div style={{ padding:32, fontFamily:"monospace", fontSize:12, color:"var(--text-muted)", textAlign:"center" }}>No events</div>
            ) : filteredArticles.slice(0, 60).map((article, i) => {
              const sev = getSeverity(article);
              const sc = SEVERITY_COLORS[sev];
              const color = CAT_COLORS[article.category];
              const countryColor = COUNTRY_COLORS[article.country] || "var(--text-muted)";
              const isActive = activeArticle?.id === article.id && activeArticle?.country === article.country;
              return (
                <div
                  key={article.id + article.country + i}
                  onClick={() => handleArticleSelect(article)}
                  style={{
                    padding: "11px 16px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: isActive ? `${color}0d` : "transparent",
                    borderLeft: `3px solid ${isActive ? color : "transparent"}`,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* Top row */}
                  <div style={{ display:"flex", gap:5, marginBottom:5, alignItems:"center" }}>
                    {/* Severity dot */}
                    <div style={{ width:6, height:6, borderRadius:"50%", background:sc.border, flexShrink:0 }} />
                    {/* Category */}
                    <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3, color, border:`1px solid ${color}44`, background:`${color}15` }}>
                      {article.category}
                    </span>
                    {/* Country */}
                    <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3, color:countryColor, border:`1px solid ${countryColor}44`, background:`${countryColor}10` }}>
                      {article.country}
                    </span>
                    {/* Severity label — only for HIGH */}
                    {sev === "HIGH" && (
                      <span style={{ fontFamily:"monospace", fontSize:8, fontWeight:700, padding:"1px 4px", borderRadius:2, background:sc.bg, border:`1px solid ${sc.border}`, color:sc.text, marginLeft:2 }}>
                        HIGH
                      </span>
                    )}
                    <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", marginLeft:"auto" }}>{article.ago}</span>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize:12, fontWeight:500, color:"#f0f4f8", lineHeight:1.4, marginBottom:4 }}>
                    {article.title}
                  </div>

                  {/* Source */}
                  <div style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)" }}>
                    {article.source}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}