"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";
import Topbar from "@/components/layout/Topbar";

const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

// ─── Data ────────────────────────────────────────────────────────────────────

const CATS: { key: Category | "ALL"; label: string }[] = [
  { key:"ALL",    label:"All" },
  { key:"MIL",   label:"Military" },
  { key:"NATO",  label:"NATO" },
  { key:"CYBER", label:"Cyber" },
  { key:"POL",   label:"Politics" },
  { key:"ENERGY",label:"Energy" },
  { key:"GEN",   label:"General" },
];

const COUNTRIES: { key: Country; label: string; flag: string }[] = [
  { key:"ALL", label:"All",       flag:"" },
  { key:"EE",  label:"Estonia",   flag:"🇪🇪" },
  { key:"LV",  label:"Latvia",    flag:"🇱🇻" },
  { key:"LT",  label:"Lithuania", flag:"🇱🇹" },
];

const CC: Record<string, string> = { EE:"#4580c4", LV:"#b03030", LT:"#a07830" };
const FLAGS: Record<string,string> = { EE:"🇪🇪", LV:"🇱🇻", LT:"🇱🇹" };

const clean = (s: string) => s
  .replace(/&quot;/g,'"').replace(/&#039;/g,"'")
  .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");

// ─── Severity ────────────────────────────────────────────────────────────────

function sev(a: Article): "critical"|"active"|"low" {
  const t = (a.title+" "+a.description).toLowerCase();
  if (["attack","missile","explosion","invasion","breach","jamming","cable cut","crash"].some(k=>t.includes(k))) return "critical";
  if (["drone","alert","military","nato","exercise","troops","cyber","border","threat","warning","incident"].some(k=>t.includes(k))) return "active";
  return "low";
}

const SEV_DOT: Record<string,string> = { critical:"#c0392b", active:"#c87941", low:"#1e2d3d" };

// ─── Ticker ───────────────────────────────────────────────────────────────────

function Ticker({ articles }: { articles: Article[] }) {
  const items = articles.filter(a => sev(a) !== "low").slice(0,8);
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div style={{ height:28, flexShrink:0, background:"rgba(192,57,43,0.07)", borderBottom:"1px solid rgba(192,57,43,0.12)", display:"flex", alignItems:"center", overflow:"hidden" }}>
      <div style={{ flexShrink:0, background:"#c0392b", color:"#fff", fontSize:9, fontWeight:700, padding:"0 10px", height:"100%", display:"flex", alignItems:"center", letterSpacing:"0.1em" }}>ALERT</div>
      <div style={{ flex:1, overflow:"hidden", maskImage:"linear-gradient(to right,transparent,black 3%,black 97%,transparent)" }}>
        <div style={{ display:"flex", whiteSpace:"nowrap", animation:`tick ${items.length*8}s linear infinite` }}>
          {doubled.map((a,i) => (
            <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"0 20px" }}>
              <span style={{ fontSize:12 }}>{FLAGS[a.country]||""}</span>
              <span style={{ fontSize:10, fontWeight:600, color:CAT_COLORS[a.category] }}>{a.category}</span>
              <span style={{ fontSize:11, color:"var(--t2)" }}>{clean(a.title).slice(0,85)}</span>
              <span style={{ color:"rgba(192,57,43,0.3)" }}>—</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

// ─── Article row ──────────────────────────────────────────────────────────────

function Row({ a, active, onClick }: { a: Article; active: boolean; onClick: () => void }) {
  const s = sev(a);
  const cat = CAT_COLORS[a.category];
  const cc  = CC[a.country] || "var(--t3)";
  return (
    <div
      onClick={onClick}
      style={{
        padding:"9px 14px",
        borderBottom:"1px solid var(--line)",
        cursor:"pointer",
        background: active ? "rgba(69,128,196,0.07)" : "transparent",
        borderLeft:`2px solid ${active ? cat : "transparent"}`,
        transition:"background 0.1s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "var(--g2)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:SEV_DOT[s], flexShrink:0 }} />
        <span style={{ fontSize:10, fontWeight:600, color:cat, letterSpacing:"0.03em" }}>{a.category}</span>
        <span style={{ fontSize:10, color:cc }}>{FLAGS[a.country]} {a.country}</span>
        {s === "critical" && (
          <span style={{ fontSize:9, fontWeight:700, color:"#e88080", background:"rgba(192,57,43,0.12)", border:"1px solid rgba(192,57,43,0.2)", borderRadius:3, padding:"0 4px" }}>CRITICAL</span>
        )}
        <span style={{ fontSize:10, color:"var(--t3)", marginLeft:"auto" }}>{a.ago}</span>
      </div>
      <div style={{
        fontSize:12, fontWeight:500,
        color: s === "critical" ? "var(--t1)" : "var(--t2)",
        lineHeight:1.4,
        overflow:"hidden", display:"-webkit-box",
        WebkitLineClamp:2, WebkitBoxOrient:"vertical",
      }}>
        {clean(a.title)}
      </div>
      <div style={{ fontSize:10, color:"var(--t3)", marginTop:3 }}>{a.source}</div>
    </div>
  );
}

// ─── Map card ─────────────────────────────────────────────────────────────────

function Card({ a, onClose }: { a: Article; onClose: () => void }) {
  const cat = CAT_COLORS[a.category];
  const s = sev(a);
  return (
    <div style={{
      position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)",
      width:300, zIndex:30,
      background:"var(--g2)",
      border:"1px solid var(--line-2)",
      borderRadius:8, overflow:"hidden",
      boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {a.image && (
        <div style={{ width:"100%", height:130, overflow:"hidden", position:"relative" }}>
          <img src={a.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.75 }}
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display="none"; }} />
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,transparent 40%,var(--g2))" }} />
        </div>
      )}
      <div style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
          <span style={{ fontSize:10, fontWeight:600, color:cat }}>{a.category}</span>
          <span style={{ fontSize:10, color:"var(--t3)" }}>·</span>
          <span style={{ fontSize:10, color:"var(--t3)" }}>{a.source}</span>
          <span style={{ fontSize:10, color:"var(--t3)" }}>·</span>
          <span style={{ fontSize:10, color:"var(--t3)" }}>{a.ago}</span>
          {s==="critical" && <span style={{ fontSize:9, fontWeight:700, color:"#e88080", marginLeft:2 }}>CRITICAL</span>}
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", lineHeight:1.4, marginBottom:7 }}>{clean(a.title)}</div>
        {a.description && (
          <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.6, marginBottom:10 }}>
            {clean(a.description).replace(/<[^>]+>/g,"").slice(0,150)}…
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={onClose} style={{ fontSize:11, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}>Dismiss</button>
          <a href={a.link} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontWeight:600, color:cat, border:`1px solid ${cat}44`, padding:"3px 10px", borderRadius:4, textDecoration:"none" }}>
            Read →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [articles, setArticles]       = useState<Article[]>([]);
  const [vessels,  setVessels]        = useState<Vessel[]>([]);
  const [loading,  setLoading]        = useState(false);
  const [active,   setActive]         = useState<Article | null>(null);
  const [filterCat,setFilterCat]      = useState<Category | "ALL">("ALL");
  const [filterCo, setFilterCo]       = useState<Country>("ALL");
  const [tab,      setTab]            = useState<"ALL"|"HIGH"|"MIL"|"NATO">("ALL");
  const [updated,  setUpdated]        = useState<Date | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const filtered = articles.filter(a => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCo  !== "ALL" && a.country  !== filterCo)  return false;
    return true;
  });

  const critical = filtered.filter(a => sev(a) === "critical");
  const feed     = tab==="HIGH" ? critical
    : tab==="MIL"  ? filtered.filter(a=>a.category==="MIL")
    : tab==="NATO" ? filtered.filter(a=>a.category==="NATO")
    : filtered;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(WORKER_URL);
      const d: FeedData = await r.json();
      setArticles(d.articles || []);
      setUpdated(new Date());
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const ais = useCallback(() => {
    if (!AIS_KEY || ws.current) return;
    const w = new WebSocket("wss://stream.aisstream.io/v0/stream");
    ws.current = w;
    w.onopen = () => w.send(JSON.stringify({ APIKey:AIS_KEY, BoundingBoxes:[[[53.5,9.5],[66,30]]], FilterMessageTypes:["PositionReport"] }));
    w.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        const p = m.Message?.PositionReport, meta = m.MetaData;
        if (!p||!meta||!p.Latitude||!p.Longitude) return;
        setVessels(prev => [...prev.filter(v=>v.mmsi!==meta.MMSI),{ mmsi:meta.MMSI, name:meta.ShipName?.trim()||`MMSI ${meta.MMSI}`, lat:p.Latitude, lng:p.Longitude, sog:p.Sog||0, type:p.ShipType||0, ts:Date.now() }].slice(-200));
      } catch {}
    };
    w.onclose = () => { ws.current=null; setTimeout(ais,10000); };
  }, []);

  useEffect(() => { load(); const id=setInterval(load,5*60*1000); return()=>clearInterval(id); }, [load]);
  useEffect(() => { ais(); return()=>{ ws.current?.close(); ws.current=null; }; }, [ais]);

  // Tab styling helper
  const tabColor = (t: string) => t==="HIGH"||t==="MIL" ? "var(--red)" : t==="NATO" ? "var(--blue)" : "var(--blue)";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:"var(--g0)" }}>

      <Topbar
        eventCount={filtered.length} highCount={critical.length}
        medCount={filtered.filter(a=>sev(a)==="active").length}
        onRefresh={load} isLoading={loading} lastUpdated={updated}
        sources={[]} vesselCount={vessels.length}
      />

      <Ticker articles={filtered} />

      {/* Filter bar */}
      <div style={{ height:38, flexShrink:0, background:"var(--g1)", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", padding:"0 18px", overflowX:"auto" }}>
        {CATS.map(({ key, label }) => {
          const on = filterCat === key;
          const c  = key!=="ALL" ? CAT_COLORS[key as Category] : "var(--t1)";
          return (
            <button key={key} onClick={()=>setFilterCat(key)} style={{
              padding:"4px 11px", background:"transparent", border:"none",
              color: on ? c : "var(--t3)",
              fontSize:12, fontWeight: on ? 600 : 400,
              cursor:"pointer", whiteSpace:"nowrap",
              borderBottom:`2px solid ${on ? c : "transparent"}`,
              transition:"all 0.1s",
            }}>{label}</button>
          );
        })}
        <div style={{ width:1, height:14, background:"var(--line)", margin:"0 8px", flexShrink:0 }} />
        {COUNTRIES.map(({ key, label, flag }) => {
          const on = filterCo === key;
          const c  = key!=="ALL" ? CC[key] : "var(--t1)";
          return (
            <button key={key} onClick={()=>setFilterCo(key)} style={{
              padding:"4px 10px", background:"transparent", border:"none",
              color: on ? c : "var(--t3)",
              fontSize:12, fontWeight: on ? 600 : 400,
              cursor:"pointer", whiteSpace:"nowrap",
              borderBottom:`2px solid ${on ? c : "transparent"}`,
              transition:"all 0.1s",
              display:"flex", alignItems:"center", gap:4,
            }}>
              {flag && <span style={{ fontSize:13 }}>{flag}</span>}
              {label}
            </button>
          );
        })}
        <span style={{ marginLeft:"auto", fontSize:11, color:"var(--t4)", flexShrink:0 }}>{filtered.length} events</span>
      </div>

      {/* Main layout */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 340px", overflow:"hidden" }}>

        {/* MAP */}
        <div style={{ position:"relative", overflow:"hidden" }}>
          <Map
            articles={filtered} vessels={vessels}
            activeArticle={active}
            onArticleSelect={setActive}
            onArticleHover={()=>{}}
            focusCountry={filterCo!=="ALL" ? filterCo : null}
          />
          {active && <Card a={active} onClose={()=>setActive(null)} />}

          {/* Minimal legend */}
          <div style={{
            position:"absolute", bottom:14, left:12,
            background:"rgba(14,17,23,0.82)",
            border:"1px solid var(--line)",
            borderRadius:5, padding:"7px 9px",
            backdropFilter:"blur(6px)",
          }}>
            {[
              { c:"#4a90d9", l:"Estonia" },
              { c:"#a03030", l:"Latvia"  },
              { c:"#987030", l:"Lithuania"},
              { c:"var(--cyan)", l:"Vessel"},
              { c:"var(--red)",  l:"Alert zone"},
            ].map(({ c, l }) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:c, opacity:0.7 }} />
                <span style={{ fontSize:10, color:"var(--t3)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ borderLeft:"1px solid var(--line)", background:"var(--g1)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid var(--line)", flexShrink:0 }}>
            {(["ALL","HIGH","MIL","NATO"] as const).map(t => (
              <button key={t} onClick={()=>setTab(t)} style={{
                flex:1, padding:"8px 2px",
                background:"transparent", border:"none",
                borderBottom:`2px solid ${tab===t ? tabColor(t) : "transparent"}`,
                color: tab===t ? "var(--t1)" : "var(--t3)",
                fontSize:10, fontWeight: tab===t ? 600 : 400,
                cursor:"pointer", transition:"all 0.1s",
                letterSpacing:"0.04em",
              }}>
                {t === "HIGH" ? "Critical" : t === "ALL" ? "All" : t}
              </button>
            ))}
          </div>

          {/* Critical block */}
          {tab==="ALL" && critical.length > 0 && (
            <div style={{ flexShrink:0, borderBottom:"1px solid rgba(192,57,43,0.15)" }}>
              <div style={{ padding:"7px 14px 3px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:9, color:"#c0392b", fontWeight:700, letterSpacing:"0.1em" }}>CRITICAL</span>
                <span style={{ fontSize:9, color:"rgba(192,57,43,0.4)" }}>{critical.length}</span>
              </div>
              {critical.slice(0,3).map((a,i) => (
                <Row key={i} a={a} active={active?.id===a.id} onClick={()=>setActive(active?.id===a.id?null:a)} />
              ))}
            </div>
          )}

          {/* Feed header */}
          <div style={{ padding:"7px 14px", borderBottom:"1px solid var(--line)", flexShrink:0, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:9, color:"var(--t3)", fontWeight:600, letterSpacing:"0.08em" }}>
              {tab==="ALL" ? "EVENTS" : tab==="HIGH" ? "CRITICAL" : tab}
            </span>
            <span style={{ fontSize:9, color:"var(--t4)" }}>{feed.length}</span>
          </div>

          {/* List */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {feed.length===0
              ? <div style={{ padding:28, fontSize:12, color:"var(--t3)", textAlign:"center" }}>No events</div>
              : feed.slice(0,60).map((a,i) => (
                <Row key={a.id+a.country+i} a={a}
                  active={active?.id===a.id && active?.country===a.country}
                  onClick={()=>setActive(active?.id===a.id && active?.country===a.country ? null : a)}
                />
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}