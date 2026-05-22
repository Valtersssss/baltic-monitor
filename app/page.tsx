"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";
import Topbar from "@/components/layout/Topbar";
import ArticlePopup from "@/components/map/ArticlePopup";

const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

const CATEGORIES: { key: Category | "ALL"; label: string }[] = [
  { key: "ALL",    label: "All Events" },
  { key: "MIL",   label: "Military"   },
  { key: "NATO",  label: "NATO"       },
  { key: "CYBER", label: "Cyber"      },
  { key: "POL",   label: "Politics"   },
  { key: "ENERGY",label: "Energy"     },
  { key: "GEN",   label: "General"    },
];

const COUNTRIES: { key: Country; label: string }[] = [
  { key: "ALL", label: "All"     },
  { key: "EE",  label: "Estonia" },
  { key: "LV",  label: "Latvia"  },
  { key: "LT",  label: "Lithuania" },
];

const COUNTRY_COLORS: Record<string, string> = {
  EE: "#4d9ef7",
  LV: "#f56565",
  LT: "#f6d860",
};

function getSeverity(article: Article): "HIGH" | "MEDIUM" | "LOW" {
  const text = (article.title + " " + article.description).toLowerCase();
  const high = ["attack","missile","threat","alert","emergency","critical","strike","invasion","breach","explosion","drills","escalat","intercept","warning","armed"];
  const medium = ["military","nato","defense","defence","sanction","cyber","border","exercise","deploy","security","troops","vessel"];
  if (high.some(k => text.includes(k))) return "HIGH";
  if (medium.some(k => text.includes(k))) return "MEDIUM";
  return "LOW";
}

const SEV = {
  HIGH:   { dot:"#ef4444", bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.4)",   text:"#fca5a5" },
  MEDIUM: { dot:"#f59e0b", bg:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.4)",  text:"#fcd34d" },
  LOW:    { dot:"#3b82f6", bg:"rgba(59,130,246,0.08)",  border:"rgba(59,130,246,0.25)", text:"#93c5fd" },
};

const FLAGS: Record<string, string> = {
  EE: "🇪🇪",
  LV: "🇱🇻", 
  LT: "🇱🇹",
};

