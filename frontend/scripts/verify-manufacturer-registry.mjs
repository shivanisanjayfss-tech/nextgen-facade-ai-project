import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    }),
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const mfg = await sb.from("manufacturers").select("id", { count: "exact", head: true });
const aliases = await sb
  .from("manufacturer_aliases")
  .select("id", { count: "exact", head: true });
const linked = await sb
  .from("materials")
  .select("id", { count: "exact", head: true })
  .not("manufacturer_id", "is", null);
const unmatched = await sb
  .from("materials")
  .select("id", { count: "exact", head: true })
  .is("manufacturer_id", null);
const withP = await sb
  .from("manufacturers")
  .select("id", { count: "exact", head: true })
  .gt("total_products", 0);
const withoutP = await sb
  .from("manufacturers")
  .select("id", { count: "exact", head: true })
  .eq("total_products", 0);

const { data: registry, error: regErr } = await sb
  .from("manufacturers")
  .select("id,name,category,total_products")
  .order("name");
if (regErr) throw regErr;

const { data: products, error: prodErr } = await sb
  .from("materials")
  .select("id,manufacturer,manufacturer_id,category");
if (prodErr) throw prodErr;

const byId = new Map();
for (const p of products ?? []) {
  if (!p.manufacturer_id) continue;
  byId.set(p.manufacturer_id, (byId.get(p.manufacturer_id) || 0) + 1);
}

const publicVisible = (registry ?? []).filter((r) => (byId.get(r.id) || 0) > 0);
const zeroHidden = (registry ?? []).filter((r) => (byId.get(r.id) || 0) === 0);

// Distinct text manufacturers (old approach) for comparison
const distinctText = new Set((products ?? []).map((p) => p.manufacturer.trim().toLowerCase()));

console.log(
  JSON.stringify(
    {
      manufacturers_seeded: mfg.count,
      aliases_seeded: aliases.count,
      materials_linked: linked.count,
      materials_unmatched: unmatched.count,
      manufacturers_with_products: withP.count,
      manufacturers_without_products: withoutP.count,
      materials_page: {
        source: "manufacturers registry via /api/manufacturers + groupMaterialsWithRegistry",
        visible_with_products: publicVisible.length,
        hidden_zero_product: zeroHidden.length,
        old_distinct_manufacturer_text_count: distinctText.size,
        sample_visible: publicVisible.slice(0, 8).map((r) => ({
          name: r.name,
          join_count: byId.get(r.id) || 0,
          total_products_col: r.total_products,
        })),
      },
    },
    null,
    2,
  ),
);
