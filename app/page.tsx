"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article, FeedData, Vessel } from "@/types";
import { WORKER_URL, AIS_KEY } from "@/lib/constants";
import Topbar from "@/components/layout/Topbar";
import Feed from "@/components/feed/Feed";
import ArticlePopup from "@/components/map/ArticlePopup";

// Dynamically import Map to avoid SSR issues with D3
const Map = dynamic(() => import("@/components/map/Map"), { ssr: false });

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [hoveredArticle, setHoveredArticle] = useState<Article | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(WORKER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedData = await res.json();
      setArticles(data.articles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feed error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // AIS WebSocket
  const connectAIS = useCallback(() => {
    if (!AIS_KEY || wsRef.current) return;
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          APIKey: AIS_KEY,
          BoundingBoxes: [[[53.5, 9.5], [66.0, 30.0]]],
          FilterMessageTypes: ["PositionReport"],
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const pos = msg.Message?.PositionReport;
        const meta = msg.MetaData;
        if (!pos || !meta) return;
        if (pos.Latitude === 0 && pos.Longitude === 0) return;

        const vessel: Vessel = {
          mmsi: meta.MMSI,
          name: meta.ShipName?.trim() || `MMSI ${meta.MMSI}`,
          lat: pos.Latitude,
          lng: pos.Longitude,
          sog: pos.Sog || 0,
          type: pos.ShipType || 0,
          ts: Date.now(),
        };

        setVessels((prev) => {
          const filtered = prev.filter((v) => v.mmsi !== vessel.mmsi);
          return [...filtered, vessel].slice(-200);
        });
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      setTimeout(connectAIS, 10000);
    };
  }, []);

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadFeed]);

  useEffect(() => {
    connectAIS();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connectAIS]);

  const handleArticleSelect = useCallback((article: Article) => {
    setActiveArticle((prev) =>
      prev?.id === article.id && prev?.country === article.country ? null : article
    );
    setHoveredArticle(null);
  }, []);

  const handleArticleHover = useCallback(
    (article: Article | null, x: number, y: number) => {
      setHoveredArticle(article);
      if (article) setHoverPos({ x, y });
    },
    []
  );

  const popup = activeArticle || hoveredArticle;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg-primary)",
        overflow: "hidden",
      }}
    >
      <Topbar
        eventCount={articles.length}
        onRefresh={loadFeed}
        isLoading={isLoading}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          overflow: "hidden",
        }}
      >
        {/* Map panel */}
        <div
          ref={mapContainerRef}
          style={{
            position: "relative",
            borderRight: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {/* Map tag */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              zIndex: 10,
              fontFamily: "monospace",
              fontSize: 9,
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.12em",
              pointerEvents: "none",
            }}
          >
            SIGINT OVERLAY — BALTIC THEATRE
          </div>

          {/* Error state */}
          {error && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 4,
                padding: "4px 10px",
                fontFamily: "monospace",
                fontSize: 10,
                color: "#ef4444",
              }}
            >
              Feed error: {error}
            </div>
          )}

          <Map
            articles={articles}
            vessels={vessels}
            activeArticle={activeArticle}
            onArticleSelect={handleArticleSelect}
            onArticleHover={handleArticleHover}
          />

          {/* Article popup */}
          {popup && (
            <ArticlePopup
              article={popup}
              x={hoverPos.x}
              y={hoverPos.y}
              containerRef={mapContainerRef}
              onClose={() => {
                setActiveArticle(null);
                setHoveredArticle(null);
              }}
            />
          )}

          {/* Map legend */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              pointerEvents: "none",
            }}
          >
            {(
              [
                { color: "#ef4444", label: "Military" },
                { color: "#3b82f6", label: "NATO" },
                { color: "#f59e0b", label: "Cyber" },
                { color: "#8b5cf6", label: "Political" },
                { color: "#10b981", label: "Energy" },
                { color: "#22d3ee", label: "Vessel" },
              ] as const
            ).map(({ color, label }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    opacity: 0.8,
                  }}
                />
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--bg-secondary)",
          }}
        >
          {isLoading && articles.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              Loading feed...
            </div>
          ) : (
            <Feed
              articles={articles}
              activeArticleId={
                activeArticle
                  ? activeArticle.id + activeArticle.country
                  : null
              }
              onSelect={handleArticleSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}