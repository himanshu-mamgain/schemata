import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { SHOP_SQL } from "../db/datasets";
import { QUESTIONS, type SqlQuestion } from "./questions";
import { compare } from "../db/check";
import { ROADMAP } from "./roadmap";

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHOP_SQL);
}, 60_000);

const run = async (sql: string) => {
  const res = await db.exec(sql, { rowMode: "array" });
  const last = res[res.length - 1];
  return { fields: last.fields.map((f) => f.name), rows: last.rows as unknown[][], ms: 0 };
};

const sqlQuestions = QUESTIONS.filter((q): q is SqlQuestion => q.kind === "sql");

describe("question bank", () => {
  it("has unique ids and known roadmap stages", () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    const stages = new Set(ROADMAP.map((s) => s.id));
    for (const q of QUESTIONS) expect(stages.has(q.stage), `${q.id} → ${q.stage}`).toBe(true);
  });

  it.each(sqlQuestions.map((q) => [q.id, q] as const))("%s: solution runs and matches itself", async (_id, q) => {
    const expected = await run(q.solution);
    expect(compare(expected, expected, q.ordered).ok).toBe(true);
    // Only one question is meant to return nothing.
    if (q.id !== "earn-more-than-manager") expect(expected.rows.length).toBeGreaterThan(0);
  });
});
