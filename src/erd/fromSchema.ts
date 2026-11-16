/**
 * Writes DBML for a live Postgres schema (from the catalog queries in db/engine.ts),
 * so every dataset in the editor can be drawn as a diagram.
 */

export interface CatalogColumn {
  table: string;
  column: string;
  type: string;
  not_null: boolean;
}

export interface CatalogConstraint {
  /** p = primary key, u = unique, f = foreign key. */
  kind: "p" | "u" | "f";
  table: string;
  cols: string[];
  ref_table: string | null;
  ref_cols: string[] | null;
}

const KEYWORDS = new Set(["table", "ref", "enum", "note", "indexes", "project", "tablegroup", "pk", "null", "not", "unique", "increment", "default", "as"]);

/** Quotes a name unless it is a plain lower-case identifier. */
export const ident = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) && !KEYWORDS.has(s) ? s : `"${s.replace(/"/g, '\\"')}"`);

/** Postgres type names with spaces get their short names; anything else is quoted. */
function typeName(t: string): string {
  const short = t
    .replace(/^character varying/, "varchar")
    .replace(/^character\b/, "char")
    .replace(/^timestamp(\(\d+\))? without time zone/, "timestamp$1")
    .replace(/^timestamp(\(\d+\))? with time zone/, "timestamptz$1")
    .replace(/^time(\(\d+\))? without time zone/, "time$1")
    .replace(/^time(\(\d+\))? with time zone/, "timetz$1")
    .replace(/^double precision/, "float8")
    .replace(/^bit varying/, "varbit");
  return /^[a-z_][a-z0-9_]*(\(\d+(,\s?\d+)?\))?(\[\])?$/i.test(short) ? short : `"${short.replace(/"/g, "")}"`;
}

const cols = (c: string[]) => (c.length === 1 ? ident(c[0]) : `(${c.map(ident).join(", ")})`);

export function toDbml(columns: CatalogColumn[], constraints: CatalogConstraint[]): string {
  const tables = [...new Set(columns.map((c) => c.table))];
  const out: string[] = [];
  const refsOut: string[] = [];

  for (const t of tables) {
    const mine = constraints.filter((c) => c.table === t);
    const pk = mine.find((c) => c.kind === "p")?.cols ?? [];
    const singleUnique = new Set(mine.filter((c) => c.kind === "u" && c.cols.length === 1).map((c) => c.cols[0]));
    const singleFk = new Map(mine.filter((c) => c.kind === "f" && c.cols.length === 1).map((c) => [c.cols[0], c]));

    out.push(`Table ${ident(t)} {`);
    for (const c of columns.filter((c) => c.table === t)) {
      const settings: string[] = [];
      if (pk.length === 1 && pk[0] === c.column) settings.push("pk");
      else if (c.not_null) settings.push("not null");
      if (singleUnique.has(c.column)) settings.push("unique");
      const fk = singleFk.get(c.column);
      if (fk?.ref_table && fk.ref_cols) settings.push(`ref: > ${ident(fk.ref_table)}.${ident(fk.ref_cols[0])}`);
      out.push(`  ${ident(c.column)} ${typeName(c.type)}${settings.length ? ` [${settings.join(", ")}]` : ""}`);
    }
    const indexes = [
      ...(pk.length > 1 ? [`    ${cols(pk)} [pk]`] : []),
      ...mine.filter((c) => c.kind === "u" && c.cols.length > 1).map((c) => `    ${cols(c.cols)} [unique]`),
    ];
    if (indexes.length) out.push("", "  indexes {", ...indexes, "  }");
    out.push("}", "");

    for (const f of mine.filter((c) => c.kind === "f" && c.cols.length > 1 && c.ref_table && c.ref_cols))
      refsOut.push(`Ref: ${ident(t)}.${cols(f.cols)} > ${ident(f.ref_table!)}.${cols(f.ref_cols!)}`);
  }
  return [...out, ...refsOut].join("\n").trimEnd() + "\n";
}
