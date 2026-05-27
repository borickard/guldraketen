export const CATEGORIES = [
  "Mat & dryck",
  "Handel & e-handel",
  "Mode & skönhet",
  "Hälsa & välmående",
  "Media & underhållning",
  "Bank & finans",
  "Teknik & IT",
  "Sport & fritid",
  "Resor & upplevelser",
  "Utbildning",
  "Fordon",
  "Offentlig sektor & ideellt",
  "Politik & intresseorganisationer",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/&/g, "och")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [slugifyCategory(c), c])
);

export function unslugifyCategory(slug: string): string | null {
  return SLUG_TO_CATEGORY[slug] ?? null;
}
