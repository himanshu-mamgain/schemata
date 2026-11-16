/**
 * Real Postgres in the browser (PGlite, WebAssembly), saved in IndexedDB so loaded
 * datasets and your own tables survive reloads. No server: Netlify only hosts files.
 */
import { PGlite, type Results } from "@electric-sql/pglite";
import { DATASETS, SHOP_SQL, cleanScript } from "./datasets";
import { toDbml, type CatalogColumn, type CatalogConstraint } from "../erd/fromSchema";

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

/** Some servers send .wasm without its MIME type, which compileStreaming refuses. */
const wasm = (url: string) =>
  WebAssembly.compileStreaming(fetch(url)).catch(async () => WebAssembly.compile(await (await fetch(url)).arrayBuffer()));

/** PGlite's WebAssembly and files, served from public/pglite/ (see scripts/pglite-assets.mjs). */
async function assets() {
  const [pgliteWasmModule, initdbWasmModule, fsBundle] = await Promise.all([
    wasm("/pglite/pglite.wasm"),
    wasm("/pglite/initdb.wasm"),
    fetch("/pglite/pglite.data").then((r) => r.blob()),
  ]);
  return { pgliteWasmModule, initdbWasmModule, fsBundle };
}

export function getDb(): Promise<PGlite> {
  dbPromise ??= (async () => {
    const files = await assets();
    let db: PGlite;
    try {
      db = await PGlite.create({ dataDir: "idb://schemata", ...files });
    } catch {
      // Private windows can block IndexedDB: fall back to an in-memory database.
      db = await PGlite.create(files);
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

/** Catalog queries behind the schema diagram: columns, keys and foreign keys. */
export const CATALOG_COLUMNS = `
  SELECT c.relname::text AS "table", a.attname::text AS "column", format_type(a.atttypid, a.atttypmod) AS "type", a.attnotnull AS not_null
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
  ORDER BY c.relname, a.attnum`;
export const CATALOG_CONSTRAINTS = `
  SELECT con.contype::text AS kind, c.relname::text AS "table",
    ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(n, o) JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n ORDER BY k.o) AS cols,
    f.relname::text AS ref_table,
    CASE WHEN con.contype = 'f' THEN ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(n, o) JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.n ORDER BY k.o) END AS ref_cols
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_class f ON f.oid = con.confrelid
  WHERE n.nspname = $1 AND con.contype IN ('p', 'u', 'f')
  ORDER BY c.relname, con.conname`;

/** DBML for a loaded dataset, for the schema diagram. */
export function schemaDbml(schema: string): Promise<string> {
  return serial(async (db) => {
    const cols = await db.query<CatalogColumn>(CATALOG_COLUMNS, [schema]);
    const cons = await db.query<CatalogConstraint>(CATALOG_CONSTRAINTS, [schema]);
    return toDbml(cols.rows, cons.rows);
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
