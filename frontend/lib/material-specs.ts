/** Normalizes specs JSON from Supabase into a plain object. */
export function parseMaterialSpecs(specs: unknown): Record<string, unknown> {
  if (specs === null || specs === undefined) return {};

  if (typeof specs === "string") {
    const trimmed = specs.trim();
    if (!trimmed) return {};

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }

    return {};
  }

  if (typeof specs === "object" && !Array.isArray(specs)) {
    return specs as Record<string, unknown>;
  }

  return {};
}
