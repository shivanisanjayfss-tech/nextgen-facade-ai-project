export type KnowledgeCategory =
  | "Best Practices"
  | "Case Study"
  | "Technical Guide"
  | "Regulations"
  | "Design";

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: KnowledgeCategory;
  author: string;
  readTimeMinutes: number;
  publishedAt: string;
  tags: string[];
}
