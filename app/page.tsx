"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";

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

export default function Dashboard() {
  const [articles, setArticles]           = useState<Article[]>([]);
  const [vessels, setVessels]             = useState<Vessel[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [filterCat, setFilterCat]         = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");
  const [time, setTime]                   = useState("");
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
      <header style={{
        height:48, flexShrink:0, background:"var(--bg-secondary)",
        borderBottom:"1px solid var(--border-accent)",
        display:"flex", alignItems:"center", padding:"0 20px", gap:16, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#4d9ef7", boxShadow:"0 0 8px #4d9ef799" }} />
          <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:"#fff", letterSpacing:"0.1em" }}>
            BALTIC<span style={{ color:"#4d9ef7" }}>_</span>MONITOR
          </span>
        </div>

        <div style={{ width:1, height:24, background:"var(--border-accent)" }} />

        {/* Severity counters */}
        {highCount > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:5, background:SEV.HIGH.bg, border:`1px solid ${SEV.HIGH.border}`, borderRadius:4, padding:"3px 10px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:SEV.HIGH.dot }} />
            <span style={{ fontFamily:"monospace", fontSize:10, color:SEV.HIGH.text, fontWeight:700 }}>{highCount} HIGH</span>
          </div>
        )}
        {mediumCount > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:5, background:SEV.MEDIUM.bg, border:`1px solid ${SEV.MEDIUM.border}`, borderRadius:4, padding:"3px 10px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:SEV.MEDIUM.dot }} />
            <span style={{ fontFamily:"monospace", fontSize:10, color:SEV.MEDIUM.text, fontWeight:700 }}>{mediumCount} MED</span>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", animation:"pulse 2s infinite" }} />
          <span style={{ fontFamily:"monospace", fontSize:10, color:"#10b981", letterSpacing:"0.08em" }}>LIVE</span>
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--text-muted)" }}>{time}</span>
          <button onClick={loadFeed} disabled={isLoading} style={{
            fontFamily:"monospace", fontSize:10,
            color:isLoading?"var(--text-muted)":"var(--text-secondary)",
            background:"transparent", border:"1px solid var(--border-accent)",
            padding:"4px 12px", borderRadius:4, cursor:isLoading?"not-allowed":"pointer",
          }}>
            {isLoading ? "LOADING..." : "↻ REFRESH"}
          </button>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </header>

      {/* FILTER BAR */}
      <div style={{
        height:40, flexShrink:0, background:"#0a0b0e",
        borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", padding:"0 16px", gap:2, overflowX:"auto",
      }}>
        {CATEGORIES.map(({ key, label }) => {
          const active = filterCat === key;
          const color = key !== "ALL" ? CAT_COLORS[key as Category] : "#fff";
          return (
            <button key={key} onClick={() => setFilterCat(key)} style={{
              padding:"4px 14px", borderRadius:4, border:"none",
              background: active ? `${color}18` : "transparent",
              color: active ? color : "var(--text-muted)",
              fontFamily:"monospace", fontSize:11, fontWeight: active ? 700 : 400,
              cursor:"pointer", letterSpacing:"0.05em", whiteSpace:"nowrap",
              borderBottom:`2px solid ${active ? color : "transparent"}`,
              transition:"all 0.12s",
            }}>
              {label.toUpperCase()}
            </button>
          );
        })}

        <div style={{ width:1, height:20, background:"var(--border)", margin:"0 8px", flexShrink:0 }} />

        {COUNTRIES.map(({ key, label }) => {
          const active = filterCountry === key;
          const color = key !== "ALL" ? COUNTRY_COLORS[key] : "#fff";
          return (
            <button key={key} onClick={() => setFilterCountry(key)} style={{
              padding:"4px 12px", borderRadius:4, border:"none",
              background: active ? `${color}15` : "transparent",
              color: active ? color : "var(--text-muted)",
              fontFamily:"monospace", fontSize:11, fontWeight: active ? 700 : 400,
              cursor:"pointer", whiteSpace:"nowrap",
              borderBottom:`2px solid ${active ? color : "transparent"}`,
              transition:"all 0.12s",
            }}>
              {label.toUpperCase()}
            </button>
          );
        })}

        <span style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:11, color:"var(--text-muted)", flexShrink:0 }}>
          {filtered.length} events
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
                {/* Article image */}
                {activeArticle.image && (
                  <div style={{ width:"100%", height:160, overflow:"hidden", position:"relative" }}>
                    <img
                      src={activeArticle.image}
                      alt=""
                      style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.85 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, var(--bg-tertiary))" }} />
                  </div>
                )}

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

          {/* Feed header */}
          <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", letterSpacing:"0.15em" }}>INCIDENT FEED</span>
            <span style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)" }}>{filtered.length} events</span>
          </div>

          {/* Article list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding:32, fontFamily:"monospace", fontSize:12, color:"var(--text-muted)", textAlign:"center" }}>No events</div>
            ) : filtered.slice(0,60).map((article, i) => {
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
                    display:"flex", gap:12,
                    padding:"12px 16px",
                    borderBottom:"1px solid var(--border)",
                    cursor:"pointer",
                    background: isActive ? `${color}0e` : "transparent",
                    borderLeft:`3px solid ${isActive ? color : "transparent"}`,
                    transition:"background 0.1s",
                  }}
                  onMouseEnter={e=>{ if(!isActive)(e.currentTarget as HTMLDivElement).style.background="var(--bg-tertiary)"; }}
                  onMouseLeave={e=>{ if(!isActive)(e.currentTarget as HTMLDivElement).style.background="transparent"; }}
                >
                  {/* Thumbnail */}
                  {article.image && (
                    <div style={{ width:56, height:56, borderRadius:4, overflow:"hidden", flexShrink:0, background:"var(--bg-elevated)" }}>
                      <img
                        src={article.image}
                        alt=""
                        style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.85 }}
                        onError={e=>{ (e.target as HTMLImageElement).parentElement!.style.display="none"; }}
                      />
                    </div>
                  )}

                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Badges row */}
                    <div style={{ display:"flex", gap:4, marginBottom:5, alignItems:"center", flexWrap:"wrap" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:sc.dot, flexShrink:0 }} />
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3, color, border:`1px solid ${color}44`, background:`${color}15` }}>
                        {article.category}
                      </span>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3, color:cc, border:`1px solid ${cc}44`, background:`${cc}12` }}>
                        {article.country}
                      </span>
                      {sev==="HIGH" && (
                        <span style={{ fontFamily:"monospace", fontSize:8, fontWeight:700, padding:"1px 4px", borderRadius:2, background:sc.bg, border:`1px solid ${sc.border}`, color:sc.text }}>HIGH</span>
                      )}
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-muted)", marginLeft:"auto" }}>{article.ago}</span>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize:12, fontWeight:500, color:"#f0f4f8", lineHeight:1.4, marginBottom:3 }}>
                      {article.title}
                    </div>

                    {/* Source */}
                    <div style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-muted)" }}>
                      {article.source}
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