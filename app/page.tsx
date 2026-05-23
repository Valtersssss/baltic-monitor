"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";
import Topbar from "@/components/layout/Topbar";

const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

const CATEGORIES: { key: Category | "ALL"; label: string }[] = [
  { key: "ALL",    label: "All events" },
  { key: "MIL",   label: "Military" },
  { key: "NATO",  label: "NATO" },
  { key: "CYBER", label: "Cyber" },
  { key: "POL",   label: "Politics" },
  { key: "ENERGY",label: "Energy" },
  { key: "GEN",   label: "General" },
];

const COUNTRIES: { key: Country; label: string; flag: string }[] = [
  { key: "ALL", label: "All",       flag: "" },
  { key: "EE",  label: "Estonia",   flag: "🇪🇪" },
  { key: "LV",  label: "Latvia",    flag: "🇱🇻" },
  { key: "LT",  label: "Lithuania", flag: "🇱🇹" },
];

const COUNTRY_COLORS: Record<string, string> = {
  EE: "#1d4ed8",
  LV: "#b91c1c",
  LT: "#92400e",
};

const FLAGS: Record<string, string> = { EE: "🇪🇪", LV: "🇱🇻", LT: "🇱🇹" };

function getSeverity(a: Article): "critical" | "active" | "low" {
  const t = (a.title + " " + a.description).toLowerCase();
  const critical = ["attack","missile","explosion","invasion","breach","intercept","airspace violation","infrastructure damage","cable cut","jamming","crash","emergency"];
  const active   = ["drone","alert","military","nato","exercise","troops","deploy","sanction","cyber","border","threat","warning","vessel","incident"];
  if (critical.some(k => t.includes(k))) return "critical";
  if (active.some(k => t.includes(k)))   return "active";
  return "low";
}

const clean = (s: string) => s
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

