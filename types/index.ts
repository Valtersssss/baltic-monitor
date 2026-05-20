export type Category = "MIL" | "NATO" | "CYBER" | "POL" | "ENERGY" | "GEN";
export type Country = "EE" | "LV" | "LT" | "ALL";

export interface Article {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  country: Country;
  category: Category;
  threatContribution: number;
  ago: string;
  image?: string;
}

export interface FeedData {
  ts: number;
  count: number;
  byCountry: Record<string, number>;
  threatIndex: Record<string, number>;
  articles: Article[];
}

export interface Vessel {
  mmsi: number;
  name: string;
  lat: number;
  lng: number;
  sog: number;
  type: number;
  ts: number;
}