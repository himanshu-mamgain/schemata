import type { QueryResult } from "./engine";

export interface Verdict {
  ok: boolean;
  message: string;
}

/** Numbers compare by value (so 150000, '150000.00' and 150000n match); everything else as text. */
export function cell(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v))) {
    const n = Number(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  return String(v);
}

const rowKey = (row: unknown[]) => row.map(cell).join("␟");
/** One of your rows, as it reads in a message: (Asha Rao, 250000). */
const showRow = (row: unknown[]) => `(${row.map(cell).join(", ")})`;

/**
 * Compares your last result set with the expected one. Column names are ignored
 * (alias however you like); column order and values matter. Row order matters only
 * when the question asks for it.
 */
export function compare(actual: QueryResult | undefined, expected: QueryResult, ordered: boolean): Verdict {
  if (!actual || actual.fields.length === 0) return { ok: false, message: "Your query returned no result set. End with a SELECT." };
  if (actual.fields.length !== expected.fields.length)
    return { ok: false, message: `Expected ${expected.fields.length} column(s) (${expected.fields.join(", ")}), got ${actual.fields.length}.` };
  if (actual.rows.length !== expected.rows.length)
    return { ok: false, message: `Expected ${expected.rows.length} row(s), got ${actual.rows.length}.` };

  const a = actual.rows.map(rowKey);
  const e = expected.rows.map(rowKey);
  if (ordered) {
    const i = a.findIndex((k, idx) => k !== e[idx]);
    if (i === -1) return { ok: true, message: "Correct, including row order." };
    const sameSet = [...a].sort().join("\n") === [...e].sort().join("\n");
    if (sameSet) return { ok: false, message: "Right rows, wrong order: check your ORDER BY (and how it breaks ties)." };
    const stray = actual.rows.find((r) => !e.includes(rowKey(r)));
    return {
      ok: false,
      message: stray
        ? `This row of yours isn't in the expected result: ${showRow(stray)}. Check the filter, the join and the calculation.`
        : `Row ${i + 1} differs from the expected result: yours is ${showRow(actual.rows[i])}.`,
    };
  }
  const counts = new Map<string, number>();
  for (const k of e) counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const [i, k] of a.entries()) {
    const c = counts.get(k);
    if (!c) {
      const extra = e.includes(k);
      return {
        ok: false,
        message: extra
          ? `You have ${showRow(actual.rows[i])} more times than expected: look for a join that repeats rows, or a missing DISTINCT or GROUP BY.`
          : `This row of yours isn't in the expected result: ${showRow(actual.rows[i])}. Check the filter, the join and the calculation.`,
      };
    }
    counts.set(k, c - 1);
  }
  return { ok: true, message: "Correct." };
}
