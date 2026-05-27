import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIES } from "@/lib/categories";

// Returns the subset of CATEGORIES that should be exposed publicly.
// Categories without a row in category_visibility default to visible.
export async function getVisibleCategoryNames(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("category_visibility")
    .select("name, is_visible");
  const hidden = new Set(
    (data ?? []).filter((r) => r.is_visible === false).map((r) => r.name)
  );
  return CATEGORIES.filter((c) => !hidden.has(c));
}
