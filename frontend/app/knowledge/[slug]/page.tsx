import { notFound } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createPageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { getKnowledgeArticleBySlug } from "@/services/knowledge.service";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getKnowledgeArticleBySlug(slug);

  if (!article) return createPageMetadata({ title: "Article Not Found", noIndex: true });

  return createPageMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/knowledge/${article.slug}`,
  });
}

export default async function KnowledgeArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getKnowledgeArticleBySlug(slug);

  if (!article) notFound();

  return (
    <AppLayout>
      <PageContainer size="md">
        <Link href="/knowledge">
          <Button variant="ghost" size="sm" className="mb-6">
            ← Back to Knowledge Base
          </Button>
        </Link>
        <Badge variant="category">{article.category}</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {article.title}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-sm text-white/40">
          <span>{article.author}</span>
          <span>{formatDate(article.publishedAt)}</span>
          <span>{article.readTimeMinutes} min read</span>
        </div>
        <div className="prose prose-invert mt-8 max-w-none">
          <p className="text-base leading-relaxed text-white/70">{article.content}</p>
        </div>
        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="tag">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
