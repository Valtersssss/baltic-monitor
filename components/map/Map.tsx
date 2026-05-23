/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Article, Vessel } from "@/types";
import { geolocate, resetGeolocate } from "@/lib/constants";

interface MapProps {
  articles: Article[];
  vessels: Vessel[];
  activeArticle: Article | null;
  onArticleSelect: (article: Article) => void;
  onArticleHover: (article: Article | null, x: number, y: number) => void;
  focusCountry?: string | null;
}

const MAPTILER_KEY = "WFSUficgIql925bRAF0e";

// Keywords that trigger threat zones
const THREAT_KEYWORDS = ["drone","airspace","missile","threat alert","air alert","uav","airspace alert","airspace warning","flying object","air threat","airspace closed","no-fly"];
const EXPLICIT_RESOLVED = ["alert lifted","all clear","airspace reopened","threat is over","alert is over","alert ended","alert cancelled","alert cleared"];

function isThreatArticle(article: Article): boolean {
  const text = (article.title + " " + article.description).toLowerCase();
  return THREAT_KEYWORDS.some(k => text.includes(k));
}

function getAgeHours(article: Article): number {
  return (Date.now() - new Date(article.pubDate).getTime()) / 3600000;
}

function isExplicitlyResolved(article: Article): boolean {
  const text = (article.title + " " + article.description).toLowerCase();
  return EXPLICIT_RESOLVED.some(k => text.includes(k));
}

// Time-based decay — no guessing from ambiguous keywords
function getZoneState(article: Article): "active" | "aging" | "old" | "resolved" {
  if (isExplicitlyResolved(article)) return "resolved";
  const h = getAgeHours(article);
  if (h < 2)  return "active";
  if (h < 6)  return "aging";
  if (h < 12) return "old";
  return "resolved"; // auto-expire after 12h
}

function getZoneStyle(article: Article): { fill: string; stroke: string; fillOpacity: number; strokeOpacity: number; dash: boolean; label: string; labelColor: string } {
  const state = getZoneState(article);
  const h = getAgeHours(article);
  switch(state) {
    case "active":   return { fill:"#ef4444", stroke:"#ef4444", fillOpacity:0.12, strokeOpacity:0.9,  dash:false, label:"⚠ DRONE ALERT",        labelColor:"#ef4444" };
    case "aging":    return { fill:"#f97316", stroke:"#f97316", fillOpacity:0.07, strokeOpacity:0.6,  dash:false, label:`⚠ ALERT · ${Math.round(h)}h ago`, labelColor:"#f97316" };
    case "old":      return { fill:"#f59e0b", stroke:"#f59e0b", fillOpacity:0.04, strokeOpacity:0.35, dash:true,  label:`· ${Math.round(h)}h ago`,  labelColor:"#64748b" };
    case "resolved": return { fill:"#64748b", stroke:"#64748b", fillOpacity:0.02, strokeOpacity:0.2,  dash:true,  label:"",                         labelColor:"#64748b" };
  }
}

// Deduplicate threat articles by location proximity — keep most recent
function deduplicateThreats(articles: Article[]): Article[] {
  const sorted = [...articles].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  const result: Article[] = [];
  const used: Array<[number, number]> = [];
  for (const article of sorted) {
    const [lng, lat] = geolocate(article.title, article.description, article.country);
    const tooClose = used.some(([ulng, ulat]) => {
      return Math.sqrt(Math.pow(lng - ulng, 2) + Math.pow(lat - ulat, 2)) < 0.3;
    });
    if (!tooClose) {
      result.push(article);
      used.push([lng, lat]);
    }
  }
  return result;
}

// Create a GeoJSON circle polygon
function makeCircle(lng: number, lat: number, radiusKm: number): number[][] {
  const points = 64;
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i * 360) / points;
    const rad = (angle * Math.PI) / 180;
    const dlng = (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(rad);
    const dlat = (radiusKm / 110.574) * Math.sin(rad);
    coords.push([lng + dlng, lat + dlat]);
  }
  return coords;
}
const VESSELS_SOURCE = "vessels";
const VESSELS_LAYER = "vessel-circles";

