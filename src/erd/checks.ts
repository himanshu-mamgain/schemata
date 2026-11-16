/**
 * Automatic checks for schema-design questions. Each looks at the diagram parsed
 * from your DBML. Table names are matched loosely (case, plural, underscores),
 * so "Book", "books" and "book" all count.
 */
import type { ErdModel, ErdTable } from "./model";

export interface DesignCheck {
  label: string;
  /** Shown when the check fails. */
  hint: string;
  test: (m: ErdModel) => boolean;
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/ies$/, "y")
    .replace(/(ss|us)$/, "$1_")
    .replace(/s$/, "")
    .replace(/_$/, "");

/** Tables whose name matches any of `names`. */
export const tables = (m: ErdModel, names: string[]) => m.tables.filter((t) => names.some((n) => norm(t.name) === norm(n)));
const ids = (m: ErdModel, names: string[]) => new Set(tables(m, names).map((t) => t.id));

const isKey = (t: ErdTable, cols: string[]) => {
  const want = new Set(cols);
  const pk = t.fields.filter((f) => f.pk).map((f) => f.name);
  const keys = [pk, ...t.keys.map((k) => k.columns), ...t.fields.filter((f) => f.unique).map((f) => [f.name])];
  // A key that uses only these columns makes the combination unique.
  return keys.some((k) => k.length > 0 && k.every((c) => want.has(c)));
};

export const check = {
  table: (names: string[], label: string): DesignCheck => ({
    label,
    hint: `Add a table for this (e.g. ${names[0]}).`,
    test: (m) => tables(m, names).length > 0,
  }),

  everyTableHasPk: (): DesignCheck => ({
    label: "Every table has a primary key",
    hint: "Mark a column [pk], or add indexes { (a, b) [pk] } for a composite key.",
    test: (m) => m.tables.length > 0 && m.tables.every((t) => t.fields.some((f) => f.pk)),
  }),

  ref: (from: string[], to: string[], label: string): DesignCheck => ({
    label,
    hint: `Give ${from[0]} a foreign key to ${to[0]}: e.g. ${to[0].replace(/s$/, "")}_id int [ref: > ${to[0]}.id].`,
    test: (m) => {
      const a = ids(m, from);
      const b = ids(m, to);
      return m.refs.some((r) => a.has(r.from.table) && b.has(r.to.table));
    },
  }),

  /** A junction table with foreign keys to both sides, whose pair is unique. */
  manyToMany: (a: string[], b: string[], label: string, opts: { unique?: boolean } = {}): DesignCheck => ({
    label,
    hint: `Many-to-many needs a junction table with a foreign key to ${a[0]} and one to ${b[0]}${opts.unique === false ? "" : ", and a composite primary key on the pair so it can't repeat"}.`,
    test: (m) => {
      const A = ids(m, a);
      const B = ids(m, b);
      return m.tables.some((t) => {
        const outA = m.refs.filter((r) => r.from.table === t.id && A.has(r.to.table));
        const outB = m.refs.filter((r) => r.from.table === t.id && B.has(r.to.table));
        // Two different foreign keys; for a self many-to-many (followers) both point at the same table.
        const pairs = outA.flatMap((x) => outB.filter((y) => y !== x && y.from.fields.join() !== x.from.fields.join()).map((y) => [x, y] as const));
        if (!pairs.length) return false;
        return opts.unique === false || pairs.some(([x, y]) => isKey(t, [...x.from.fields, ...y.from.fields]));
      });
    },
  }),

  column: (names: string[], pattern: RegExp, label: string, hint: string): DesignCheck => ({
    label,
    hint,
    test: (m) => tables(m, names).some((t) => t.fields.some((f) => pattern.test(f.name))),
  }),

  /** Some table references every one of these tables and is unique on those references. */
  uniqueAcross: (targets: string[][], label: string, hint: string): DesignCheck => ({
    label,
    hint,
    test: (m) =>
      m.tables.some((t) => {
        const cols: string[] = [];
        for (const names of targets) {
          const T = ids(m, names);
          const r = m.refs.find((r) => r.from.table === t.id && T.has(r.to.table));
          if (!r) return false;
          cols.push(...r.from.fields);
        }
        return isKey(t, cols);
      }),
  }),

  noRepeatedGroups: (): DesignCheck => ({
    label: "No numbered repeating columns (1NF)",
    hint: "Columns like phone1, phone2 or tag_1 mean a list squeezed into one row: move it to its own table.",
    test: (m) => !m.tables.some((t) => t.fields.filter((f) => /\D[_]?[1-9]$/.test(f.name)).length >= 2),
  }),
};
