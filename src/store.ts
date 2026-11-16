import { useSyncExternalStore } from "react";

/**
 * Per-device conveniences kept in localStorage: solved questions, saved queries,
 * the last playground draft. Every access is guarded: storage can be blocked.
 */
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback; // prerendering at build time
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked or full: keep it for this visit only */
  }
}

function createStore<T>(key: string, fallback: T) {
  let value = read(key, fallback);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      write(key, next);
      listeners.forEach((l) => l());
    },
    use: () =>
      useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => value,
        // Pages are prerendered without storage; the first client render matches, then this device's data shows.
        () => fallback,
      ),
  };
}

/** Question id → when you first solved it (or revealed a theory answer). */
export const solved = createStore<Record<string, string>>("schemata:solved", {});
export function markSolved(id: string) {
  if (!solved.get()[id]) solved.set({ ...solved.get(), [id]: new Date().toISOString() });
}

/** Your draft answer per question, so leaving the page doesn't lose it. */
export const answers = createStore<Record<string, string>>("schemata:answers", {});
export const saveAnswer = (id: string, sql: string) => answers.set({ ...answers.get(), [id]: sql });

/** Your DBML draft per design question. */
export const designs = createStore<Record<string, string>>("schemata:designs", {});
export const saveDesign = (id: string, dbml: string) => designs.set({ ...designs.get(), [id]: dbml });

/** The diagram editor's last DBML, so a reload doesn't lose it. */
export const erdDraft = createStore<string>("schemata:erd-draft", "");

export interface SavedQuery {
  id: string;
  name: string;
  dataset: string;
  sql: string;
  savedAt: string;
}
export const savedQueries = createStore<SavedQuery[]>("schemata:saved-queries", []);

export interface Draft {
  dataset: string;
  sql: string;
}
export const draft = createStore<Draft>("schemata:draft", {
  dataset: "shop",
  sql: "-- Ctrl+Enter runs the query (or just the selected part).\n-- Tables are listed on the left; click one to peek at it.\nSELECT * FROM customers LIMIT 10;",
});
