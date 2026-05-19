"use client";

import type { Article } from "@/types";
import { CAT_COLORS, CAT_LABELS } from "@/lib/constants";

interface ArticlePopupProps {
  article: Article;
  x: number;
  y: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export default function ArticlePopup({
  article,
  x,
  y,
  containerRef,
  onClose,
}: ArticlePopupProps) {
  const color = CAT_COLORS[article.category];

  const containerRect = containerRef.current?.getBoundingClientRect();
  if (!containerRect) return null;

  let left = x - containerRect.left + 14;
  let top = y - containerRect.top - 10;
  if (left + 290 > containerRect.width) left = x - containerRect.left - 294;
  if (top + 160 > containerRect.height) top = y - containerRect.top - 160;

  return (
    <div
      style={{
        position: "absolute",
        left: Math.max(8, left),
        top: Math.max(8, top),
        width: 280,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-accent)",
        borderRadius: 6,
        padding: "12px 14px",
        zIndex: 200,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        pointerEvents: "auto",
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 8,
          right: 10,
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          padding: "2px 4px",
        }}
      >
        ✕
      </button>

      {/* Category */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color,
          letterSpacing: "0.1em",
          marginBottom: 6,
        }}
      >
        [{CAT_LABELS[article.category]}] {article.source} · {article.country}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-primary)",
          lineHeight: 1.4,
          marginBottom: 6,
          paddingRight: 16,
        }}
      >
        {article.title}
      </div>

      {/* Description */}
      {article.description && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.55,
            marginBottom: 10,
          }}
        >
          {article.description.slice(0, 160)}
          {article.description.length > 160 ? "…" : ""}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "var(--text-muted)",
          }}
        >
          {article.ago}
        </span>
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "var(--accent-blue)",
            textDecoration: "none",
            border: "1px solid rgba(59,130,246,0.3)",
            padding: "3px 8px",
            borderRadius: 3,
          }}
        >
          READ →
        </a>
      </div>
    </div>
  );
}