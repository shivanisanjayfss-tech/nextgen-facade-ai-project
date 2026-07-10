import type { MaterialCategory } from "./material";

export interface Datasheet {
  id: string;
  materialId: string;
  title: string;
  manufacturer: string;
  category: MaterialCategory;
  fileUrl: string;
  fileSize?: string;
  version?: string;
  publishedAt: string;
  pages?: number;
}
