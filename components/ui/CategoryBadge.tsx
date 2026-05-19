import type { Category } from "@/types";
import { CAT_COLORS, CAT_LABELS } from "@/lib/constants";

interface CategoryBadgeProps {
  category: Category;
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  const color = CAT_COLORS[category];
  return (
    <span style={{
      fontFamily: "monospace",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 3,
      color,
      border: `1px solid ${color}50`,
      background: `${color}18`,
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
    }}>
      {CAT_LABELS[category].toUpperCase()}
    </span>
  );
}