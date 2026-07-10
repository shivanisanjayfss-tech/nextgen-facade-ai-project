import { env, isApifyConfigured } from "@/lib/env";

interface ApifyRunOptions {
  actorId: string;
  input: Record<string, unknown>;
}

/** Triggers an Apify actor run for web scraping material catalog data. */
export async function runApifyActor({ actorId, input }: ApifyRunOptions) {
  if (!isApifyConfigured()) {
    throw new Error("Apify is not configured. Set APIFY_API_TOKEN.");
  }

  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${env.APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(`Apify run failed: ${response.statusText}`);
  }

  return response.json();
}

/** Fetches results from a completed Apify dataset. */
export async function getApifyDatasetItems(datasetId: string) {
  if (!isApifyConfigured()) {
    throw new Error("Apify is not configured. Set APIFY_API_TOKEN.");
  }

  const response = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${env.APIFY_API_TOKEN}`,
  );

  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed: ${response.statusText}`);
  }

  return response.json();
}
