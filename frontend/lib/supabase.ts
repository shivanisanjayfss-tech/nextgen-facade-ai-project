import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Unified Supabase client module.
 *
 * - `createBrowserClient()` — for Client Components and hooks (browser-only)
 * - `createServerClient()` — for API routes and Server Components (returns null if unconfigured)
 * - `getSupabaseServer()` — singleton server client to reuse across a request lifecycle
 */

let serverInstance: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  return env.NEXT_PUBLIC_SUPABASE_URL!;
}

function getSupabaseAnonKey(): string {
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

/** Creates a Supabase client for browser/client-side usage. Throws if env is missing. */
export function createBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/** Creates a fresh Supabase client for server-side usage. Returns null when env is not set. */
export function createServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Returns a cached server Supabase client (one instance per process). */
export function getSupabaseServer(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  if (!serverInstance) {
    serverInstance = createServerClient();
  }

  return serverInstance;
}

export { isSupabaseConfigured };
