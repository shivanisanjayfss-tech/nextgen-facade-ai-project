import type { Metadata } from "next";
import { env } from "./env";

const SITE_NAME = "NextGen Facade AI";
const DEFAULT_DESCRIPTION =
  "AI-powered facade material intelligence platform. Search, compare, and explore ACP, glass, stone, HPL, and louvers.";

interface PageSeoOptions {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}

/** Generates consistent page metadata for SEO across all routes. */
export function createPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  noIndex = false,
}: PageSeoOptions): Metadata {
  const url = `${env.NEXT_PUBLIC_APP_URL}${path}`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export { SITE_NAME, DEFAULT_DESCRIPTION };
