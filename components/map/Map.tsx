/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Article, Vessel } from "@/types";
import { CAT_COLORS, geolocate } from "@/lib/constants";

interface MapProps {
  articles: Article[];
  vessels: Vessel[];
  activeArticle: Article | null;
  onArticleSelect: (article: Article) => void;
  onArticleHover: (article: Article | null, x: number, y: number) => void;
}

const CITIES = [
  { name: "Tallinn", lng: 24.745, lat: 59.437 },
  { name: "Rīga", lng: 24.105, lat: 56.946 },
  { name: "Vilnius", lng: 25.279, lat: 54.687 },
];

const BALTIC_IDS: Record<number, string> = { 233: "EE", 428: "LV", 440: "LT" };
const NEIGHBOUR_IDS = new Set([246, 616, 112, 643, 578, 208, 276, 703, 804]);
const BALTIC_COLORS: Record<string, string> = {
  EE: "#1a3d2e",
  LV: "#163526",
  LT: "#122d1f",
};

export default function Map({
  articles,
  vessels,
  activeArticle,
  onArticleSelect,
  onArticleHover,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef<{
    projection: any;
    gMarkers: any;
    gShips: any;
    d3: any;
    rotation: [number, number, number];
    isDragging: boolean;
    dragStart: [number, number] | null;
    rotStart: [number, number, number] | null;
    animFrame: number | null;
  }>({
    projection: null,
    gMarkers: null,
    gShips: null,
    d3: null,
    rotation: [-25.0, -57.0, 0],
    isDragging: false,
    dragStart: null,
    rotStart: null,
    animFrame: null,
  });

  const redrawMarkers = useCallback(() => {
    const { gMarkers, projection, d3 } = stateRef.current;
    if (!gMarkers || !projection || !d3) return;

    gMarkers.selectAll("*").remove();

    articles.slice(0, 40).forEach((article: Article) => {
      const [lng, lat] = geolocate(article.title, article.description, article.country);
      
      // Check if point is on visible side of globe
      const coords = projection([lng, lat]);
      if (!coords) return;

      const color = CAT_COLORS[article.category] || "#64748b";
      const isActive =
        activeArticle?.id === article.id &&
        activeArticle?.country === article.country;

      const mg = gMarkers
        .append("g")
        .attr("transform", `translate(${coords[0]},${coords[1]})`)
        .style("cursor", "pointer");

      mg.append("circle")
        .attr("r", isActive ? 8 : 5)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", isActive ? 1.2 : 0.8)
        .attr("opacity", isActive ? 0.7 : 0.35)
        .attr("pointer-events", "none");

      mg.append("circle")
        .attr("r", isActive ? 4 : 3)
        .attr("fill", color)
        .attr("opacity", 0.95)
        .attr("pointer-events", "none");

      mg.append("circle")
        .attr("r", 10)
        .attr("fill", "transparent")
        .on("mouseover", (_e: any) => {
          mg.select("circle:nth-child(2)").attr("r", 5);
          onArticleHover(article, _e.clientX, _e.clientY);
        })
        .on("mouseout", () => {
          mg.select("circle:nth-child(2)").attr("r", isActive ? 4 : 3);
          onArticleHover(null, 0, 0);
        })
        .on("click", (e: any) => {
          e.stopPropagation();
          onArticleSelect(article);
        });
    });
  }, [articles, activeArticle, onArticleSelect, onArticleHover]);

  const initMap = useCallback(async () => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    if (!W || !H) return;

    const [d3mod, topomod] = await Promise.all([
      import("d3"),
      import("topojson-client"),
    ]);

    const d3 = d3mod;
    const topojson = topomod;
    stateRef.current.d3 = d3;

    const root = d3.select(svg).attr("width", W).attr("height", H);
    root.selectAll("*").remove();

    const scale = Math.min(W, H) * 1.1;
    const cx = W / 2;
    const cy = H / 2;

    // Globe projection — orthographic centered on Baltics
    const projection = d3.geoOrthographic()
      .scale(scale)
      .translate([cx, cy])
      .clipAngle(90)
      .rotate(stateRef.current.rotation);

    stateRef.current.projection = projection;

    const pathFn = d3.geoPath().projection(projection);

    // Sphere (ocean)
    const defs = root.append("defs");
    const gradient = defs.append("radialGradient")
      .attr("id", "ocean-gradient")
      .attr("cx", "40%").attr("cy", "35%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#0d1f35");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#060d14");

    // Outer glow
    const glowFilter = defs.append("filter").attr("id", "globe-glow");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "blur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Globe shadow
    root.append("circle")
      .attr("cx", cx + 6).attr("cy", cy + 6)
      .attr("r", scale)
      .attr("fill", "rgba(0,0,0,0.3)")
      .attr("filter", "url(#globe-glow)");

    // Ocean sphere
    root.append("path")
      .datum({ type: "Sphere" })
      .attr("fill", "url(#ocean-gradient)")
      .attr("stroke", "rgba(255,255,255,0.08)")
      .attr("stroke-width", 1)
      .attr("d", pathFn as any);

    // Graticule (grid lines)
    const graticule = d3.geoGraticule().step([10, 10]);
    root.append("path")
      .datum(graticule())
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.04)")
      .attr("stroke-width", 0.5)
      .attr("d", pathFn as any);

    const gMap     = root.append("g").attr("class", "g-map");
    const gCities  = root.append("g").attr("class", "g-cities");
    const gShips   = root.append("g").attr("class", "g-ships");
    const gMarkers = root.append("g").attr("class", "g-markers");

    stateRef.current.gMarkers = gMarkers;
    stateRef.current.gShips = gShips;

    // Load world data
    try {
      const world: any = await d3.json(
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
      );

      const countries: any = topojson.feature(world, world.objects.countries);
      const features: any[] = countries.features;

      const balticFeats = features.filter((f: any) => BALTIC_IDS[+f.id]);
      const neighbourFeats = features.filter((f: any) => NEIGHBOUR_IDS.has(+f.id));
      const otherFeats = features.filter((f: any) => !BALTIC_IDS[+f.id] && !NEIGHBOUR_IDS.has(+f.id));

      // All other land — very dark
      gMap.selectAll(".other")
        .data(otherFeats)
        .join("path")
        .attr("fill", "#0a1208")
        .attr("stroke", "none")
        .attr("d", pathFn as any);

      // Neighbours — slightly lighter
      gMap.selectAll(".nb")
        .data(neighbourFeats)
        .join("path")
        .attr("fill", "#0e1a10")
        .attr("stroke", "#1a2e1a")
        .attr("stroke-width", 0.4)
        .attr("d", pathFn as any);

      // Baltic countries — highlighted
      balticFeats.forEach((f: any) => {
        const code = BALTIC_IDS[+f.id];
        gMap.append("path")
          .datum(f)
          .attr("fill", BALTIC_COLORS[code] || "#163526")
          .attr("stroke", "#2d6e44")
          .attr("stroke-width", 0.8)
          .attr("d", pathFn as any);

        const c = pathFn.centroid(f);
        if (c && !c.some(isNaN)) {
          gMap.append("text")
            .attr("x", c[0]).attr("y", c[1])
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "rgba(180,255,210,0.25)")
            .attr("font-family", "monospace")
            .attr("font-size", 9)
            .attr("letter-spacing", "0.15em")
            .attr("pointer-events", "none")
            .text(code === "EE" ? "ESTONIA" : code === "LV" ? "LATVIA" : "LITHUANIA");
        }
      });

      // Borders
      gMap.append("path")
        .datum(topojson.mesh(world, world.objects.countries, (a: any, b: any) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,0.06)")
        .attr("stroke-width", 0.3)
        .attr("d", pathFn as any);

      // City dots
      CITIES.forEach((city) => {
        const pos = projection([city.lng, city.lat]);
        if (!pos || pos.some(isNaN)) return;
        gCities.append("circle")
          .attr("cx", pos[0]).attr("cy", pos[1]).attr("r", 2.5)
          .attr("fill", "rgba(220,240,220,0.6)")
          .attr("pointer-events", "none");
        gCities.append("text")
          .attr("x", pos[0] + 5)
          .attr("y", city.name === "Rīga" ? pos[1] - 4 : pos[1] + 3)
          .attr("fill", "rgba(220,240,220,0.45)")
          .attr("font-family", "monospace")
          .attr("font-size", 9)
          .attr("pointer-events", "none")
          .text(city.name);
      });

    } catch (e) {
      console.error("Map load failed:", e);
    }

    // Drag to rotate
    const dragBehavior = d3.drag<SVGSVGElement, unknown>()
      .on("start", (event: any) => {
        stateRef.current.isDragging = true;
        stateRef.current.dragStart = [event.x, event.y];
        stateRef.current.rotStart = [...stateRef.current.rotation] as [number, number, number];
      })
      .on("drag", (event: any) => {
        if (!stateRef.current.dragStart || !stateRef.current.rotStart) return;
        const dx = event.x - stateRef.current.dragStart[0];
        const dy = event.y - stateRef.current.dragStart[1];
        const sensitivity = 0.25;
        stateRef.current.rotation = [
          stateRef.current.rotStart[0] + dx * sensitivity,
          stateRef.current.rotStart[1] - dy * sensitivity,
          0,
        ];
        projection.rotate(stateRef.current.rotation);
        redrawAll();
      })
      .on("end", () => {
        stateRef.current.isDragging = false;
      });

    root.call(dragBehavior as any).style("cursor", "grab");

    // Scroll to zoom
    root.on("wheel", (event: any) => {
      event.preventDefault();
      const currentScale = projection.scale();
      const newScale = Math.max(200, Math.min(3000, currentScale - event.deltaY * 2));
      projection.scale(newScale);
      redrawAll();
    });

    function redrawAll() {
      root.select("path[fill='url(#ocean-gradient)']").attr("d", pathFn as any);
      root.selectAll(".g-map path").attr("d", pathFn as any);
      root.selectAll(".g-map text").each(function(this: any, d: any) {
        if (d) {
          const c = pathFn.centroid(d);
          if (c && !c.some(isNaN)) {
            d3.select(this).attr("x", c[0]).attr("y", c[1]);
          }
        }
      });

      // Redraw graticule
      root.select("path[fill='none'][stroke='rgba(255,255,255,0.04)']").attr("d", pathFn as any);

      // Redraw cities
      gCities.selectAll("*").remove();
      CITIES.forEach((city) => {
        const pos = projection([city.lng, city.lat]);
        if (!pos || pos.some(isNaN)) return;
        gCities.append("circle")
          .attr("cx", pos[0]).attr("cy", pos[1]).attr("r", 2.5)
          .attr("fill", "rgba(220,240,220,0.6)")
          .attr("pointer-events", "none");
        gCities.append("text")
          .attr("x", pos[0] + 5)
          .attr("y", city.name === "Rīga" ? pos[1] - 4 : pos[1] + 3)
          .attr("fill", "rgba(220,240,220,0.45)")
          .attr("font-family", "monospace")
          .attr("font-size", 9)
          .attr("pointer-events", "none")
          .text(city.name);
      });

      redrawMarkers();
    }

    stateRef.current.projection = projection;
    redrawMarkers();

  }, [redrawMarkers]);

  useEffect(() => { redrawMarkers(); }, [redrawMarkers]);

  useEffect(() => {
    const { gShips, projection, d3 } = stateRef.current;
    if (!gShips || !projection || !d3) return;
    vessels.forEach((vessel: Vessel) => {
      const pos = projection([vessel.lng, vessel.lat]);
      if (!pos || pos.some(isNaN)) return;
      const id = `v-${vessel.mmsi}`;
      gShips.select(`#${id}`).remove();
      gShips.append("g")
        .attr("id", id)
        .attr("transform", `translate(${pos[0]},${pos[1]})`)
        .attr("opacity", 0.85)
        .append("circle")
        .attr("r", 2)
        .attr("fill", "#22d3ee");
    });
  }, [vessels]);

  useEffect(() => {
    initMap();
    window.addEventListener("resize", initMap);
    return () => window.removeEventListener("resize", initMap);
  }, [initMap]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#050810" }}>
      <svg
        ref={svgRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
      />
    </div>
  );
}