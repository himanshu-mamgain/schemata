import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { SHOP_SQL } from "../db/datasets";
import { examples, parseLesson, sections, walkthroughs } from "./lessonFormat";
import { WALKTHROUGHS } from "./steps";
import { cell } from "../db/check";
import { ROADMAP } from "./roadmap";
import { QUESTIONS } from "./questions";
import { TOPICS } from "./topics";

// Every lesson (src/content/lessons/<stage>.md): it belongs to a roadmap stage, its links
// lead somewhere, and every example runs on the shop data (or fails, when it's meant to).

const dir = join(__dirname, "lessons");
const lessons = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ id: f.replace(/\.md$/, ""), blocks: parseLesson(readFileSync(join(dir, f), "utf8")) }));

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHOP_SQL);
}, 60_000);

describe.each(lessons.map((l) => [l.id, l] as const))("lesson %s", (id, lesson) => {
  it("belongs to a roadmap stage and has sections", () => {
    expect(ROADMAP.some((s) => s.id === id)).toBe(true);
    expect(sections(lesson.blocks).length).toBeGreaterThan(2);
  });

  it("links only to pages that exist", () => {
    const text = JSON.stringify(lesson.blocks);
    for (const [, href] of text.matchAll(/\]\((\/[^)\s]+)\)/g)) {
      const [path, hash] = href.split("#");
      const q = path.match(/^\/questions\/([\w-]+)$/);
      const t = path.match(/^\/topics\/([\w-]+)$/);
      expect(Boolean(q ? QUESTIONS.some((x) => x.id === q[1]) : t ? TOPICS.some((x) => x.id === t[1]) : ["/playground", "/erd", "/databases", "/roadmap"].includes(path)), href).toBe(true);
      if (t && hash) {
        const target = lessons.find((l) => l.id === t[1]);
        expect(target && sections(target.blocks).some((s) => s.id === hash), href).toBe(true);
      }
    }
  });

  it("uses only step-throughs that exist", () => {
    for (const s of walkthroughs(lesson.blocks)) expect(WALKTHROUGHS.some((w) => w.id === s.id), s.id).toBe(true);
  });

  it.each(examples(lesson.blocks).filter((b) => b.run !== "no").map((b, i) => [i + 1, b] as const))("example %i runs", async (_n, b) => {
    await db.exec("BEGIN");
    let error: unknown = null;
    try {
      await db.exec("SET LOCAL search_path TO shop");
      await db.exec(b.code);
    } catch (e) {
      error = e;
    } finally {
      await db.exec("ROLLBACK").catch(() => {});
    }
    if (b.run === "error") expect(error, b.code).not.toBeNull();
    else expect(error, `${b.code}\n→ ${error}`).toBeNull();
  });
});

// Each step-through's last table must be exactly what its SQL returns on the real data.
describe.each(WALKTHROUGHS.map((w) => [w.id, w] as const))("step-through %s", (_id, w) => {
  it("ends with what Postgres really returns", async () => {
    await db.exec("BEGIN");
    try {
      await db.exec("SET LOCAL search_path TO shop");
      const res = await db.exec(w.sql, { rowMode: "array" });
      const got = (res.at(-1)!.rows as unknown[][]).map((r) => r.map(cell).join(" | "));
      const want = w.result.map((r) => r.map(cell).join(" | "));
      expect(w.ordered ? got : [...got].sort()).toEqual(w.ordered ? want : [...want].sort());
      const final = w.frames.at(-1)!.tables.at(-1)!;
      expect(final.rows.map((r) => r.cells.map(cell).join(" | "))).toEqual(want);
    } finally {
      await db.exec("ROLLBACK");
    }
  });

  it("has a caption for every step, and clauses that are in its SQL", () => {
    expect(w.frames.length).toBeGreaterThan(2);
    for (const f of w.frames) {
      expect(f.caption.length).toBeGreaterThan(10);
      if (f.clause) expect(w.sql.includes(f.clause), f.clause).toBe(true);
    }
  });
});

// Links inside questions (prompts, hints, answers, explanations) lead to lessons that exist.
describe("question links", () => {
  it("point at existing lessons and sections", () => {
    for (const q of QUESTIONS) {
      for (const [, href] of JSON.stringify(q).matchAll(/\]\((\/[^)\s]+)\)/g)) {
        const [path, hash] = href.split("#");
        const t = path.match(/^\/topics\/([\w-]+)$/);
        const known = t ? TOPICS.some((x) => x.id === t[1]) : QUESTIONS.some((x) => `/questions/${x.id}` === path);
        expect(known, `${q.id} → ${href}`).toBe(true);
        if (t && hash) {
          const target = lessons.find((l) => l.id === t[1]);
          expect(target && sections(target.blocks).some((s) => s.id === hash), `${q.id} → ${href}`).toBe(true);
        }
      }
    }
  });
});
