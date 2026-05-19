import type { Category } from "@/types";
import { CAT_COLORS, CAT_LABELS } from "@/lib/constants";

interface CategoryBadgeProps {
  category: Category;
  size?: "sm" | "md";
}

export default function CategoryBadge({ category, size = "sm" }: CategoryBadgeProps) {
  const color = CAT_COLORS[category];
  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: size === "sm" ? 9 : 11,
        padding: size === "sm" ? "1px 5px" : "2px 7px",
        borderRadius: 3,
        color,
        border: `1px solid ${color}40`,
        background: `${color}12`,
        letterSpacing: "0.05em",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {CAT_LABELS[category]}
    </span>
  );
}