// Alert ticker
function AlertTicker({ articles }: { articles: Article[] }) {
  const urgent = articles.filter(a => getSeverity(a) !== "low").slice(0, 8);
  if (!urgent.length) return null;
  const items = [...urgent, ...urgent];
  return (
    <div style={{
      height: 30, flexShrink: 0,
      background: "rgba(239,68,68,0.06)",
      borderBottom: "1px solid rgba(239,68,68,0.2)",
      display: "flex", alignItems: "center",
      overflow: "hidden",
    }}>
      <div style={{
        flexShrink: 0,
        background: "#dc2626",
        color: "var(--surface-1)",
        fontSize: 9, fontWeight: 700,
        padding: "0 12px", height: "100%",
        display: "flex", alignItems: "center",
        letterSpacing: "0.08em",
      }}>
        ALERT
      </div>
      <div style={{ flex: 1, overflow: "hidden", maskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)" }}>
        <div style={{
          display: "flex", alignItems: "center",
          whiteSpace: "nowrap",
          animation: `ticker ${urgent.length * 8}s linear infinite`,
        }}>
          {items.map((a, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "0 22px" }}>
              <span style={{ fontSize: 13 }}>{FLAGS[a.country] || ""}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: CAT_COLORS[a.category] }}>{a.category}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{clean(a.title).slice(0, 90)}</span>
              <span style={{ color: "#fca5a5", fontSize: 10 }}>—</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

// Article row component
function ArticleRow({ article, isActive, onClick }: {
  article: Article; isActive: boolean; onClick: () => void;
}) {
  const sev = getSeverity(article);
  const catColor = CAT_COLORS[article.category];
  const sevDot = sev === "critical" ? "#dc2626" : sev === "active" ? "#d97706" : "#cbd5e1";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isActive ? "rgba(59,130,246,0.08)" : "var(--surface-1)",
        borderLeft: `3px solid ${isActive ? catColor : "transparent"}`,
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-1)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: sevDot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: catColor, letterSpacing: "0.03em" }}>{article.category}</span>
        <span style={{ fontSize: 10, color: COUNTRY_COLORS[article.country] || "#64748b", fontWeight: 500 }}>
          {FLAGS[article.country]} {article.country}
        </span>
        {sev === "critical" && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fca5a5", background: "rgba(239,68,68,0.06)", border: "1px solid #fecaca", borderRadius: 3, padding: "0 4px" }}>
            CRITICAL
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>{article.ago}</span>
      </div>
      <div style={{
        fontSize: 12, fontWeight: 500,
        color: sev === "critical" ? "#0f172a" : "#334155",
        lineHeight: 1.45,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>
        {clean(article.title)}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{article.source}</div>
    </div>
  );
}

// Map article card
function ArticleCard({ article, onClose }: { article: Article; onClose: () => void }) {
  const catColor = CAT_COLORS[article.category];
  const sev = getSeverity(article);
  return (
    <div style={{
      position: "absolute", bottom: 16, left: "50%",
      transform: "translateX(-50%)",
      width: 320, zIndex: 30,
      background: "var(--surface-1)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    }}>
      {article.image && (
        <div style={{ width: "100%", height: 140, overflow: "hidden" }}>
          <img src={article.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: catColor }}>{article.category}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{article.source}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{article.ago}</span>
          {sev === "critical" && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fca5a5", background: "rgba(239,68,68,0.06)", border: "1px solid #fecaca", borderRadius: 3, padding: "0 4px", marginLeft: 2 }}>CRITICAL</span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 7 }}>
          {clean(article.title)}
        </div>
        {article.description && (
          <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, marginBottom: 10 }}>
            {clean(article.description).replace(/<[^>]+>/g, "").slice(0, 160)}…
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            Dismiss
          </button>
          <a href={article.link} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 11, fontWeight: 600, color: "var(--surface-1)",
            background: catColor,
            padding: "4px 12px", borderRadius: 5, textDecoration: "none",
          }}>
            Read article →
          </a>
        </div>
      </div>
    </div>
  );
}

// Main dashboard
export default function Dashboard() {
  const [articles, setArticles]           = useState<Article[]>([]);
  const [vessels, setVessels]             = useState<Vessel[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [filterCat, setFilterCat]         = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");
  const [feedTab, setFeedTab]             = useState<"ALL"|"HIGH"|"MIL"|"NATO">("ALL");
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null);
  const wsRef                             = useRef<WebSocket | null>(null);

  const filtered = articles.filter(a => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    return true;
  });

  const criticalArticles = filtered.filter(a => getSeverity(a) === "critical");
  const highCount = criticalArticles.length;
  const medCount  = filtered.filter(a => getSeverity(a) === "active").length;

  const feedArticles = feedTab === "HIGH" ? criticalArticles
    : feedTab === "MIL"  ? filtered.filter(a => a.category === "MIL")
    : feedTab === "NATO" ? filtered.filter(a => a.category === "NATO")
    : filtered;

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(WORKER_URL);
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
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:"var(--surface-0)" }}>

      <Topbar
        eventCount={filtered.length}
        highCount={highCount}
        medCount={medCount}
        onRefresh={loadFeed}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        sources={[]}
        vesselCount={vessels.length}
      />

      <AlertTicker articles={filtered} />

      {/* Category filter */}
      <div style={{
        height: 38, flexShrink: 0,
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 0, overflowX: "auto",
      }}>
        {CATEGORIES.map(({ key, label }) => {
          const active = filterCat === key;
          const color = key !== "ALL" ? CAT_COLORS[key as Category] : "#2563eb";
          return (
            <button key={key} onClick={() => setFilterCat(key)} style={{
              padding: "4px 12px", background: "transparent", border: "none",
              color: active ? color : "#94a3b8",
              fontSize: 12, fontWeight: active ? 600 : 400,
              cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: `2px solid ${active ? color : "transparent"}`,
              transition: "all 0.1s",
            }}>
              {label}
            </button>
          );
        })}

        <div style={{ width: 1, height: 14, background: "var(--ui-border)", margin: "0 8px", flexShrink: 0 }} />

        {COUNTRIES.map(({ key, label, flag }) => {
          const active = filterCountry === key;
          const color = key !== "ALL" ? COUNTRY_COLORS[key] : "#2563eb";
          return (
            <button key={key} onClick={() => setFilterCountry(key)} style={{
              padding: "4px 10px", background: "transparent", border: "none",
              color: active ? color : "#94a3b8",
              fontSize: 12, fontWeight: active ? 600 : 400,
              cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: `2px solid ${active ? color : "transparent"}`,
              transition: "all 0.1s",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {flag && <span style={{ fontSize: 13 }}>{flag}</span>}
              {label}
            </button>
          );
        })}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          {filtered.length} events
        </span>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 360px", overflow:"hidden" }}>

        {/* Map — dark */}
        <div style={{ position:"relative", overflow:"hidden" }}>
          <Map
            articles={filtered}
            vessels={vessels}
            activeArticle={activeArticle}
            onArticleSelect={setActiveArticle}
            onArticleHover={() => {}}
            focusCountry={filterCountry !== "ALL" ? filterCountry : null}
          />

          {activeArticle && (
            <ArticleCard article={activeArticle} onClose={() => setActiveArticle(null)} />
          )}

          {/* Map legend */}
          <div style={{
            position:"absolute", bottom:16, left:14,
            background:"rgba(17,24,39,0.9)",
            borderRadius:6, padding:"8px 10px",
            border:"1px solid var(--border)",
            boxShadow:"0 2px 8px rgba(0,0,0,0.4)",
          }}>
            {[
              { color:"#4a90d9", label:"Estonia" },
              { color:"#c0392b", label:"Latvia"  },
              { color:"#c9a227", label:"Lithuania"},
              { color:"#0891b2", label:"AIS Vessel"},
              { color:"#fca5a5", label:"Alert zone"},
            ].map(({ color, label }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:color }} />
                <span style={{ fontSize:10, color:"var(--text-secondary)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar — light */}
        <div style={{
          borderLeft:"1px solid var(--border)",
          background:"var(--surface-1)",
          display:"flex", flexDirection:"column",
          overflow:"hidden",
        }}>
          {/* Feed tabs */}
          <div style={{
            display:"flex",
            borderBottom:"1px solid var(--border)",
            flexShrink:0,
            background:"var(--surface-2)",
          }}>
            {(["ALL","HIGH","MIL","NATO"] as const).map(tab => (
              <button key={tab} onClick={() => setFeedTab(tab)} style={{
                flex:1, padding:"9px 4px",
                background:"transparent", border:"none",
                borderBottom:`2px solid ${feedTab===tab ? "#2563eb" : "transparent"}`,
                color: feedTab===tab ? "#1d4ed8" : "#94a3b8",
                fontSize:11, fontWeight: feedTab===tab ? 600 : 400,
                cursor:"pointer", transition:"all 0.1s",
              }}>
                {tab === "HIGH" ? "Critical" : tab === "ALL" ? "All" : tab}
              </button>
            ))}
          </div>

          {/* Critical section */}
          {feedTab === "ALL" && criticalArticles.length > 0 && (
            <div style={{ flexShrink:0, borderBottom:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.06)" }}>
              <div style={{ padding:"8px 16px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:10, color:"#fca5a5", fontWeight:700, letterSpacing:"0.06em" }}>CRITICAL</span>
                <span style={{ fontSize:10, color:"#fca5a5" }}>{criticalArticles.length}</span>
              </div>
              {criticalArticles.slice(0,3).map((a,i) => (
                <ArticleRow key={i} article={a}
                  isActive={activeArticle?.id===a.id}
                  onClick={() => setActiveArticle(activeArticle?.id===a.id?null:a)} />
              ))}
            </div>
          )}

          {/* Feed label */}
          <div style={{
            padding:"8px 16px",
            borderBottom:"1px solid var(--border)",
            flexShrink:0,
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background:"var(--surface-2)",
          }}>
            <span style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600, letterSpacing:"0.06em" }}>
              {feedTab === "ALL" ? "ALL EVENTS" : feedTab === "HIGH" ? "CRITICAL" : feedTab}
            </span>
            <span style={{ fontSize:10, color:"var(--text-muted)" }}>{feedArticles.length}</span>
          </div>

          {/* Article list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {feedArticles.length === 0 ? (
              <div style={{ padding:32, fontSize:12, color:"var(--text-muted)", textAlign:"center" }}>No events</div>
            ) : feedArticles.slice(0,60).map((a,i) => (
              <ArticleRow
                key={a.id+a.country+i}
                article={a}
                isActive={activeArticle?.id===a.id && activeArticle?.country===a.country}
                onClick={() => setActiveArticle(
                  activeArticle?.id===a.id && activeArticle?.country===a.country ? null : a
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}