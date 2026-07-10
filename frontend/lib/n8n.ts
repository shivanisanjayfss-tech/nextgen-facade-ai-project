import { env, isN8nConfigured } from "@/lib/env";

interface N8nWebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

/** Sends events to n8n webhook for workflow automation (scraping, notifications, etc.). */
export async function triggerN8nWorkflow(payload: N8nWebhookPayload) {
  if (!isN8nConfigured()) {
    throw new Error("n8n is not configured. Set N8N_WEBHOOK_URL.");
  }

  const response = await fetch(env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook failed: ${response.statusText}`);
  }

  return response.json();
}
