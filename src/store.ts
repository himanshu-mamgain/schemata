import { useSyncExternalStore } from "react";

/**
 * Kept in localStorage: solved questions, your answers and designs, saved queries, the last
 * playground draft. Every access is guarded: storage can be blocked. The stores marked
 * `synced` also go to your Studia account (src/account), so they follow you to every device.
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

/** Told about every change to a synced store, except the account's own writes. */
const syncListeners = new Set<() => void>();
let fromAccount = false;

/** Calls `fn` after each change you make to what syncs with your Studia account. */
export function onSyncedChange(fn: () => void): () => void {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

/** Runs `write` (the account's merged copy) without counting it as your change. */
export function fromYourAccount(write: () => void) {
  fromAccount = true;
  try {
    write();
  } finally {
    fromAccount = false;
  }
}

function createStore<T>(key: string, fallback: T, { synced = false } = {}) {
  let value = read(key, fallback);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      write(key, next);
      listeners.forEach((l) => l());
      if (synced && !fromAccount) syncListeners.forEach((l) => l());
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
export const solved = createStore<Record<string, string>>("schemata:solved", {}, { synced: true });
export function markSolved(id: string) {
  if (!solved.get()[id]) solved.set({ ...solved.get(), [id]: new Date().toISOString() });
}

/** Your draft answer per question, so leaving the page doesn't lose it. */
export const answers = createStore<Record<string, string>>("schemata:answers", {}, { synced: true });

/** Your DBML draft per design question. */
export const designs = createStore<Record<string, string>>("schemata:designs", {}, { synced: true });

/** When each answer ("answer:<id>") or design ("design:<id>") last changed, so the newer copy wins. */
export const edited = createStore<Record<string, number>>("schemata:edited", {}, { synced: true });

export function saveAnswer(id: string, sql: string) {
  edited.set({ ...edited.get(), [`answer:${id}`]: Date.now() });
  answers.set({ ...answers.get(), [id]: sql });
}

export function saveDesign(id: string, dbml: string) {
  edited.set({ ...edited.get(), [`design:${id}`]: Date.now() });
  designs.set({ ...designs.get(), [id]: dbml });
}

/** The diagram editor's last DBML, so a reload doesn't lose it. */
export const erdDraft = createStore<string>("schemata:erd-draft", "");

export interface SavedQuery {
  id: string;
  name: string;
  dataset: string;
  sql: string;
  savedAt: string;
}
export const savedQueries = createStore<SavedQuery[]>("schemata:saved-queries", [], { synced: true });

/** Saved queries you deleted (id → when), so your account doesn't bring them back from another device. */
export const deletedQueries = createStore<Record<string, number>>("schemata:deleted-queries", {}, { synced: true });

export function deleteSavedQuery(id: string) {
  deletedQueries.set({ ...deletedQueries.get(), [id]: Date.now() });
  savedQueries.set(savedQueries.get().filter((q) => q.id !== id));
}

export interface Draft {
  dataset: string;
  sql: string;
}
export const draft = createStore<Draft>("schemata:draft", {
  dataset: "shop",
  sql: "-- Ctrl+Enter runs the query (or just the selected part).\n-- Tables are listed on the left; click one to peek at it.\nSELECT * FROM customers LIMIT 10;",
});