function AlertTicker({ articles }: { articles: Article[] }) {
  const urgent = articles.filter(a => 
    getSeverity(a) === "HIGH" || a.category === "MIL" || a.category === "NATO"
  ).slice(0, 10);

  if (urgent.length === 0) return null;

  const items = [...urgent, ...urgent]; // duplicate for seamless loop

  return (
    <div style={{
      height: 32, flexShrink: 0,
      background: "#1a0a0a",
      borderBottom: "1px solid rgba(239,68,68,0.4)",
      display: "flex", alignItems: "center",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* BREAKING label */}
      <div style={{
        flexShrink: 0,
        background: "#ef4444",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 700,
        padding: "0 12px",
        height: "100%",
        display: "flex",
        alignItems: "center",
        letterSpacing: "0.1em",
        zIndex: 2,
      }}>
        ⚡ ALERT
      </div>

      {/* Scrolling ticker */}
      <div style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          animation: `ticker-scroll ${urgent.length * 8}s linear infinite`,
          gap: 0,
        }}>
          {items.map((a, i) => {
            const color = CAT_COLORS[a.category];
            const sev = getSeverity(a);
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 24px" }}>
                <span style={{ fontSize: 14 }}>{FLAGS[a.country] || "🌍"}</span>
                <span style={{
                  fontFamily: "monospace", fontSize: 9, fontWeight: 700,
                  padding: "1px 5px", borderRadius: 2,
                  color, border: `1px solid ${color}55`, background: `${color}20`,
                }}>{a.category}</span>
                {sev === "HIGH" && (
                  <span style={{
                    fontFamily: "monospace", fontSize: 8, fontWeight: 700,
                    padding: "1px 4px", borderRadius: 2,
                    background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)",
                    color: "#fca5a5",
                  }}>HIGH</span>
                )}
                <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{a.title.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'")}</span>
                <span style={{ color: "rgba(239,68,68,0.4)", fontSize: 12, marginLeft: 8 }}>///</span>
              </span>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export default function Dashboard() {
  const [articles, setArticles]           = useState<Article[]>([]);
  const [vessels, setVessels]             = useState<Vessel[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [filterCat, setFilterCat]         = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");
  const [time, setTime]                   = useState("");
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null);
  const [feedTab, setFeedTab]             = useState<"ALL"|"HIGH"|"MIL"|"NATO">("ALL");
  const wsRef                             = useRef<WebSocket | null>(null);

  const filtered = articles.filter(a => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    return true;
  });

  const highCount   = filtered.filter(a => getSeverity(a) === "HIGH").length;
  const mediumCount = filtered.filter(a => getSeverity(a) === "MEDIUM").length;

  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().slice(17,25) + " UTC");
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
      setLastUpdated(new Date());
    } catch(e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  const connectAIS = useCallback(() => {
    if (!AIS_KEY || wsRef.current) return;
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({
      APIKey: AIS_KEY,
      BoundingBoxes: [[[53.5,9.5],[66.0,30.0]]],
      FilterMessageTypes: ["PositionReport"],
    }));
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const pos = msg.Message?.PositionReport;
        const meta = msg.MetaData;
        if (!pos || !meta || (pos.Latitude===0 && pos.Longitude===0)) return;
        setVessels(prev => [...prev.filter(v=>v.mmsi!==meta.MMSI), {
          mmsi:meta.MMSI, name:meta.ShipName?.trim()||`MMSI ${meta.MMSI}`,
          lat:pos.Latitude, lng:pos.Longitude, sog:pos.Sog||0,
          type:pos.ShipType||0, ts:Date.now(),
        }].slice(-200));
      } catch {}
    };
    ws.onclose = () => { wsRef.current=null; setTimeout(connectAIS,10000); };
  }, []);

  useEffect(() => { loadFeed(); const id=setInterval(loadFeed,5*60*1000); return()=>clearInterval(id); }, [loadFeed]);
  useEffect(() => { connectAIS(); return()=>{ wsRef.current?.close(); wsRef.current=null; }; }, [connectAIS]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:"var(--bg-primary)" }}>

      {/* TOPBAR */}
      <Topbar
        eventCount={filtered.length}
        highCount={highCount}
        medCount={mediumCount}
        onRefresh={loadFeed}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        sources={[]}
        vesselCount={vessels.length}
      />

      {/* ALERT TICKER */}
      <AlertTicker articles={filtered} />

      {/* FILTER BAR */}
      <div style={{
        height: 44, flexShrink: 0,
        background: "#0d0f14",
        borderBottom: "1px solid var(--border-accent)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 0,
        overflowX: "auto",
      }}>
        {/* Category filters */}
        <div style={{ display:"flex", alignItems:"center", gap:2, flex:1 }}>
          {CATEGORIES.map(({ key, label }) => {
            const active = filterCat === key;
            const color = key !== "ALL" ? CAT_COLORS[key as Category] : "#94a3b8";
            return (
              <button key={key} onClick={() => setFilterCat(key)} style={{
                padding: "6px 14px",
                background: active ? `${color}18` : "transparent",
                border: "none",
                borderRadius: 6,
                color: active ? color : "#4a5568",
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                outline: active ? `1px solid ${color}33` : "none",
              }}>
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width:1, height:22, background:"rgba(255,255,255,0.08)", margin:"0 12px", flexShrink:0 }} />

        {/* Country filters */}
        <div style={{ display:"flex", alignItems:"center", gap:2 }}>
          {COUNTRIES.map(({ key, label }) => {
            const active = filterCountry === key;
            const color = key !== "ALL" ? COUNTRY_COLORS[key] : "#94a3b8";
            const flag = key !== "ALL" ? FLAGS[key] : null;
            return (
              <button key={key} onClick={() => setFilterCountry(key)} style={{
                padding: "5px 12px",
                background: active ? `${color}18` : "transparent",
                border: "none",
                borderRadius: 6,
                color: active ? color : "#4a5568",
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                outline: active ? `1px solid ${color}33` : "none",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {flag && <span style={{ fontSize:13 }}>{flag}</span>}
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>

        <span style={{ marginLeft:16, fontFamily:"monospace", fontSize:10, color:"#2d3748", flexShrink:0 }}>
          {filtered.length}
        </span>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 400px", overflow:"hidden" }}>

        {/* MAP */}
        <div style={{ position:"relative", overflow:"hidden" }}>
          <Map
            articles={filtered}
            vessels={vessels}
            activeArticle={activeArticle}
            onArticleSelect={setActiveArticle}
            onArticleHover={() => {}}
            focusCountry={filterCountry !== "ALL" ? filterCountry : null}
          />

          {/* Article card overlay on map */}
          {activeArticle && (() => {
            const color = CAT_COLORS[activeArticle.category];
            const sev = getSeverity(activeArticle);
            const sc = SEV[sev];
            return (
              <div style={{
                position: "absolute",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                width: 320,
                background: "rgba(10,11,14,0.92)",
                border: `1px solid ${color}44`,
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                zIndex: 20,
                backdropFilter: "blur(8px)",
              }}>
                {/* Image */}
                {activeArticle.image ? (
                  <div style={{ width:"100%", height:140, position:"relative", overflow:"hidden" }}>
                    <img
                      src={activeArticle.image}
                      alt=""
                      style={{ width:"100%", height:"100%", objectFit:"cover" }}
                      onError={e => { (e.target as HTMLImageElement).parentElement!.style.display="none"; }}
                    />
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(10,11,14,0.95))" }} />
                    {/* Severity badge over image */}
                    <div style={{ position:"absolute", top:10, left:10, display:"flex", gap:5 }}>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, background:sc.bg, border:`1px solid ${sc.border}`, color:sc.text }}>{sev}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, color, border:`1px solid ${color}44`, background:`${color}20` }}>{activeArticle.category}</span>
                    </div>
                    {/* Flag over image */}
                    <div style={{ position:"absolute", top:8, right:10, fontSize:20 }}>{FLAGS[activeArticle.country]||""}</div>
                  </div>
                ) : (
                  <div style={{ width:"100%", height:6, background:`linear-gradient(to right, ${color}44, ${color}22)` }} />
                )}

                <div style={{ padding:"12px 14px 14px" }}>
                  {/* Title */}
                  <div style={{ fontSize:12, fontWeight:600, color:"#fff", lineHeight:1.45, marginBottom:8 }}>
                    {activeArticle.title.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'")}
                  </div>

                  {/* Description snippet */}
                  {activeArticle.description && (
                    <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.55, marginBottom:10 }}>
                      {activeArticle.description.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/<[^>]+>/g,'').slice(0,120)}…
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"#4a5568" }}>{activeArticle.source}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"#2d3748" }}>·</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"#4a5568" }}>{activeArticle.ago}</span>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button
                        onClick={() => setActiveArticle(null)}
                        style={{ fontFamily:"monospace", fontSize:9, color:"#4a5568", background:"transparent", border:"1px solid #1e2533", padding:"3px 8px", borderRadius:3, cursor:"pointer" }}
                      >✕</button>
                      <a
                        href={activeArticle.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily:"monospace", fontSize:9, color, border:`1px solid ${color}44`, padding:"3px 10px", borderRadius:3, textDecoration:"none", fontWeight:600 }}
                      >READ →</a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Legend */}
          <div style={{
            position:"absolute", bottom:20, left:14, pointerEvents:"none",
            background:"rgba(10,11,14,0.8)", borderRadius:6,
            padding:"10px 12px", border:"1px solid var(--border)",
            display:"flex", flexDirection:"column", gap:5,
          }}>
            <div style={{ fontFamily:"monospace", fontSize:8, color:"var(--text-muted)", letterSpacing:"0.12em", marginBottom:3 }}>LEGEND</div>
            {[
              { color:"#4d9ef7", label:"Estonia border" },
              { color:"#f56565", label:"Latvia border"  },
              { color:"#f6d860", label:"Lithuania border"},
              { color:"#22d3ee", label:"AIS Vessel"     },
            ].map(({ color, label }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:color, opacity:0.85 }} />
                <span style={{ fontFamily:"monospace", fontSize:9, color:"rgba(255,255,255,0.35)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ borderLeft:"1px solid var(--border-accent)", background:"var(--bg-secondary)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Selected article detail */}
          {activeArticle && (() => {
            const sev = getSeverity(activeArticle);
            const sc = SEV[sev];
            const color = CAT_COLORS[activeArticle.category];
            const cc = COUNTRY_COLORS[activeArticle.country] || "var(--text-muted)";
            return (
              <div style={{ flexShrink:0, borderBottom:"1px solid var(--border-accent)", background:"var(--bg-tertiary)", position:"relative" }}>
                <div style={{ padding:"12px 16px 14px" }}>
                  {/* Badges */}
                  <div style={{ display:"flex", gap:5, marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, background:sc.bg, border:`1px solid ${sc.border}`, color:sc.text }}>{sev}</span>
                    <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, color, border:`1px solid ${color}44`, background:`${color}18` }}>{activeArticle.category}</span>
                    <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, color:cc, border:`1px solid ${cc}44`, background:`${cc}12` }}>{activeArticle.country}</span>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize:13, fontWeight:600, color:"#fff", lineHeight:1.45, marginBottom:8 }}>
                    {activeArticle.title}
                  </div>

                  {/* Description */}
                  {activeArticle.description && (
                    <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.65, marginBottom:10 }}>
                      {activeArticle.description.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0,220)}
                      {activeArticle.description.length>220?"…":""}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)" }}>
                      {activeArticle.source} · {activeArticle.ago}
                    </span>
                    <a href={activeArticle.link} target="_blank" rel="noopener noreferrer" style={{
                      fontFamily:"monospace", fontSize:10, color:"#4d9ef7",
                      border:"1px solid rgba(77,158,247,0.35)", padding:"4px 12px",
                      borderRadius:3, textDecoration:"none",
                    }}>READ →</a>
                  </div>
                </div>

                <button onClick={() => setActiveArticle(null)} style={{
                  position:"absolute", top:10, right:12,
                  background:"rgba(0,0,0,0.5)", border:"1px solid var(--border)",
                  borderRadius:"50%", width:24, height:24,
                  color:"var(--text-muted)", cursor:"pointer", fontSize:12,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>✕</button>
              </div>
            );
          })()}

          {/* Feed tab switcher */}
          <div style={{ flexShrink:0, display:"flex", borderBottom:"1px solid var(--border)", background:"var(--bg-primary)" }}>
            {([["ALL","All"], ["HIGH","🔴 High"], ["MIL","Military"], ["NATO","NATO"]] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setFeedTab(tab)} style={{
                flex:1, padding:"8px 4px",
                background:"transparent", border:"none",
                borderBottom:`2px solid ${feedTab===tab ? (tab==="HIGH" ? "#ef4444" : tab==="MIL" ? "#ef4444" : tab==="NATO" ? "#3b82f6" : "var(--accent-blue)") : "transparent"}`,
                color: feedTab===tab ? "#fff" : "var(--text-muted)",
                fontFamily:"monospace", fontSize:10, fontWeight: feedTab===tab ? 700 : 400,
                cursor:"pointer", transition:"all 0.12s", letterSpacing:"0.05em",
              }}>{label}</button>
            ))}
          </div>

          {/* HIGH ALERTS SECTION */}
          {feedTab === "ALL" && filtered.filter(a => getSeverity(a) === "HIGH").length > 0 && (
            <div style={{ flexShrink:0, borderBottom:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.04)" }}>
              <div style={{ padding:"8px 16px 6px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"monospace", fontSize:9, color:"#ef4444", letterSpacing:"0.15em", fontWeight:700 }}>⚡ HIGH PRIORITY</span>
                <span style={{ fontFamily:"monospace", fontSize:9, color:"rgba(239,68,68,0.6)" }}>{filtered.filter(a=>getSeverity(a)==="HIGH").length}</span>
              </div>
              {filtered.filter(a=>getSeverity(a)==="HIGH").slice(0,3).map((article, i) => {
                const color = CAT_COLORS[article.category];
                const cc = COUNTRY_COLORS[article.country] || "#64748b";
                const isActive = activeArticle?.id===article.id && activeArticle?.country===article.country;
                return (
                  <div key={i} onClick={() => setActiveArticle(isActive ? null : article)}
                    style={{
                      padding:"8px 16px 10px",
                      borderBottom:"1px solid rgba(239,68,68,0.15)",
                      cursor:"pointer",
                      background: isActive ? "rgba(239,68,68,0.1)" : "transparent",
                      borderLeft:`3px solid ${isActive ? "#ef4444" : "rgba(239,68,68,0.4)"}`,
                      transition:"background 0.1s",
                    }}
                    onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.background="rgba(239,68,68,0.08)"; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.background=isActive?"rgba(239,68,68,0.1)":"transparent"; }}
                  >
                    <div style={{ display:"flex", gap:5, marginBottom:4, alignItems:"center" }}>
                      <span style={{ fontSize:12 }}>{FLAGS[article.country]||"🌍"}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3, color, border:`1px solid ${color}44`, background:`${color}15` }}>{article.category}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"rgba(239,68,68,0.7)", marginLeft:"auto" }}>{article.ago}</span>
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#fff", lineHeight:1.4 }}>{article.title.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}</div>
                    <div style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)", marginTop:3 }}>{article.source}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Feed header */}
          <div style={{ padding:"8px 16px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", letterSpacing:"0.15em" }}>ALL EVENTS</span>
            <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)" }}>{filtered.length}</span>
          </div>

          {/* Compact article list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding:24, fontFamily:"monospace", fontSize:11, color:"var(--text-muted)", textAlign:"center" }}>No events</div>
            ) : filtered.filter(a => {
                if (feedTab === "HIGH") return getSeverity(a) === "HIGH";
                if (feedTab === "MIL") return a.category === "MIL";
                if (feedTab === "NATO") return a.category === "NATO";
                return true;
              }).slice(0,60).map((article, i) => {
              const sev = getSeverity(article);
              const sc = SEV[sev];
              const color = CAT_COLORS[article.category];
              const cc = COUNTRY_COLORS[article.country] || "#64748b";
              const isActive = activeArticle?.id===article.id && activeArticle?.country===article.country;
              return (
                <div
                  key={article.id+article.country+i}
                  onClick={() => setActiveArticle(isActive ? null : article)}
                  style={{
                    padding:"8px 16px",
                    borderBottom:"1px solid var(--border)",
                    cursor:"pointer",
                    background: isActive ? `${color}0e` : "transparent",
                    borderLeft:`3px solid ${isActive ? color : "transparent"}`,
                    transition:"background 0.1s",
                    display:"flex", gap:10, alignItems:"flex-start",
                  }}
                  onMouseEnter={e=>{ if(!isActive)(e.currentTarget as HTMLDivElement).style.background="var(--bg-tertiary)"; }}
                  onMouseLeave={e=>{ if(!isActive)(e.currentTarget as HTMLDivElement).style.background="transparent"; }}
                >
                  {/* Severity dot */}
                  <div style={{ width:6, height:6, borderRadius:"50%", background:sc.dot, flexShrink:0, marginTop:5 }} />

                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Badges */}
                    <div style={{ display:"flex", gap:4, marginBottom:3, alignItems:"center" }}>
                      <span style={{ fontSize:10 }}>{FLAGS[article.country]||""}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"1px 4px", borderRadius:2, color, border:`1px solid ${color}44`, background:`${color}15` }}>{article.category}</span>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", marginLeft:"auto" }}>{article.ago}</span>
                    </div>
                    {/* Title — compact */}
                    <div style={{ fontSize:12, fontWeight:500, color:"#e2e8f0", lineHeight:1.35, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                      {article.title.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"#374151" }}>{article.source}</span>
                      <span style={{ fontFamily:"monospace", fontSize:8, color:"#4b5563", border:"1px solid #1f2937", padding:"0px 4px", borderRadius:2 }}>UNVERIFIED</span>
                    </div>
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