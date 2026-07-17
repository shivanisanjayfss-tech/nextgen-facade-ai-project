import type { MaterialSummary } from "./material";

export interface SearchParams {
  q?: string;
  category?: string;
  manufacturer?: string;
  /** Prefer filtering by registry id when available. */
  manufacturerId?: string;
  /** Datasheet intelligence filters (Phase 4). */
  fireRating?: string;
  thickness?: string;
  finish?: string;
  thermalValue?: string;
  certification?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  items: MaterialSummary[];
  total: number;
  page: number;
  limit: number;
  query: string;
}
