/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Article, Vessel } from "@/types";

interface MapProps {
  articles: Article[];
  vessels: Vessel[];
  activeArticle: Article | null;
  onArticleSelect: (article: Article) => void;
  onArticleHover: (article: Article | null, x: number, y: number) => void;
  focusCountry?: string | null;
}

const MAPTILER_KEY = "WFSUficgIql925bRAF0e";
const VESSELS_SOURCE = "vessels";
const VESSELS_LAYER = "vessel-circles";

const BALTIC_ISO: Record<string, string> = {
  "233": "EE",
  "428": "LV",
  "440": "LT",
};

const COUNTRY_COLORS: Record<string, string> = {
  EE: "#4d9ef7",
  LV: "#f56565",
  LT: "#f6d860",
};

const COUNTRY_CENTRES: Record<string, [number, number]> = {
  EE: [25.0, 58.9],
  LV: [24.8, 56.9],
  LT: [24.0, 55.4],
  ALL: [25.0, 57.2],
};

export default function Map({
  articles,
  vessels,
  activeArticle,
  focusCountry,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const isLoadedRef = useRef(false);

  const updateVessels = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current || !vessels.length) return;
    const src = map.getSource(VESSELS_SOURCE);
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: vessels.map((v) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [v.lng, v.lat] },
          properties: { mmsi: v.mmsi, name: v.name, sog: v.sog },
        })),
      } as any);
    }
  }, [vessels]);

  const addBorders = useCallback(async (map: any) => {
    try {
      const [d3, topo] = await Promise.all([
        import("d3"),
        import("topojson-client"),
      ]);
      const world: any = await d3.json(
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
      );
      const countries: any = topo.feature(world, world.objects.countries);

      countries.features
        .filter((f: any) => BALTIC_ISO[String(f.id)])
        .forEach((f: any) => {
          const code = BALTIC_ISO[String(f.id)];
          const color = COUNTRY_COLORS[code];
          const sid = `border-${code}`;
          const fillId = `fill-${code}`;
          const lineId = `line-${code}`;

          if (!map.getSource(sid)) {
            map.addSource(sid, { type: "geojson", data: f as any });
          }
          if (!map.getLayer(fillId)) {
            map.addLayer({ id: fillId, type: "fill", source: sid,
              paint: { "fill-color": color, "fill-opacity": 0.04 } });
          }
          if (!map.getLayer(lineId)) {
            map.addLayer({ id: lineId, type: "line", source: sid,
              paint: {
                "line-color": color,
                "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 8, 2.5, 12, 3.5],
                "line-opacity": 0.75,
              }
            });
          }
        });
    } catch (e) {
      console.error("Border load failed:", e);
    }
  }, []);

  const initMap = useCallback(async () => {
    if (mapRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const maptiler = await import("@maptiler/sdk");
    await import("@maptiler/sdk/dist/maptiler-sdk.css");
    maptiler.config.apiKey = MAPTILER_KEY;

    const map = new maptiler.Map({
      container,
      style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`,
      center: [25.0, 57.2],
      zoom: 6.0,
      minZoom: 3,
      maxZoom: 16,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on("load", async () => {
      isLoadedRef.current = true;
      await addBorders(map);

      // Vessels only — no article dots
      map.addSource(VESSELS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] } as any,
      });

      map.addLayer({
        id: VESSELS_LAYER,
        type: "circle",
        source: VESSELS_SOURCE,
        paint: {
          "circle-radius": 3,
          "circle-color": "#22d3ee",
          "circle-opacity": 0.85,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
        },
      });

      updateVessels();
    });
  }, [addBorders, updateVessels]);

  // Fly to country when filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    const country = focusCountry || "ALL";
    const centre = COUNTRY_CENTRES[country] || COUNTRY_CENTRES.ALL;
    const zoom = country === "ALL" ? 6.0 : 7.0;
    map.flyTo({ center: centre, zoom, duration: 800 });
  }, [focusCountry]);

  // Fly to active article's country
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current || !activeArticle) return;
    const centre = COUNTRY_CENTRES[activeArticle.country];
    if (centre) map.flyTo({ center: centre, zoom: 7.5, duration: 800 });
  }, [activeArticle]);

  useEffect(() => { initMap(); }, [initMap]);
  useEffect(() => { updateVessels(); }, [updateVessels]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
  );
}