"use client";

import { useState } from "react";
import type { Article, Category, Country } from "@/types";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { CAT_LABELS } from "@/lib/constants";

interface FeedProps {
  articles: Article[];
  activeArticleId: string | null;
  onSelect: (article: Article) => void;
}

const CATEGORIES: Category[] = ["MIL", "NATO", "CYBER", "POL", "ENERGY", "GEN"];
const COUNTRIES: Country[] = ["ALL", "EE", "LV", "LT"];
const COUNTRY_FULL: Record<string, string> = { ALL: "All", EE: "Estonia", LV: "Latvia", LT: "Lithuania" };

export default function Feed({ articles, activeArticleId, onSelect }: FeedProps) {
  const [filterCat, setFilterCat] = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");

  const filtered = articles.filter((a) => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border-accent)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em" }}>
            INCIDENT FEED
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
            {filtered.length} / {articles.length}
          </span>
        </div>

        {/* Country tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {COUNTRIES.map((c) => (
            <button key={c} onClick={() => setFilterCountry(c)} style={{
              flex: 1,
              fontFamily: "monospace",
              fontSize: 10,
              padding: "5px 4px",
              background: filterCountry === c ? "var(--bg-elevated)" : "transparent",
              border: "1px solid",
              borderColor: filterCountry === c ? "var(--border-accent)" : "var(--border)",
              borderRadius: 4,
              color: filterCountry === c ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.12s",
            }}>
              {c === "ALL" ? "ALL" : c}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={() => setFilterCat("ALL")} style={{
            fontFamily: "monospace", fontSize: 10,
            padding: "3px 8px",
            background: filterCat === "ALL" ? "var(--bg-elevated)" : "transparent",
            border: "1px solid var(--border)",
            borderRadius: 3,
            color: filterCat === "ALL" ? "var(--text-primary)" : "var(--text-muted)",
            cursor: "pointer",
          }}>ALL</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilterCat(c)} style={{
              fontFamily: "monospace", fontSize: 10,
              padding: "3px 8px",
              background: filterCat === c ? "var(--bg-elevated)" : "transparent",
              border: "1px solid var(--border)",
              borderRadius: 3,
              color: filterCat === c ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
            }}>{CAT_LABELS[c].toUpperCase().slice(0, 5)}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "32px 16px", fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            No events match filter
          </div>
        ) : filtered.slice(0, 50).map((article) => (
          <ArticleRow
            key={article.id + article.country}
            article={article}
            isActive={activeArticleId === article.id + article.country}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ArticleRow({ article, isActive, onSelect }: {
  article: Article;
  isActive: boolean;
  onSelect: (a: Article) => void;
}) {
  return (
    <div
      onClick={() => onSelect(article)}
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isActive ? "rgba(91,163,245,0.07)" : "transparent",
        borderLeft: isActive ? "3px solid var(--accent-blue)" : "3px solid transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        <CategoryBadge category={article.category} />
        <span style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
          padding: "1px 5px",
          borderRadius: 3,
        }}>{article.country}</span>
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        color: "var(--text-primary)",
        lineHeight: 1.45,
        marginBottom: 5,
      }}>
        {article.title}
      </div>
      <div style={{
        fontFamily: "monospace",
        fontSize: 11,
        color: "var(--text-muted)",
      }}>
        {article.source} · {article.ago}
      </div>
    </div>
  );
}