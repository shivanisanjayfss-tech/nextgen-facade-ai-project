/** Thread-local-ish context for dual-writing scheduler logs to Supabase. */
export interface ImportRunLogPersistenceContext {
  schedulerRunId?: string;
  importHistoryId?: string;
  manufacturer?: string;
}

const CONTEXT_KEY = "__nextgenImportRunLogContext__";

function getStore(): ImportRunLogPersistenceContext {
  const root = globalThis as typeof globalThis & {
    [CONTEXT_KEY]?: ImportRunLogPersistenceContext;
  };

  if (!root[CONTEXT_KEY]) {
    root[CONTEXT_KEY] = {};
  }

  return root[CONTEXT_KEY];
}

export function setImportRunLogContext(
  patch: ImportRunLogPersistenceContext,
): void {
  Object.assign(getStore(), patch);
}

export function getImportRunLogContext(): ImportRunLogPersistenceContext {
  return { ...getStore() };
}

export function clearImportRunLogContext(): void {
  const root = globalThis as typeof globalThis & {
    [CONTEXT_KEY]?: ImportRunLogPersistenceContext;
  };
  root[CONTEXT_KEY] = {};
}
