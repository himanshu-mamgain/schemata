/**
 * DBML → a small diagram model. Parsing uses @dbml/parse, the compiler behind
 * dbdiagram.io, so anything that works there works here.
 */
import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } from "@dbml/parse";

export interface ErdField {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  notNull: boolean;
  note?: string;
}

export interface ErdTable {
  /** Unique key: schema-qualified when the table isn't in public. */
  id: string;
  name: string;
  fields: ErdField[];
  note?: string;
  color?: string;
  /** Composite keys and unique indexes, as column lists. */
  keys: { columns: string[]; pk: boolean; unique: boolean }[];
}

export interface ErdEnd {
  table: string;
  fields: string[];
  /** True on the "many" side of the relationship. */
  many: boolean;
}

export interface ErdRef {
  id: string;
  from: ErdEnd;
  to: ErdEnd;
}

export interface ErdModel {
  tables: ErdTable[];
  refs: ErdRef[];
  enums: { name: string; values: string[] }[];
}

/** A parse error, with 1-based positions for the editor. */
export interface DbmlError {
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

const tableId = (schema: string | null | undefined, name: string) => (schema && schema !== "public" ? `${schema}.${name}` : name);

function position(src: string, offset: number) {
  const before = src.slice(0, Math.max(0, offset));
  const line = before.split("\n").length;
  return { line, column: offset - before.lastIndexOf("\n") };
}

export function parseDbml(src: string): { model: ErdModel | null; errors: DbmlError[] } {
  // Text copied from a web page often has non-breaking spaces; the parser only knows plain ones.
  // Same length, so error positions still match the editor.
  src = src.replace(/ /g, " ");
  let report;
  try {
    report = new Compiler(new MemoryProjectLayout({ "/main.dbml": src })).interpretFile(DEFAULT_ENTRY);
  } catch (e) {
    return { model: null, errors: [{ message: e instanceof Error ? e.message : String(e), line: 1, column: 1, endLine: 1, endColumn: 2 }] };
  }
  const errors = report.getErrors().map((e) => {
    const s = position(src, e.start);
    const end = position(src, e.end);
    return { message: e.diagnostic, line: s.line, column: s.column, endLine: end.line, endColumn: end.column };
  });
  const db = report.getValue();
  if (errors.length || !db) return { model: null, errors };

  const tables: ErdTable[] = db.tables.map((t) => ({
    id: tableId(t.schemaName, t.name),
    name: t.name,
    note: t.note?.value,
    color: t.headerColor ?? undefined,
    fields: t.fields.map((f) => ({
      name: f.name,
      type: f.type?.type_name ?? "",
      pk: !!f.pk,
      unique: !!f.unique,
      notNull: !!f.not_null || !!f.pk,
      note: f.note?.value,
    })),
    keys: (t.indexes ?? [])
      .filter((i) => i.pk || i.unique)
      .map((i) => ({ columns: i.columns.map((c) => c.value), pk: !!i.pk, unique: !!i.unique })),
  }));
  // A composite primary key marks each of its columns as part of the key.
  for (const t of tables)
    for (const k of t.keys.filter((k) => k.pk))
      for (const f of t.fields) if (k.columns.includes(f.name)) (f.pk = true), (f.notNull = true);

  const refs: ErdRef[] = db.refs.map((r, i) => {
    const [a, b] = r.endpoints;
    const end = (e: typeof a): ErdEnd => ({ table: tableId(e.schemaName, e.tableName), fields: e.fieldNames, many: e.relation === "*" });
    // Draw from the many side (the foreign key) to the one side it points at.
    const [from, to] = a.relation === "*" || b.relation !== "*" ? [end(a), end(b)] : [end(b), end(a)];
    return { id: `r${i}`, from, to };
  });

  return { model: { tables, refs, enums: db.enums.map((e) => ({ name: e.name, values: e.values.map((v) => v.name) })) }, errors: [] };
}

/** The tables a SQL query reads from (FROM / JOIN), to highlight on the diagram. */
export function tablesInSql(sql: string): string[] {
  const found = new Set<string>();
  for (const m of sql.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)) found.add(m[1].toLowerCase());
  return [...found];
}
