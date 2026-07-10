import type { MaterialSummary } from "./material";

export interface SearchParams {
  q?: string;
  category?: string;
  manufacturer?: string;
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
