/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Article, Vessel } from "@/types";
import { CAT_COLORS, geolocate, resetGeolocate } from "@/lib/constants";

interface MapProps {
  articles: Article[];
  vessels: Vessel[];
  activeArticle: Article | null;
  onArticleSelect: (article: Article) => void;
  onArticleHover: (article: Article | null, x: number, y: number) => void;
}

const MAPTILER_KEY = "WFSUficgIql925bRAF0e";
const SOURCE_ID = "articles";
const LAYER_ID = "article-circles";
const LAYER_RING_ID = "article-rings";
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

export default function Map({
  articles,
  vessels,
  activeArticle,
  onArticleSelect,
  onArticleHover,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const isLoadedRef = useRef(false);
  const articlesRef = useRef<Article[]>([]);
  articlesRef.current = articles;

  const buildGeoJSON = useCallback((arts: Article[]) => {
    resetGeolocate(); // reset spiral counts before each render
    return {
      type: "FeatureCollection",
      features: arts.slice(0, 50).map((a) => {
        const [lng, lat] = geolocate(a.title, a.description, a.country);
        const color = CAT_COLORS[a.category] || "#64748b";
        const isActive =
          activeArticle?.id === a.id && activeArticle?.country === a.country;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: {
            id: a.id,
            country: a.country,
            title: a.title,
            source: a.source,
            ago: a.ago,
            category: a.category,
            color,
            radius: isActive ? 8 : 5,
            opacity: isActive ? 1 : 0.88,
          },
        };
      }),
    };
  }, [activeArticle]);

  const updateArticles = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    const src = map.getSource(SOURCE_ID);
    if (src) src.setData(buildGeoJSON(articles) as any);
  }, [articles, buildGeoJSON]);

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
      const balticFeatures = countries.features.filter(
        (f: any) => BALTIC_ISO[String(f.id)]
      );

      balticFeatures.forEach((f: any) => {
        const code = BALTIC_ISO[String(f.id)];
        const color = COUNTRY_COLORS[code];
        const sourceId = `border-${code}`;
        const fillId = `fill-${code}`;
        const lineId = `line-${code}`;

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: "geojson", data: f as any });
        }

        if (!map.getLayer(fillId)) {
          map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": color,
              "fill-opacity": 0.03,
            },
          });
        }

        if (!map.getLayer(lineId)) {
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": color,
              "line-width": [
                "interpolate", ["linear"], ["zoom"],
                4, 1.5,
                8, 2.5,
                12, 3.5,
              ],
              "line-opacity": 0.75,
            },
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

      // Add colored country borders first
      await addBorders(map);

      // Article source
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: buildGeoJSON(articlesRef.current) as any,
      });

      // Outer ring
      map.addLayer({
        id: LAYER_RING_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["+", ["get", "radius"], 5],
          "circle-color": "transparent",
          "circle-stroke-width": 0.8,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.35,
        },
      });

      // Core dot
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            4, 3,
            8, ["get", "radius"],
            14, ["+", ["get", "radius"], 3],
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(255,255,255,0.2)",
        },
      });

      // Vessels
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

      // Click
      map.on("click", LAYER_ID, (e: any) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const art = articlesRef.current.find(
          (a) => a.id === props.id && a.country === props.country
        );
        if (art) onArticleSelect(art);
      });

      // Hover
      map.on("mouseenter", LAYER_ID, (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const art = articlesRef.current.find(
          (a) => a.id === props.id && a.country === props.country
        );
        if (art && container) {
          const rect = container.getBoundingClientRect();
          onArticleHover(art, rect.left + e.point.x, rect.top + e.point.y);
        }
      });

      map.on("mouseleave", LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        onArticleHover(null, 0, 0);
      });

      updateVessels();
    });
  }, [buildGeoJSON, onArticleSelect, onArticleHover, updateVessels, addBorders]);

  useEffect(() => { initMap(); }, [initMap]);
  useEffect(() => { updateArticles(); }, [updateArticles]);
  useEffect(() => { updateVessels(); }, [updateVessels]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
  );
}