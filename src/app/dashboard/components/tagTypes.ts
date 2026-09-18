export interface Tag {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

// Built-in tag types, always offered. Users can add custom types on top.
export const DEFAULT_TAG_TYPES = ["Kampanj", "Format", "Tema"];

// Default chip colors cycled through when a tag is created without one.
export const TAG_COLORS = [
  "#C8962A", // gold
  "#3E7CB1", // blue
  "#5B8C5A", // green
  "#B0538A", // pink
  "#8A6FB0", // purple
  "#C0653A", // rust
  "#4F9D9D", // teal
  "#9C8B3A", // olive
];

// Readable text color (dark/light) for a given chip background.
export function chipTextColor(hex: string | null): string {
  if (!hex) return "#1C1B19";
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1C1B19";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1C1B19" : "#F7F4EF";
}
