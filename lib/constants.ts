import type { Category } from "@/types";

export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ||
  "https://wispy-rice-f55d.vporins.workers.dev/feed";

export const AIS_KEY =
  process.env.NEXT_PUBLIC_AIS_KEY || "";

export const CAT_COLORS: Record<Category, string> = {
  MIL: "#ef4444",
  NATO: "#3b82f6",
  CYBER: "#f59e0b",
  POL: "#8b5cf6",
  ENERGY: "#10b981",
  GEN: "#64748b",
};

export const CAT_LABELS: Record<Category, string> = {
  MIL: "Military",
  NATO: "NATO",
  CYBER: "Cyber",
  POL: "Political",
  ENERGY: "Energy",
  GEN: "General",
};

export const COUNTRY_LABELS: Record<string, string> = {
  EE: "Estonia",
  LV: "Latvia",
  LT: "Lithuania",
  ALL: "All",
};

export const LOCATIONS = [
  // Estonia
  { names: ["tallinn", "kadriorg", "riigikogu", "toompea"], lng: 24.745, lat: 59.437, country: "EE" },
  { names: ["tartu"], lng: 26.722, lat: 58.378, country: "EE" },
  { names: ["narva"], lng: 28.192, lat: 59.377, country: "EE" },
  { names: ["pärnu", "parnu"], lng: 24.5, lat: 58.385, country: "EE" },
  { names: ["saaremaa", "kuressaare"], lng: 22.483, lat: 58.248, country: "EE" },
  { names: ["kuusalu"], lng: 25.45, lat: 59.45, country: "EE" },
  { names: ["peipus", "peipsi"], lng: 27.5, lat: 58.7, country: "EE" },
  { names: ["rakvere"], lng: 26.355, lat: 59.346, country: "EE" },
  { names: ["haapsalu"], lng: 23.543, lat: 58.943, country: "EE" },
  // Latvia
  { names: ["riga", "rīga", "saeima"], lng: 24.105, lat: 56.946, country: "LV" },
  { names: ["daugavpils"], lng: 26.536, lat: 55.874, country: "LV" },
  { names: ["liepāja", "liepaja"], lng: 21.011, lat: 56.505, country: "LV" },
  { names: ["jūrmala", "jurmala"], lng: 23.771, lat: 56.968, country: "LV" },
  { names: ["ventspils"], lng: 21.564, lat: 57.394, country: "LV" },
  { names: ["rēzekne", "rezekne"], lng: 27.333, lat: 56.51, country: "LV" },
  { names: ["valmiera"], lng: 25.418, lat: 57.541, country: "LV" },
  { names: ["sigulda"], lng: 24.855, lat: 57.153, country: "LV" },
  { names: ["ādaži", "adazi"], lng: 24.364, lat: 57.073, country: "LV" },
  { names: ["jelgava"], lng: 23.709, lat: 56.652, country: "LV" },
  { names: ["ludza"], lng: 27.716, lat: 56.544, country: "LV" },
  { names: ["balvi"], lng: 27.266, lat: 57.131, country: "LV" },
  { names: ["alūksne", "aluksne"], lng: 27.052, lat: 57.421, country: "LV" },
  { names: ["bauska"], lng: 24.193, lat: 56.408, country: "LV" },
  { names: ["tukums"], lng: 23.153, lat: 56.967, country: "LV" },
  { names: ["cēsis", "cesis"], lng: 25.272, lat: 57.312, country: "LV" },
  // Lithuania
  { names: ["vilnius", "seimas"], lng: 25.279, lat: 54.687, country: "LT" },
  { names: ["kaunas"], lng: 23.903, lat: 54.898, country: "LT" },
  { names: ["klaipėda", "klaipeda"], lng: 21.144, lat: 55.703, country: "LT" },
  { names: ["šiauliai", "siauliai"], lng: 23.313, lat: 55.934, country: "LT" },
  { names: ["panevėžys", "panevezys"], lng: 24.361, lat: 55.734, country: "LT" },
  { names: ["alytus"], lng: 24.046, lat: 54.396, country: "LT" },
  { names: ["marijampolė", "marijampole"], lng: 23.354, lat: 54.559, country: "LT" },
  { names: ["suwalki", "suwałki"], lng: 22.93, lat: 54.1, country: "LT" },
  { names: ["kaliningrad"], lng: 20.507, lat: 54.71, country: "LT" },
];

export const COUNTRY_CENTRES: Record<string, [number, number]> = {
  EE: [25.2, 58.7],
  LV: [25.3, 56.8],
  LT: [23.8, 55.5],
};

export function geolocate(
  title: string,
  description: string,
  country: string
): [number, number] {
  const text = (title + " " + description).toLowerCase();

  // Try to match a specific named location
  for (const loc of LOCATIONS) {
    if (loc.names.some((n) => text.includes(n))) {
      // Small jitter so overlapping articles don't stack exactly
      return [
        loc.lng + (Math.random() - 0.5) * 0.2,
        loc.lat + (Math.random() - 0.5) * 0.15,
      ];
    }
  }

  // Fallback — spread across country with larger jitter
  const base = COUNTRY_CENTRES[country] || [24.5, 57.0];
  return [
    base[0] + (Math.random() - 0.5) * 2.0,
    base[1] + (Math.random() - 0.5) * 1.4,
  ];
}