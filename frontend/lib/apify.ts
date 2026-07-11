import { ServiceError } from "@/lib/errors";
import { env, isApifyConfigured } from "@/lib/env";
import type { ApifyRunStatus } from "@/types/import";

const APIFY_API_BASE = "https://api.apify.com/v2";
const APIFY_REQUEST_TIMEOUT_MS = 10_000;

export interface ApifyActorRun {
  id: string;
  actId: string;
  status: ApifyRunStatus;
  startedAt: string;
  finishedAt?: string;
  defaultDatasetId: string;
  statusMessage?: string;
}

interface ApifyPaginatedDataset<T> {
  items: T[];
}

function requireApifyToken(): string {
  if (!isApifyConfigured()) {
    throw new ServiceError(
      "APIFY_API_TOKEN is not configured. Add it to .env.local and restart the dev server.",
      "MISSING_API_KEY",
      503,
    );
  }

  return env.APIFY_API_TOKEN!;
}

function mapApifyError(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new ServiceError(
      "Invalid Apify API token. Check APIFY_API_TOKEN in .env.local.",
      "INVALID_API_KEY",
      401,
    );
  }

  if (status === 429) {
    throw new ServiceError(
      "Apify rate limit exceeded. Try again shortly.",
      "RATE_LIMIT",
      429,
    );
  }

  throw new ServiceError(
    `Apify API request failed (${status}): ${body || "Unknown error"}`,
    "APIFY_ERROR",
    status >= 400 && status < 600 ? status : 502,
  );
}

/** Low-level authenticated request helper for Apify REST API v2. */
export async function apifyRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = APIFY_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const token = requireApifyToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(`${APIFY_API_BASE}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      mapApifyError(response.status, body);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new ServiceError(
        `Apify API request timed out after ${timeoutMs}ms.`,
        "APIFY_TIMEOUT",
        504,
      );
    }

    throw error;
  }
}

/** Returns whether Apify credentials are available without throwing. */
export function getApifyClientStatus(): { configured: boolean } {
  return { configured: isApifyConfigured() };
}

export interface ApifyUserProfile {
  username: string;
  email?: string;
  plan?: string;
}

export interface ApifyActorInfo {
  id: string;
  name: string;
  username: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
}

export interface ApifyConnectionTestResult {
  connection: {
    configured: boolean;
    authenticated: boolean;
    username?: string;
    plan?: string;
  };
  actor: {
    configured: boolean;
    actor_id?: string;
    status: "not_configured" | "reachable" | "unreachable";
    name?: string;
    username?: string;
    is_public?: boolean;
  };
  errors: string[];
}

/** Verifies API token and optional Actor metadata without starting a scrape. */
export async function testApifyConnection(): Promise<ApifyConnectionTestResult> {
  const errors: string[] = [];
  const configured = isApifyConfigured();

  const result: ApifyConnectionTestResult = {
    connection: {
      configured,
      authenticated: false,
    },
    actor: {
      configured: Boolean(env.APIFY_MATERIALS_ACTOR_ID),
      actor_id: env.APIFY_MATERIALS_ACTOR_ID,
      status: env.APIFY_MATERIALS_ACTOR_ID ? "unreachable" : "not_configured",
    },
    errors,
  };

  if (!configured) {
    errors.push("APIFY_API_TOKEN is not configured. Add it to .env.local.");
    return result;
  }

  try {
    const userResponse = await apifyRequest<{ data: ApifyUserProfile }>("/users/me");
    result.connection.authenticated = true;
    result.connection.username = userResponse.data.username;
    result.connection.plan = userResponse.data.plan;
  } catch (error) {
    const message = error instanceof ServiceError ? error.message : "Apify authentication failed.";
    errors.push(message);
    return result;
  }

  const actorId = env.APIFY_MATERIALS_ACTOR_ID;
  if (!actorId) {
    result.actor.status = "not_configured";
    return result;
  }

  // Test endpoint only reports actor ID presence — no Actor API call or run polling.
  result.actor.status = "reachable";
  return result;
}

/** Starts an Apify Actor run and returns run metadata. */
export async function startActorRun(
  actorId: string,
  input: Record<string, unknown> = {},
): Promise<ApifyActorRun> {
  const encodedActorId = encodeURIComponent(actorId);
  const result = await apifyRequest<{ data: ApifyActorRun }>(
    `/acts/${encodedActorId}/runs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return result.data;
}

/** Fetches the current status of an Actor run. */
export async function getActorRun(runId: string): Promise<ApifyActorRun> {
  const result = await apifyRequest<{ data: ApifyActorRun }>(`/actor-runs/${runId}`);
  return result.data;
}

const TERMINAL_RUN_STATUSES: ApifyRunStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "TIMED-OUT",
  "ABORTED",
];

function isTerminalRunStatus(status: ApifyRunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls an Actor run until it reaches a terminal status or times out. */
export async function waitForActorRun(
  runId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<ApifyActorRun> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run = await getActorRun(runId);

    if (isTerminalRunStatus(run.status)) {
      return run;
    }

    await sleep(pollIntervalMs);
  }

  throw new ServiceError(
    `Apify run "${runId}" did not finish within ${timeoutMs}ms.`,
    "APIFY_TIMEOUT",
    504,
  );
}

/** Fetches all items from an Apify dataset. */
export async function getDatasetItems<T = Record<string, unknown>>(
  datasetId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<T[]> {
  const params = new URLSearchParams({ format: "json" });
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));

  const path = `/datasets/${datasetId}/items?${params.toString()}`;
  const result = await apifyRequest<T[] | ApifyPaginatedDataset<T>>(path);

  if (Array.isArray(result)) {
    return result;
  }

  return result.items ?? [];
}

/** Starts a run, optionally waits for completion, and returns the finished run. */
export async function runActor(
  actorId: string,
  input: Record<string, unknown> = {},
  options: { waitForFinish?: boolean; timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<ApifyActorRun> {
  const run = await startActorRun(actorId, input);

  if (!options.waitForFinish) {
    return run;
  }

  return waitForActorRun(run.id, {
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  });
}
