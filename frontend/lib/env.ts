import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  APIFY_API_TOKEN: z.string().min(1).optional(),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/** Treat blank env values as unset so optional Zod fields do not fail the whole parse. */
function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    OPENAI_API_KEY: emptyToUndefined(process.env.OPENAI_API_KEY),
    APIFY_API_TOKEN: emptyToUndefined(process.env.APIFY_API_TOKEN),
    N8N_WEBHOOK_URL: emptyToUndefined(process.env.N8N_WEBHOOK_URL),
    NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env.NEXT_PUBLIC_APP_URL),
  });

  if (!parsed.success) {
    console.warn("[env] Invalid environment variables:", parsed.error.flatten().fieldErrors);
    return envSchema.parse({});
  }

  return parsed.data;
}

export const env = parseEnv();

export function isSupabaseConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isOpenAIConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

export function isApifyConfigured(): boolean {
  return Boolean(env.APIFY_API_TOKEN);
}

export function isN8nConfigured(): boolean {
  return Boolean(env.N8N_WEBHOOK_URL);
}
