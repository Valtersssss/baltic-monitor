"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";
import Topbar from "@/components/layout/Topbar";

const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category | "ALL"; label: string }[] = [
  { key: "ALL",    label: "All" },
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
  EE: "#4a90d9",
  LV: "#d94a4a",
  LT: "#d9b84a",
};

const FLAGS: Record<string, string> = { EE: "🇪🇪", LV: "🇱🇻", LT: "🇱🇹" };

// ── Severity ──────────────────────────────────────────────────────────────────

function getSeverity(a: Article): "critical" | "active" | "low" {
  const t = (a.title + " " + a.description).toLowerCase();
  const critical = ["attack","missile","explosion","invasion","breach","intercept","airspace violation","infrastructure damage","cable cut","jamming"];
  const active   = ["drone","alert","military","nato","exercise","troops","deploy","sanction","cyber","border","threat","warning","vessel"];
  if (critical.some(k => t.includes(k))) return "critical";
  if (active.some(k => t.includes(k)))   return "active";
  return "low";
}

const SEV_STYLES = {
  critical: { dot: "#f87171", label: "CRITICAL", labelColor: "#fca5a5" },
  active:   { dot: "#fbbf24", label: "ACTIVE",   labelColor: "#fde68a" },
  low:      { dot: "#475569", label: "",          labelColor: "#475569" },
};

// ── Alert Ticker ──────────────────────────────────────────────────────────────

