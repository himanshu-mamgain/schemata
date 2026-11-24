import { describe, expect, it } from "vitest";
import { answers, deleteSavedQuery, onSyncedChange, saveAnswer, savedQueries, solved } from "../store";
import { applySnapshot, snapshot } from "./data";
import { mergeSchemata, stable, type SchemataData } from "./merge";

const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 22);
const iso = (ms: number) => new Date(ms).toISOString();
const data = (patch: Partial<SchemataData> = {}): SchemataData => ({ version: 1, solved: {}, answers: {}, designs: {}, savedQueries: [], deletedQueries: {}, ...patch });
const query = (id: string, at: number) => ({ id, name: id, dataset: "shop", sql: `SELECT ${id}`, savedAt: iso(at) });

describe("mergeSchemata", () => {
  it("keeps every solved question, with the first time it was solved", () => {
    const m = mergeSchemata(data({ solved: { joins: iso(T + 5), cte: iso(T) } }), data({ solved: { joins: iso(T + 1), window: iso(T + 2) } }), T);
    expect(m.solved).toEqual({ joins: iso(T + 1), cte: iso(T), window: iso(T + 2) });
  });

  it("takes the answer changed last", () => {
    const m = mergeSchemata(data({ answers: { joins: { text: "phone", at: T + 2 } } }), data({ answers: { joins: { text: "laptop", at: T + 1 }, cte: { text: "x", at: T } } }), T);
    expect(m.answers.joins.text).toBe("phone");
    expect(m.answers.cte.text).toBe("x");
  });

  it("combines saved queries, newest first, without the deleted ones", () => {
    const phone = data({ savedQueries: [query("a", T), query("b", T + 1)], deletedQueries: { c: T + 3 } });
    const laptop = data({ savedQueries: [query("c", T + 2), query("d", T + 4)], deletedQueries: { a: T + 5 } });
    const m = mergeSchemata(phone, laptop, T + 6);
    expect(m.savedQueries.map((q) => q.id)).toEqual(["d", "b"]);
    expect(stable(m)).toBe(stable(mergeSchemata(laptop, phone, T + 6)));
  });

  it("forgets deletions after 180 days", () => {
    expect(mergeSchemata(data({ deletedQueries: { a: T } }), data(), T + 181 * DAY).deletedQueries).toEqual({});
  });
});

describe("the device's copy (localStorage stores)", () => {
  it("notices your changes, but not the account's writes", () => {
    let changes = 0;
    const stop = onSyncedChange(() => changes++);
    saveAnswer("joins", "SELECT 1");
    expect(changes).toBeGreaterThan(0);
    const before = changes;

    const merged = mergeSchemata(snapshot(), data({ solved: { cte: iso(T) }, savedQueries: [query("from-laptop", T)] }));
    applySnapshot(merged);
    expect(changes).toBe(before);
    expect(solved.get().cte).toBe(iso(T));
    expect(answers.get().joins).toBe("SELECT 1");
    expect(stable(snapshot())).toBe(stable(merged));

    deleteSavedQuery("from-laptop");
    expect(savedQueries.get()).toEqual([]);
    expect(snapshot().deletedQueries["from-laptop"]).toBeGreaterThan(0);
    stop();
  });
});

describe("lessons read", () => {
  it("keeps every lesson read on either device, with the earliest time, and reads old copies without the field", () => {
    const T = Date.parse("2026-11-24T10:00:00Z");
    const iso = (t: number) => new Date(t).toISOString();
    const old = data();
    delete old.lessonsRead;
    const m = mergeSchemata(data({ lessonsRead: { joins: iso(T + 5), basics: iso(T) } }), data({ lessonsRead: { joins: iso(T + 1) } }), T);
    expect(m.lessonsRead).toEqual({ joins: iso(T + 1), basics: iso(T) });
    expect(mergeSchemata(old, data({ lessonsRead: { basics: iso(T) } }), T).lessonsRead).toEqual({ basics: iso(T) });
  });
});
