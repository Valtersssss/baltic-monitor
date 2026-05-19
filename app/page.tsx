"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel, Category, Country } from "@/types";
import { WORKER_URL, AIS_KEY, CAT_COLORS } from "@/lib/constants";
import Topbar from "@/components/layout/Topbar";
import ArticlePopup from "@/components/map/ArticlePopup";

const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

const CATEGORIES: { key: Category | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Events" },
  { key: "MIL", label: "Military" },
  { key: "NATO", label: "NATO" },
  { key: "CYBER", label: "Cyber" },
  { key: "POL", label: "Politics" },
  { key: "ENERGY", label: "Energy" },
  { key: "GEN", label: "General" },
];

const COUNTRIES: { key: Country; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "EE", label: "Estonia" },
  { key: "LV", label: "Latvia" },
  { key: "LT", label: "Lithuania" },
];

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [hoveredArticle, setHoveredArticle] = useState<Article | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [filterCat, setFilterCat] = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const filteredArticles = articles.filter((a) => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    return true;
  });

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(WORKER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedData = await res.json();
      setArticles(data.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectAIS = useCallback(() => {
    if (!AIS_KEY || wsRef.current) return;
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({
        APIKey: AIS_KEY,
        BoundingBoxes: [[[53.5, 9.5], [66.0, 30.0]]],
        FilterMessageTypes: ["PositionReport"],
      }));
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const pos = msg.Message?.PositionReport;
        const meta = msg.MetaData;
        if (!pos || !meta || (pos.Latitude === 0 && pos.Longitude === 0)) return;
        setVessels((prev) => {
          const filtered = prev.filter((v) => v.mmsi !== meta.MMSI);
          return [...filtered, {
            mmsi: meta.MMSI,
            name: meta.ShipName?.trim() || `MMSI ${meta.MMSI}`,
            lat: pos.Latitude,
            lng: pos.Longitude,
            sog: pos.Sog || 0,
            type: pos.ShipType || 0,
            ts: Date.now(),
          }].slice(-200);
        });
      } catch {}
    };
    ws.onclose = () => { wsRef.current = null; setTimeout(connectAIS, 10000); };
  }, []);

  useEffect(() => {
    loadFeed();
    const id = setInterval(loadFeed, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadFeed]);

  useEffect(() => {
    connectAIS();
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [connectAIS]);

  const handleArticleSelect = useCallback((article: Article) => {
    setActiveArticle((prev) =>
      prev?.id === article.id && prev?.country === article.country ? null : article
    );
    setHoveredArticle(null);
    setSidebarOpen(true);
  }, []);

  const handleArticleHover = useCallback((article: Article | null, x: number, y: number) => {
    setHoveredArticle(article);
    if (article) setHoverPos({ x, y });
  }, []);

  const popup = activeArticle || hoveredArticle;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>

      {/* Topbar */}
      <Topbar eventCount={filteredArticles.length} onRefresh={loadFeed} isLoading={isLoading} />

      {/* Category filter bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 16px",
        height: 40,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        overflowX: "auto",
      }}>
        {CATEGORIES.map(({ key, label }) => {
          const isActive = filterCat === key;
          const color = key !== "ALL" ? CAT_COLORS[key as Category] : undefined;
          return (
            <button
              key={key}
              onClick={() => setFilterCat(key)}
              style={{
                padding: "5px 14px",
                borderRadius: 4,
                border: "none",
                background: isActive
                  ? color ? `${color}22` : "var(--bg-elevated)"
                  : "transparent",
                color: isActive
                  ? color || "var(--text-primary)"
                  : "var(--text-muted)",
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
                borderBottom: isActive
                  ? `2px solid ${color || "var(--accent-blue)"}`
                  : "2px solid transparent",
                transition: "all 0.12s",
              }}
            >
              {label.toUpperCase()}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px", flexShrink: 0 }} />

        {/* Country filter */}
        {COUNTRIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterCountry(key)}
            style={{
              padding: "5px 12px",
              borderRadius: 4,
              border: "none",
              background: filterCountry === key ? "var(--bg-elevated)" : "transparent",
              color: filterCountry === key ? "var(--text-primary)" : "var(--text-muted)",
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: filterCountry === key ? 600 : 400,
              cursor: "pointer",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
              borderBottom: filterCountry === key ? "2px solid var(--accent-blue)" : "2px solid transparent",
              transition: "all 0.12s",
            }}
          >
            {label.toUpperCase()}
          </button>
        ))}

        {/* Article count */}
        <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          {filteredArticles.length} events
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: sidebarOpen ? "1fr 360px" : "1fr", overflow: "hidden" }}>

        {/* Map */}
        <div ref={mapContainerRef} style={{ position: "relative", overflow: "hidden" }}>
          <Map
            articles={filteredArticles}
            vessels={vessels}
            activeArticle={activeArticle}
            onArticleSelect={handleArticleSelect}
            onArticleHover={handleArticleHover}
          />

          {/* Popup */}
          {popup && (
            <ArticlePopup
              article={popup}
              x={hoverPos.x}
              y={hoverPos.y}
              containerRef={mapContainerRef}
              onClose={() => { setActiveArticle(null); setHoveredArticle(null); }}
            />
          )}

          {/* Toggle sidebar button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-accent)",
              borderRadius: 6,
              padding: "6px 10px",
              color: "var(--text-secondary)",
              fontFamily: "monospace",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {sidebarOpen ? "→ HIDE" : "← FEED"}
          </button>

          {/* Map legend */}
          <div style={{
            position: "absolute", bottom: 24, left: 14,
            display: "flex", flexDirection: "column", gap: 5,
            pointerEvents: "none",
          }}>
            {[
              { color: "#f26d6d", label: "Military" },
              { color: "#5ba3f5", label: "NATO" },
              { color: "#f5b942", label: "Cyber" },
              { color: "#a78bfa", label: "Politics" },
              { color: "#4ec994", label: "Energy" },
              { color: "#22d3ee", label: "Vessel (AIS)" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, opacity: 0.85 }} />
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Sidebar header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "var(--text-muted)",
                letterSpacing: "0.15em",
              }}>
                INCIDENT FEED
              </div>
            </div>

            {/* Article list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {isLoading && filteredArticles.length === 0 ? (
                <div style={{ padding: 32, fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  Loading...
                </div>
              ) : filteredArticles.length === 0 ? (
                <div style={{ padding: 32, fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  No events match filter
                </div>
              ) : filteredArticles.slice(0, 50).map((article) => (
                <ArticleRow
                  key={article.id + article.country}
                  article={article}
                  isActive={activeArticle?.id === article.id && activeArticle?.country === article.country}
                  onSelect={handleArticleSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleRow({ article, isActive, onSelect }: {
  article: Article;
  isActive: boolean;
  onSelect: (a: Article) => void;
}) {
  const color = CAT_COLORS[article.category] || "#64748b";
  return (
    <div
      onClick={() => onSelect(article)}
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isActive ? `${color}10` : "transparent",
        borderLeft: `3px solid ${isActive ? color : "transparent"}`,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {/* Category + country */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        <span style={{
          fontFamily: "monospace", fontSize: 10, fontWeight: 600,
          padding: "2px 6px", borderRadius: 3,
          color, border: `1px solid ${color}44`, background: `${color}15`,
          letterSpacing: "0.05em",
        }}>
          {article.category}
        </span>
        <span style={{
          fontFamily: "monospace", fontSize: 10,
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
          padding: "1px 5px", borderRadius: 3,
        }}>
          {article.country}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: "var(--text-primary)",
        lineHeight: 1.45, marginBottom: 5,
      }}>
        {article.title}
      </div>

      {/* Meta */}
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
        {article.source} · {article.ago}
      </div>
    </div>
  );
}