const BALTIC_ISO: Record<string, string> = {
  "233": "EE",
  "428": "LV",
  "440": "LT",
};

const COUNTRY_COLORS: Record<string, string> = {
  EE: "#4a90d9",
  LV: "#c0392b",
  LT: "#c9a227",
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
  const vesselsRef = useRef<Vessel[]>([]);
  const activeMarkerRef = useRef<any>(null);

  vesselsRef.current = vessels;

  const updateThreatZones = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    const threatArticles = articles.filter(isThreatArticle);

    // Remove old zones
    try {
      for (let i = 0; i < 20; i++) {
        if (map.getLayer(`threat-label-${i}`)) map.removeLayer(`threat-label-${i}`);
        if (map.getSource(`threat-label-src-${i}`)) map.removeSource(`threat-label-src-${i}`);
        if (map.getLayer(`threat-fill-${i}`)) map.removeLayer(`threat-fill-${i}`);
        if (map.getLayer(`threat-stroke-${i}`)) map.removeLayer(`threat-stroke-${i}`);
        if (map.getSource(`threat-${i}`)) map.removeSource(`threat-${i}`);
      }
    } catch(e) {}

    resetGeolocate();
    const dedupedThreats = deduplicateThreats(threatArticles);
    dedupedThreats.slice(0, 10).forEach((article, i) => {
      const [lng, lat] = geolocate(article.title, article.description, article.country);
      const { fill, stroke, fillOpacity, strokeOpacity, dash, label, labelColor } = getZoneStyle(article);
      const state = getZoneState(article);
      if (state === "resolved") return; // don't draw expired zones
      const hoursAgo = getAgeHours(article);
      const radius = hoursAgo < 1 ? 35 : 22;

      const circle = makeCircle(lng, lat, radius);
      const geojson = {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [circle] },
        properties: {},
      };

      const srcId = `threat-${i}`;
      try {
        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: "geojson", data: geojson as any });
        } else {
          (map.getSource(srcId) as any).setData(geojson);
        }

        // Solid fill
        if (!map.getLayer(`threat-fill-${i}`)) {
          map.addLayer({
            id: `threat-fill-${i}`,
            type: "fill",
            source: srcId,
            paint: {
              "fill-color": fill,
              "fill-opacity": fillOpacity,
            },
          });
        }

        // Border
        if (!map.getLayer(`threat-stroke-${i}`)) {
          map.addLayer({
            id: `threat-stroke-${i}`,
            type: "line",
            source: srcId,
            paint: {
              "line-color": stroke,
              "line-width": state === "active" ? 2 : 1.5,
              "line-opacity": strokeOpacity,
              "line-dasharray": dash ? [4, 4] : [1],
            },
          });
        }

        // Add label at centre of zone
        const labelSrcId = `threat-label-src-${i}`;
        const labelId = `threat-label-${i}`;
        const labelGeojson = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: { label, color: labelColor },
        };
        if (!map.getSource(labelSrcId)) {
          map.addSource(labelSrcId, { type: "geojson", data: labelGeojson as any });
        }
        if (!map.getLayer(labelId)) {
          map.addLayer({
            id: labelId,
            type: "symbol",
            source: labelSrcId,
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 11,
              "text-letter-spacing": 0.08,
              "text-anchor": "center",
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": ["get", "color"],
              "text-halo-color": "rgba(0,0,0,0.9)",
              "text-halo-width": 2.5,
              "text-opacity": label ? 1 : 0,
            },
          });
        }
      } catch(e) { console.error("Zone error:", e); }
    });
  }, [articles]);

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
              paint: { "fill-color": color, "fill-opacity": 0.03 } });
          }
          if (!map.getLayer(lineId)) {
            map.addLayer({ id: lineId, type: "line", source: sid,
              paint: {
                "line-color": color,
                "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 8, 2.5, 12, 3.5],
                "line-opacity": 0.5,
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

      // Vessel click
      map.on("click", VESSELS_LAYER, (e: any) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const vessel = vesselsRef.current.find(v => v.mmsi === props.mmsi);
        if (!vessel) return;
        // Show vessel popup
        const el = document.createElement("div");
        el.style.cssText = `
          position:fixed;
          background:#0d1117;
          border:1px solid rgba(34,211,238,0.3);
          border-radius:8px;
          padding:12px 14px;
          font-family:monospace;
          font-size:11px;
          color:#e2e8f0;
          z-index:1000;
          pointer-events:auto;
          box-shadow:0 8px 32px rgba(0,0,0,0.6);
          min-width:180px;
        `;
        el.innerHTML = `
          <div style="font-size:9px;color:#22d3ee;letter-spacing:0.1em;margin-bottom:6px">AIS · VESSEL</div>
          <div style="font-size:12px;font-weight:600;color:#fff;margin-bottom:8px">${vessel.name}</div>
          <div style="display:flex;flex-direction:column;gap:3px">
            <div style="display:flex;justify-content:space-between"><span style="color:#4b5563">MMSI</span><span>${vessel.mmsi}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:#4b5563">Speed</span><span>${vessel.sog.toFixed(1)} kn</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:#4b5563">Position</span><span>${vessel.lat.toFixed(3)}°N ${vessel.lng.toFixed(3)}°E</span></div>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">
            <a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${vessel.mmsi}" target="_blank"
              style="font-size:9px;color:#22d3ee;text-decoration:none;border:1px solid rgba(34,211,238,0.25);padding:3px 8px;border-radius:3px">
              MarineTraffic →
            </a>
          </div>
          <button onclick="this.parentElement.remove()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#4b5563;cursor:pointer;font-size:12px">✕</button>
        `;
        el.style.left = (e.originalEvent.clientX + 12) + "px";
        el.style.top  = (e.originalEvent.clientY - 10) + "px";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 8000);
      });

      map.on("mouseenter", VESSELS_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", VESSELS_LAYER, () => { map.getCanvas().style.cursor = ""; });

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

  // Fly to article location and show pulsing marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    // Remove old marker
    if (activeMarkerRef.current) {
      activeMarkerRef.current.remove();
      activeMarkerRef.current = null;
    }

    if (!activeArticle) return;

    const [lng, lat] = geolocate(activeArticle.title, activeArticle.description, activeArticle.country);

    // Fly to article location
    map.flyTo({ center: [lng, lat], zoom: 8, duration: 900 });

    // Create pulsing marker element
    import("@maptiler/sdk").then(({ Marker }) => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 20px;
        height: 20px;
        position: relative;
      `;

      const ring = document.createElement("div");
      ring.style.cssText = `
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        border: 2px solid white;
        opacity: 0.5;
        animation: ping 1.5s ease-out infinite;
      `;

      const dot = document.createElement("div");
      dot.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        border: 3px solid rgba(0,0,0,0.3);
        box-shadow: 0 0 12px rgba(255,255,255,0.6);
      `;

      // Add keyframe animation
      if (!document.getElementById("ping-style")) {
        const style = document.createElement("style");
        style.id = "ping-style";
        style.textContent = `@keyframes ping { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }`;
        document.head.appendChild(style);
      }

      el.appendChild(ring);
      el.appendChild(dot);

      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);

      activeMarkerRef.current = marker;
    });
  }, [activeArticle]);

  useEffect(() => { initMap(); }, [initMap]);
  useEffect(() => { updateVessels(); }, [updateVessels]);
  useEffect(() => { updateThreatZones(); }, [updateThreatZones]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
  );
}