"use client";

import { useState } from "react";
import type { Article, Category, Country } from "@/types";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { COUNTRY_LABELS, CAT_LABELS } from "@/lib/constants";

interface FeedProps {
  articles: Article[];
  activeArticleId: string | null;
  onSelect: (article: Article) => void;
}

const CATEGORIES: Category[] = ["MIL", "NATO", "CYBER", "POL", "ENERGY", "GEN"];
const COUNTRIES: Country[] = ["ALL", "EE", "LV", "LT"];

export default function Feed({ articles, activeArticleId, onSelect }: FeedProps) {
  const [filterCat, setFilterCat] = useState<Category | "ALL">("ALL");
  const [filterCountry, setFilterCountry] = useState<Country>("ALL");

  const filtered = articles.filter((a) => {
    if (filterCat !== "ALL" && a.category !== filterCat) return false;
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px 8px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
            }}
          >
            INCIDENT FEED
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              color: "var(--text-muted)",
            }}
          >
            {filtered.length}/{articles.length}
          </span>
        </div>

        {/* Country tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
          {COUNTRIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCountry(c)}
              style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: 9,
                padding: "4px 2px",
                background: filterCountry === c ? "var(--bg-elevated)" : "transparent",
                border: "1px solid",
                borderColor: filterCountry === c ? "var(--border-accent)" : "transparent",
                borderRadius: 3,
                color: filterCountry === c ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
                letterSpacing: "0.05em",
                transition: "all 0.1s",
              }}
            >
              {c === "ALL" ? "ALL" : c}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilterCat("ALL")}
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              padding: "2px 6px",
              background: filterCat === "ALL" ? "var(--bg-elevated)" : "transparent",
              border: "1px solid var(--border)",
              borderRadius: 3,
              color: filterCat === "ALL" ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            ALL
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                padding: "2px 6px",
                background: filterCat === c ? "var(--bg-elevated)" : "transparent",
                border: "1px solid var(--border)",
                borderRadius: 3,
                color: filterCat === c ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {CAT_LABELS[c].toUpperCase().slice(0, 5)}
            </button>
          ))}
        </div>
      </div>

      {/* Articles list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 0",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No events match filter
          </div>
        ) : (
          filtered.slice(0, 40).map((article) => (
            <ArticleRow
              key={article.id + article.country}
              article={article}
              isActive={activeArticleId === article.id + article.country}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ArticleRow({
  article,
  isActive,
  onSelect,
}: {
  article: Article;
  isActive: boolean;
  onSelect: (a: Article) => void;
}) {
  return (
    <div
      onClick={() => onSelect(article)}
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isActive ? "rgba(59,130,246,0.06)" : "transparent",
        borderLeft: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tertiary)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", gap: 5, marginBottom: 4, alignItems: "center" }}>
        <CategoryBadge category={article.category} />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            padding: "1px 4px",
            borderRadius: 3,
          }}
        >
          {article.country}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-primary)",
          lineHeight: 1.4,
          marginBottom: 3,
        }}
      >
        {article.title}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "var(--text-muted)",
        }}
      >
        {article.source} · {article.ago}
      </div>
    </div>
  );
}