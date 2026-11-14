/**
 * Real Postgres in the browser (PGlite, WebAssembly), saved in IndexedDB so loaded
 * datasets and your own tables survive reloads. No server: Netlify only hosts files.
 */
import { PGlite, type Results } from "@electric-sql/pglite";
import { DATASETS, SHOP_SQL, cleanScript } from "./datasets";

export interface QueryResult {
  fields: string[];
  rows: unknown[][];
  affectedRows?: number;
  ms: number;
}

let dbPromise: Promise<PGlite> | null = null;
/** One statement batch at a time: the editor, the checker and the schema browser share a connection. */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: (db: PGlite) => Promise<T>): Promise<T> {
  const run = queue.then(async () => fn(await getDb()));
  queue = run.catch(() => undefined);
  return run;
}

export function getDb(): Promise<PGlite> {
  dbPromise ??= (async () => {
    let db: PGlite;
    try {
      db = await PGlite.create("idb://schemata");
    } catch {
      // Private windows can block IndexedDB: fall back to an in-memory database.
      db = await PGlite.create();
    }
    const has = await db.query("SELECT 1 FROM pg_namespace WHERE nspname = 'shop'");
    if (has.rows.length === 0) await db.exec(SHOP_SQL);
    return db;
  })();
  return dbPromise;
}

const toResult = (r: Results, ms: number): QueryResult => ({
  fields: r.fields.map((f) => f.name),
  rows: r.rows as unknown[][],
  affectedRows: r.affectedRows,
  ms,
});

async function useSchema(db: PGlite, schema: string) {
  await db.exec(`SET search_path TO ${quoteIdent(schema)}, public`);
}

/** Runs one or more statements and keeps their effects (the playground). */
export function run(sql: string, schema: string): Promise<QueryResult[]> {
  return serial(async (db) => {
    await useSchema(db, schema);
    const t = performance.now();
    const results = await db.exec(sql, { rowMode: "array" });
    const ms = performance.now() - t;
    return results.map((r) => toResult(r, ms));
  });
}

/** Runs statements inside a transaction that is always rolled back: practice without changing the data. */
export function runAndRollback(sql: string, schema: string): Promise<QueryResult[]> {
  return serial(async (db) => {
    await useSchema(db, schema);
    await db.exec("BEGIN");
    try {
      const t = performance.now();
      const results = await db.exec(sql, { rowMode: "array" });
      const ms = performance.now() - t;
      return results.map((r) => toResult(r, ms));
    } finally {
      await db.exec("ROLLBACK");
    }
  });
}

export interface Column {
  table: string;
  column: string;
  type: string;
}

export function columns(schema: string): Promise<Column[]> {
  return serial(async (db) => {
    const r = await db.query<Column>(
      `SELECT table_name AS "table", column_name AS "column", data_type AS "type"
       FROM information_schema.columns WHERE table_schema = $1
       ORDER BY table_name, ordinal_position`,
      [schema],
    );
    return r.rows;
  });
}

export function isLoaded(schema: string): Promise<boolean> {
  return serial(async (db) => (await db.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema])).rows.length > 0);
}

/** Downloads an open-source dataset from GitHub into its own schema. */
export async function loadDataset(id: string): Promise<void> {
  const ds = DATASETS.find((d) => d.id === id);
  if (!ds?.url) throw new Error(`Unknown dataset ${id}`);
  const res = await fetch(ds.url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const script = cleanScript(await res.text());
  await serial(async (db) => {
    await db.exec(`DROP SCHEMA IF EXISTS ${quoteIdent(id)} CASCADE; CREATE SCHEMA ${quoteIdent(id)};`);
    await useSchema(db, id);
    await db.exec(script);
  });
}

/** Drops a dataset and, for the built-in one, recreates it: undoes anything you changed. */
export function resetDataset(id: string): Promise<void> {
  return serial(async (db) => {
    await db.exec(`DROP SCHEMA IF EXISTS ${quoteIdent(id)} CASCADE`);
    if (id === "shop") await db.exec(SHOP_SQL);
  });
}

export const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;
