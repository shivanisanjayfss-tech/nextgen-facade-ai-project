import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { KnowledgeArticle } from "@/types";

interface ArticleCardProps {
  article: KnowledgeArticle;
}

/** Knowledge base article preview card. */
export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link href={`/knowledge/${article.slug}`}>
      <Card hover className="h-full">
        <div className="flex items-center gap-2">
          <Badge variant="category">{article.category}</Badge>
          <span className="text-xs text-white/30">{article.readTimeMinutes} min read</span>
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">{article.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/45">{article.excerpt}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-white/30">
          <span>{article.author}</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
      </Card>
    </Link>
  );
}

interface ArticleListProps {
  articles: KnowledgeArticle[];
}

/** Grid of knowledge base articles. */
export function ArticleList({ articles }: ArticleListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
