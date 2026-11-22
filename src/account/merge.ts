import type { SavedQuery } from "../store";

/**
 * What Schemata saves to your Studia account: the questions you solved, your answers and
 * designs, and your saved queries. The playground and diagram drafts, and the theme, stay
 * on the device.
 */
export interface SchemataData {
  version: 1;
  /** Question id → when you first solved it (ISO time). */
  solved: Record<string, string>;
  /** Question id → your SQL, and when you last changed it (epoch ms). */
  answers: Record<string, { text: string; at: number }>;
  /** Design question id → your DBML, and when you last changed it. */
  designs: Record<string, { text: string; at: number }>;
  savedQueries: SavedQuery[];
  /** Saved query id → when you deleted it, so another device's copy doesn't bring it back. */
  deletedQueries: Record<string, number>;
}

/** Deletions older than this are forgotten: every device has synced long before. */
const KEEP_DELETED_MS = 180 * 24 * 60 * 60 * 1000;

type Edited = Record<string, { text: string; at: number }>;

/** The copy changed last wins; on a tie, this device's. */
function newer(local: Edited, remote: Edited): Edited {
  const out = { ...local };
  for (const [id, r] of Object.entries(remote)) if (!out[id] || r.at > out[id].at) out[id] = r;
  return out;
}

/** Combines this device's data with the account's, so neither loses work. */
export function mergeSchemata(local: SchemataData, remote: SchemataData, now = Date.now()): SchemataData {
  // Solved stays solved: keep the first time from either device.
  const solved = { ...local.solved };
  for (const [id, at] of Object.entries(remote.solved)) if (!solved[id] || at < solved[id]) solved[id] = at;

  const deletedQueries: Record<string, number> = {};
  for (const [id, at] of [...Object.entries(local.deletedQueries), ...Object.entries(remote.deletedQueries)]) {
    if (now - at < KEEP_DELETED_MS) deletedQueries[id] = Math.max(deletedQueries[id] ?? 0, at);
  }
  const queries = new Map(local.savedQueries.map((q) => [q.id, q]));
  for (const q of remote.savedQueries) {
    const mine = queries.get(q.id);
    if (!mine || q.savedAt > mine.savedAt) queries.set(q.id, q);
  }
  const savedQueries = [...queries.values()]
    .filter((q) => !((deletedQueries[q.id] ?? -1) >= Date.parse(q.savedAt)))
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : a.id < b.id ? -1 : 1)); // newest first, as the playground lists them

  return { version: 1, solved, answers: newer(local.answers, remote.answers), designs: newer(local.designs, remote.designs), savedQueries, deletedQueries };
}

/** JSON with sorted keys, so two copies with the same content compare equal. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}
