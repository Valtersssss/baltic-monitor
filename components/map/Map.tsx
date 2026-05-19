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
const NEIGHBOUR_IDS = new Set([246, 616, 112, 643, 578]);
const BALTIC_COLORS: Record<string, string> = {
  EE: "#0d2018",
  LV: "#0a1a14",
  LT: "#081510",
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
  }>({ projection: null, gMarkers: null, gShips: null, d3: null });

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

    root.append("rect").attr("width", W).attr("height", H).attr("fill", "#080c10");

    const projection = d3.geoMercator()
      .center([25.0, 57.0])
      .scale(Math.min(W, H) * 4.2)
      .translate([W / 2, H / 2]);

    stateRef.current.projection = projection;

    const pathFn = d3.geoPath().projection(projection);

    const gMap     = root.append("g");
    const gCities  = root.append("g");
    const gShips   = root.append("g");
    const gMarkers = root.append("g");

    stateRef.current.gMarkers = gMarkers;
    stateRef.current.gShips   = gShips;

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 16])
      .on("zoom", (event: any) => {
        gMap.attr("transform", event.transform);
        gCities.attr("transform", event.transform);
        gShips.attr("transform", event.transform);
        gMarkers.attr("transform", event.transform);
      });

    root.call(zoom as any);

    try {
      const world: any = await d3.json(
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
      );

      const countries: any = topojson.feature(world, world.objects.countries);
      const features: any[] = countries.features;

      // Neighbours
      gMap.selectAll(".nb")
        .data(features.filter((f: any) => NEIGHBOUR_IDS.has(+f.id)))
        .join("path")
        .attr("fill", "#07100a")
        .attr("stroke", "#0c1f0f")
        .attr("stroke-width", 0.3)
        .attr("d", pathFn as any);

      // Baltic countries
      features.filter((f: any) => BALTIC_IDS[+f.id]).forEach((f: any) => {
        const code = BALTIC_IDS[+f.id];
        gMap.append("path")
          .datum(f)
          .attr("fill", BALTIC_COLORS[code] || "#0a1a14")
          .attr("stroke", "#1e4a30")
          .attr("stroke-width", 0.8)
          .attr("d", pathFn as any)
          .style("cursor", "pointer");

        const c = pathFn.centroid(f);
        if (c && !c.some(isNaN)) {
          gMap.append("text")
            .attr("x", c[0]).attr("y", c[1])
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "rgba(0,255,140,0.15)")
            .attr("font-family", "monospace")
            .attr("font-size", 10)
            .attr("letter-spacing", "0.15em")
            .attr("pointer-events", "none")
            .text(code === "EE" ? "ESTONIA" : code === "LV" ? "LATVIA" : "LITHUANIA");
        }
      });

      // Border mesh
      gMap.append("path")
        .datum(topojson.mesh(world, world.objects.countries, (a: any, b: any) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "rgba(30,74,48,0.2)")
        .attr("stroke-width", 0.4)
        .attr("d", pathFn as any);

      // Baltic Sea label
      const seaPos = projection([19.5, 57.5]);
      if (seaPos) {
        gMap.append("text")
          .attr("x", seaPos[0]).attr("y", seaPos[1])
          .attr("text-anchor", "middle")
          .attr("fill", "rgba(80,140,180,0.25)")
          .attr("font-family", "monospace")
          .attr("font-size", 9)
          .attr("letter-spacing", "0.12em")
          .attr("font-style", "italic")
          .attr("pointer-events", "none")
          .text("BALTIC SEA");
      }

      // City dots
      CITIES.forEach((city) => {
        const pos = projection([city.lng, city.lat]);
        if (!pos || pos.some(isNaN)) return;
        gCities.append("circle")
          .attr("cx", pos[0]).attr("cy", pos[1]).attr("r", 2)
          .attr("fill", "rgba(200,220,200,0.45)")
          .attr("pointer-events", "none");
        gCities.append("text")
          .attr("x", pos[0] + 4)
          .attr("y", city.name === "Rīga" ? pos[1] - 4 : pos[1] + 3)
          .attr("fill", "rgba(200,220,200,0.3)")
          .attr("font-family", "monospace")
          .attr("font-size", 8)
          .attr("pointer-events", "none")
          .text(city.name);
      });
    } catch (e) {
      console.error("Map load failed:", e);
    }
  }, []);

  // Redraw markers
  useEffect(() => {
    const { gMarkers, projection, d3 } = stateRef.current;
    if (!gMarkers || !projection || !d3) return;

    gMarkers.selectAll("*").remove();

    articles.slice(0, 40).forEach((article: Article) => {
      const [lng, lat] = geolocate(article.title, article.description, article.country);
      const pos = projection([lng, lat]);
      if (!pos || pos.some(isNaN)) return;

      const color = CAT_COLORS[article.category] || "#64748b";
      const isActive =
        activeArticle?.id === article.id &&
        activeArticle?.country === article.country;

      const mg = gMarkers.append("g")
        .attr("transform", `translate(${pos[0]},${pos[1]})`)
        .style("cursor", "pointer");

      // Outer ring
      mg.append("circle")
        .attr("r", isActive ? 8 : 6)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", isActive ? 1 : 0.75)
        .attr("opacity", isActive ? 0.65 : 0.3)
        .attr("pointer-events", "none");

      // Core dot
      mg.append("circle")
        .attr("r", isActive ? 4 : 3)
        .attr("fill", color)
        .attr("opacity", 1)
        .attr("pointer-events", "none");

      // Transparent hit zone
      mg.append("circle")
        .attr("r", 10)
        .attr("fill", "transparent")
        .on("mouseover", (_event: any, ) => {
          mg.select("circle:nth-child(2)").attr("r", 5);
          onArticleHover(article, _event.clientX, _event.clientY);
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

  // Redraw vessels
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
        .attr("opacity", 0.8)
        .append("circle")
        .attr("r", 2)
        .attr("fill", "#22d3ee");
    });
  }, [vessels]);

  // Mount
  useEffect(() => {
    initMap();
    window.addEventListener("resize", initMap);
    return () => window.removeEventListener("resize", initMap);
  }, [initMap]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#080c10" }}
    >
      <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}