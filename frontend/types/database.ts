/**
 * Supabase row shape for the `materials` table.
 * Column names use snake_case to match PostgreSQL conventions.
 */
export interface MaterialRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  manufacturer: string;
  manufacturer_id: string | null;
  description: string;
  specs: Record<string, unknown>;
  image_url: string | null;
  datasheet_url: string | null;
  source_url: string | null;
  is_active: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Supabase row shape for the `datasheets` table.
 */
export interface DatasheetRow {
  id: string;
  material_id: string;
  title: string;
  manufacturer: string;
  category: string;
  file_url: string;
  file_size: string | null;
  version: string | null;
  published_at: string;
  pages: number | null;
}

/**
 * Supabase row shape for the `knowledge_articles` table.
 */
export interface KnowledgeArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  read_time_minutes: number;
  published_at: string;
  tags: string[];
}

/** Typed Supabase table names used across services. */
export const DB_TABLES = {
  materials: "materials",
  datasheets: "datasheets",
  knowledgeArticles: "knowledge_articles",
  importHistory: "import_history",
  importSchedulerSettings: "import_scheduler_settings",
  importManufacturers: "import_manufacturers",
  manufacturers: "manufacturers",
  manufacturerAliases: "manufacturer_aliases",
  analyticsEvents: "analytics_events",
} as const;