function AlertTicker({ articles }: { articles: Article[] }) {
  const urgent = articles.filter(a => getSeverity(a) !== "low").slice(0, 8);
  if (!urgent.length) return null;

  const items = [...urgent, ...urgent];
  return (
    <div style={{
      height: 28, flexShrink: 0,
      background: "rgba(248,113,113,0.06)",
      borderBottom: "1px solid rgba(248,113,113,0.15)",
      display: "flex", alignItems: "center",
      overflow: "hidden",
    }}>
      <div style={{
        flexShrink: 0,
        background: "#f87171",
        color: "#fff",
        fontSize: 9, fontWeight: 700,
        padding: "0 10px", height: "100%",
        display: "flex", alignItems: "center",
        letterSpacing: "0.1em",
      }}>
        ALERT
      </div>
      <div style={{ flex: 1, overflow: "hidden", maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)" }}>
        <div style={{
          display: "flex", alignItems: "center",
          whiteSpace: "nowrap",
          animation: `ticker ${urgent.length * 7}s linear infinite`,
        }}>
          {items.map((a, i) => {
            const color = CAT_COLORS[a.category];
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 20px" }}>
                <span style={{ fontSize: 12 }}>{FLAGS[a.country] || ""}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: "0.05em" }}>{a.category}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {a.title.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,'&').slice(0, 80)}
                </span>
                <span style={{ color: "rgba(248,113,113,0.3)", fontSize: 10 }}>///</span>
              </span>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBar({
  filterCat, setFilterCat,
  filterCountry, setFilterCountry,
  count,
}: {
  filterCat: Category | "ALL";
  setFilterCat: (c: Category | "ALL") => void;
  filterCountry: Country;
  setFilterCountry: (c: Country) => void;
  count: number;
}) {
  return (
    <div style={{
      height: 38, flexShrink: 0,
      background: "var(--surface-1)",
      borderBottom: "1px solid var(--border-subtle)",
      display: "flex", alignItems: "center",
      padding: "0 18px", gap: 0,
      overflowX: "auto",
    }}>
      {CATEGORIES.map(({ key, label }) => {
        const active = filterCat === key;
        const color = key !== "ALL" ? CAT_COLORS[key as Category] : "var(--text-secondary)";
        return (
          <button key={key} onClick={() => setFilterCat(key)} style={{
            padding: "4px 12px",
            background: "transparent",
            border: "none",
            color: active ? color : "var(--text-faint)",
            fontSize: 11, fontWeight: active ? 600 : 400,
            cursor: "pointer",
            letterSpacing: "0.04em",
            borderBottom: `2px solid ${active ? color : "transparent"}`,
            transition: "all 0.1s",
            whiteSpace: "nowrap",
          }}>
            {label}
          </button>
        );
      })}

      <div style={{ width: 1, height: 14, background: "var(--border-subtle)", margin: "0 10px", flexShrink: 0 }} />

      {COUNTRIES.map(({ key, label, flag }) => {
        const active = filterCountry === key;
        const color = key !== "ALL" ? COUNTRY_COLORS[key] : "var(--text-secondary)";
        return (
          <button key={key} onClick={() => setFilterCountry(key)} style={{
            padding: "4px 10px",
            background: "transparent",
            border: "none",
            color: active ? color : "var(--text-faint)",
            fontSize: 11, fontWeight: active ? 600 : 400,
            cursor: "pointer",
            borderBottom: `2px solid ${active ? color : "transparent"}`,
            transition: "all 0.1s",
            whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {flag && <span style={{ fontSize: 12 }}>{flag}</span>}
            {label}
          </button>
        );
      })}

      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>
        {count} events
      </span>
    </div>
  );
}

// ── Article Row ───────────────────────────────────────────────────────────────

function ArticleRow({ article, isActive, onClick }: {
  article: Article;
  isActive: boolean;
  onClick: () => void;
}) {
  const sev = getSeverity(article);
  const ss = SEV_STYLES[sev];
  const catColor = CAT_COLORS[article.category];
  const ccColor = COUNTRY_COLORS[article.country] || "var(--text-muted)";
  const clean = (s: string) => s.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');

  return (
    <div
      onClick={onClick}
      style={{
        padding: "9px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer",
        background: isActive ? "rgba(96,165,250,0.05)" : "transparent",
        borderLeft: `2px solid ${isActive ? catColor : "transparent"}`,
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: catColor, fontWeight: 600, letterSpacing: "0.04em" }}>{article.category}</span>
        <span style={{ fontSize: 10, color: ccColor, fontWeight: 500 }}>{FLAGS[article.country] || ""} {article.country}</span>
        {sev === "critical" && (
          <span style={{ fontSize: 9, color: ss.labelColor, fontWeight: 700, letterSpacing: "0.06em" }}>· {ss.label}</span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>{article.ago}</span>
      </div>
      <div style={{
        fontSize: 12, fontWeight: 500,
        color: sev === "critical" ? "#f1f5f9" : "var(--text-secondary)",
        lineHeight: 1.4,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>
        {clean(article.title)}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>{article.source}</div>
    </div>
  );
}

// ── Selected Article Card ─────────────────────────────────────────────────────

function ArticleCard({ article, onClose }: { article: Article; onClose: () => void }) {
  const sev = getSeverity(article);
  const catColor = CAT_COLORS[article.category];
  const clean = (s: string) => s.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');

  return (
    <div style={{
      position: "absolute", bottom: 16, left: "50%",
      transform: "translateX(-50%)",
      width: 300, zIndex: 30,
      background: "rgba(15,17,23,0.95)",
      border: "1px solid var(--border-default)",
      borderRadius: 8,
      overflow: "hidden",
      backdropFilter: "blur(12px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    }}>
      {/* Image */}
      {article.image && (
        <div style={{ width: "100%", height: 130, overflow: "hidden", position: "relative" }}>
          <img src={article.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }}
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(15,17,23,0.98))" }} />
        </div>
      )}

      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 7, alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: catColor, letterSpacing: "0.05em" }}>{article.category}</span>
          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>·</span>
          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>{article.source}</span>
          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>·</span>
          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>{article.ago}</span>
          {sev === "critical" && (
            <span style={{ fontSize: 9, color: "#fca5a5", fontWeight: 700, marginLeft: 2 }}>CRITICAL</span>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 7 }}>
          {clean(article.title)}
        </div>

        {article.description && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>
            {clean(article.description).replace(/<[^>]+>/g, "").slice(0, 160)}…
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} style={{ fontSize: 10, color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer" }}>
            Dismiss
          </button>
          <a href={article.link} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 10, fontWeight: 600, color: catColor,
            border: `1px solid ${catColor}44`,
            padding: "3px 10px", borderRadius: 3, textDecoration: "none",
          }}>
            Read →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

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
  const activeArticles   = filtered.filter(a => getSeverity(a) === "active");
  const lowArticles      = filtered.filter(a => getSeverity(a) === "low");
  const highCount        = criticalArticles.length;
  const medCount         = activeArticles.length;

  const feedArticles = feedTab === "HIGH" ? criticalArticles
    : feedTab === "MIL"  ? filtered.filter(a => a.category === "MIL")
    : feedTab === "NATO" ? filtered.filter(a => a.category === "NATO")
    : filtered;

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

      <FilterBar
        filterCat={filterCat} setFilterCat={setFilterCat}
        filterCountry={filterCountry} setFilterCountry={setFilterCountry}
        count={filtered.length}
      />

      {/* Main */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 360px", overflow:"hidden" }}>

        {/* Map */}
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

          {/* Legend */}
          <div style={{
            position:"absolute", bottom:16, left:14,
            background:"rgba(15,17,23,0.85)",
            borderRadius:6, padding:"8px 10px",
            border:"1px solid var(--border-subtle)",
            backdropFilter:"blur(8px)",
          }}>
            {[
              { color:"#4a90d9", label:"Estonia" },
              { color:"#d94a4a", label:"Latvia"  },
              { color:"#d9b84a", label:"Lithuania"},
              { color:"#22d3ee", label:"Vessel"  },
              { color:"#f87171", label:"Alert zone"},
            ].map(({ color, label }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:color, opacity:0.7 }} />
                <span style={{ fontSize:9, color:"var(--text-faint)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ borderLeft:"1px solid var(--border-subtle)", background:"var(--surface-1)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Feed tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid var(--border-subtle)", flexShrink:0 }}>
            {(["ALL","HIGH","MIL","NATO"] as const).map(tab => (
              <button key={tab} onClick={() => setFeedTab(tab)} style={{
                flex:1, padding:"8px 4px",
                background:"transparent", border:"none",
                borderBottom:`2px solid ${feedTab===tab ? (tab==="HIGH"?"#f87171":tab==="MIL"?"#f87171":tab==="NATO"?"#60a5fa":"var(--accent-blue)") : "transparent"}`,
                color: feedTab===tab ? "var(--text-primary)" : "var(--text-faint)",
                fontSize:10, fontWeight: feedTab===tab ? 600 : 400,
                cursor:"pointer", transition:"all 0.1s",
                letterSpacing:"0.05em",
              }}>
                {tab === "HIGH" ? "🔴 Critical" : tab}
              </button>
            ))}
          </div>

          {/* Critical section */}
          {feedTab === "ALL" && criticalArticles.length > 0 && (
            <div style={{ flexShrink:0, borderBottom:"1px solid rgba(248,113,113,0.15)" }}>
              <div style={{ padding:"8px 16px 4px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:9, color:"#f87171", fontWeight:700, letterSpacing:"0.1em" }}>CRITICAL</span>
                <span style={{ fontSize:9, color:"rgba(248,113,113,0.5)" }}>{criticalArticles.length}</span>
              </div>
              {criticalArticles.slice(0,3).map((a,i) => (
                <ArticleRow key={i} article={a} isActive={activeArticle?.id===a.id} onClick={() => setActiveArticle(activeArticle?.id===a.id?null:a)} />
              ))}
            </div>
          )}

          {/* Feed header */}
          <div style={{ padding:"8px 16px", borderBottom:"1px solid var(--border-subtle)", flexShrink:0, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:9, color:"var(--text-faint)", letterSpacing:"0.1em" }}>
              {feedTab === "ALL" ? "ALL EVENTS" : feedTab === "HIGH" ? "CRITICAL" : feedTab}
            </span>
            <span style={{ fontSize:9, color:"var(--text-faint)" }}>{feedArticles.length}</span>
          </div>

          {/* Article list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {feedArticles.length === 0 ? (
              <div style={{ padding:32, fontSize:11, color:"var(--text-faint)", textAlign:"center" }}>No events</div>
            ) : feedArticles.slice(0,60).map((a,i) => (
              <ArticleRow
                key={a.id+a.country+i}
                article={a}
                isActive={activeArticle?.id===a.id && activeArticle?.country===a.country}
                onClick={() => setActiveArticle(activeArticle?.id===a.id && activeArticle?.country===a.country ? null : a)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}