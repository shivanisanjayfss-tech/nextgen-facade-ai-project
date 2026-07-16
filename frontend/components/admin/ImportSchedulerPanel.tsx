"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ApiResponse } from "@/types";
import type { ImportSchedulerStatus } from "@/types/import-scheduler";

interface SchedulerResponse {
  scheduler: ImportSchedulerStatus;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function ImportSchedulerPanel() {
  const [scheduler, setScheduler] = useState<ImportSchedulerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadScheduler = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/import/scheduler");
      const json = (await response.json()) as ApiResponse<SchedulerResponse>;

      if (!response.ok || !json.success) {
        throw new Error(
          json.success ? "Failed to load scheduler" : json.error.message,
        );
      }

      setScheduler(json.data.scheduler);
      return json.data.scheduler;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scheduler");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      void loadScheduler();
    }, 2000);
  }, [loadScheduler, stopPolling]);

  useEffect(() => {
    void loadScheduler();
    return () => stopPolling();
  }, [loadScheduler, stopPolling]);

  useEffect(() => {
    if (!scheduler?.runInProgress) {
      stopPolling();
      return;
    }

    startPolling();
  }, [scheduler?.runInProgress, startPolling, stopPolling]);

  async function toggleScheduler(enabled: boolean) {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch("/api/import/scheduler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const json = (await response.json()) as ApiResponse<SchedulerResponse>;

      if (!response.ok || !json.success) {
        throw new Error(
          json.success ? "Failed to update scheduler" : json.error.message,
        );
      }

      setScheduler(json.data.scheduler);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update scheduler");
    } finally {
      setIsUpdating(false);
    }
  }

  async function runNow() {
    setIsStarting(true);
    setError(null);
    setRunMessage(null);

    try {
      const response = await fetch("/api/import/scheduler/run-now", {
        method: "POST",
      });
      const json = (await response.json()) as ApiResponse<{
        started?: boolean;
        message?: string;
      }>;

      if (!response.ok || !json.success) {
        throw new Error(
          json.success ? "Run Now failed" : json.error.message,
        );
      }

      setRunMessage(
        json.data.message ??
          "Import started. Live progress will update below.",
      );

      startPolling();
      await loadScheduler();

      const waitForCompletion = async () => {
        const status = await loadScheduler();
        if (status?.runInProgress) {
          window.setTimeout(() => {
            void waitForCompletion();
          }, 2000);
          return;
        }

        stopPolling();
        setIsStarting(false);

        if (status?.lastRun) {
          setRunMessage(
            `Import finished — imported ${status.lastRun.imported}, updated ${status.lastRun.updated}, skipped ${status.lastRun.skipped}, failed ${status.lastRun.failed} (${formatDuration(status.lastRun.durationSeconds)}).`,
          );
        }
      };

      void waitForCompletion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run Now failed");
      setIsStarting(false);
      stopPolling();
    }
  }

  const isRunning = Boolean(scheduler?.runInProgress || isStarting);
  const progress = scheduler?.progress;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Import Scheduler</CardTitle>
        <CardDescription>
          Automatic monthly imports read from the manufacturers table — enabled=true,
          auto_import=true, import_frequency=monthly. Add a registry row to include a new
          manufacturer; no code changes required.
        </CardDescription>
      </CardHeader>

      {isLoading && (
        <LoadingSpinner size="md" label="Loading scheduler status…" className="px-6 pb-6" />
      )}

      {error && !isLoading && (
        <div className="px-6 pb-6">
          <ErrorMessage message={error} onRetry={() => void loadScheduler()} />
        </div>
      )}

      {scheduler && !isLoading && (
        <div className="space-y-6 px-6 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatusItem
              label="Scheduler Status"
              value={scheduler.enabled ? "Enabled" : "Disabled"}
              tone={scheduler.enabled ? "success" : "neutral"}
            />
            <StatusItem label="Frequency" value={scheduler.frequency} />
            <StatusItem
              label="Next Scheduled Run"
              value={formatDate(scheduler.nextScheduledRunAt)}
            />
            <StatusItem
              label="Schedule"
              value={scheduler.scheduleDescription}
            />
            <StatusItem
              label="Last Successful Run"
              value={formatDate(scheduler.lastSuccessfulRunAt)}
            />
            <StatusItem
              label="Last Failed Run"
              value={formatDate(scheduler.lastFailedRunAt)}
            />
            <StatusItem
              label="Enabled Manufacturers"
              value={String(scheduler.enabledManufacturerCount)}
            />
            <StatusItem
              label="Currently Running"
              value={scheduler.currentlyRunningManufacturer ?? "—"}
              tone={scheduler.currentlyRunningManufacturer ? "running" : "neutral"}
            />
          </div>

          {isRunning && progress && (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-4">
              <p className="text-sm font-medium text-sky-200">
                Import in progress — manufacturer {progress.manufacturerIndex} of{" "}
                {progress.manufacturerTotal}
              </p>
              <p className="mt-1 text-sm text-sky-100/80">
                {progress.currentManufacturer ?? "Starting…"}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <ProgressStat label="Imported" value={progress.imported} />
                <ProgressStat label="Updated" value={progress.updated} />
                <ProgressStat label="Skipped" value={progress.skipped} />
                <ProgressStat label="Failed" value={progress.failed} />
              </div>
            </div>
          )}

          {!isRunning && scheduler.lastRun.finishedAt && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-sm font-medium text-white/80">Last run summary</p>
              <p className="mt-1 text-xs text-white/50">
                {formatDate(scheduler.lastRun.startedAt)} →{" "}
                {formatDate(scheduler.lastRun.finishedAt)} ·{" "}
                {formatDuration(scheduler.lastRun.durationSeconds)}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <ProgressStat label="Imported" value={scheduler.lastRun.imported} />
                <ProgressStat label="Updated" value={scheduler.lastRun.updated} />
                <ProgressStat label="Skipped" value={scheduler.lastRun.skipped} />
                <ProgressStat label="Failed" value={scheduler.lastRun.failed} />
              </div>
            </div>
          )}

          {runMessage && (
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
              {runMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => void runNow()}
              disabled={isRunning || isUpdating}
            >
              {isRunning ? "Import running…" : "Run Now"}
            </Button>

            {scheduler.enabled ? (
              <Button
                variant="outline"
                onClick={() => void toggleScheduler(false)}
                disabled={isUpdating || isRunning}
              >
                Disable Scheduler
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => void toggleScheduler(true)}
                disabled={isUpdating || isRunning}
              >
                Enable Scheduler
              </Button>
            )}

            <Link
              href="/admin/import-history"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/5"
            >
              View Import History
            </Link>

            <Button variant="ghost" size="sm" onClick={() => void loadScheduler()}>
              Refresh
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatusItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "running";
}) {
  const valueStyles = {
    neutral: "text-white",
    success: "text-emerald-300",
    running: "text-sky-300",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className={`mt-1 text-sm font-medium ${valueStyles[tone]}`}>{value}</p>
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-white">{value}</p>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}
