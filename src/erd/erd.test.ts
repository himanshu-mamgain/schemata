import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { SHOP_SQL } from "../db/datasets";
import { CATALOG_COLUMNS, CATALOG_CONSTRAINTS } from "../db/engine";
import { toDbml, type CatalogColumn, type CatalogConstraint } from "./fromSchema";
import { parseDbml, tablesInSql } from "./model";
import { DESIGN_QUESTIONS } from "../content/design";

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHOP_SQL);
}, 60_000);

const dbmlOf = async (schema: string) =>
  toDbml((await db.query<CatalogColumn>(CATALOG_COLUMNS, [schema])).rows, (await db.query<CatalogConstraint>(CATALOG_CONSTRAINTS, [schema])).rows);

describe("schema → DBML → diagram", () => {
  it("draws the shop dataset with every table and foreign key", async () => {
    const dbml = await dbmlOf("shop");
    const { model, errors } = parseDbml(dbml);
    expect(errors).toEqual([]);
    expect(model!.tables.map((t) => t.name).sort()).toEqual(["customers", "departments", "employees", "logins", "order_items", "orders", "products"]);
    const refs = model!.refs.map((r) => `${r.from.table}.${r.from.fields} > ${r.to.table}.${r.to.fields}`).sort();
    expect(refs).toEqual([
      "customers.referred_by > customers.id",
      "employees.department_id > departments.id",
      "employees.manager_id > employees.id",
      "logins.user_id > customers.id",
      "order_items.order_id > orders.id",
      "order_items.product_id > products.id",
      "orders.customer_id > customers.id",
    ]);
    const items = model!.tables.find((t) => t.name === "order_items")!;
    expect(items.fields.filter((f) => f.pk).map((f) => f.name)).toEqual(["order_id", "product_id"]);
  });

  it("handles awkward names, types and composite keys", async () => {
    await db.exec(`CREATE SCHEMA odd;
      CREATE TABLE odd."Table" (id int, "Note" text, at timestamptz NOT NULL, tags text[], price numeric(10,2), PRIMARY KEY (id, at), UNIQUE ("Note", price));
      CREATE TABLE odd.child (id serial PRIMARY KEY, pid int, pat timestamptz, ref int UNIQUE, FOREIGN KEY (pid, pat) REFERENCES odd."Table"(id, at));`);
    const { model, errors } = parseDbml(await dbmlOf("odd"));
    expect(errors).toEqual([]);
    expect(model!.refs).toHaveLength(1);
    expect(model!.refs[0].from).toMatchObject({ table: "child", fields: ["pid", "pat"], many: true });
  });

  it("reports DBML errors with 1-based positions", () => {
    const { model, errors } = parseDbml("Table x {\n  id int [pk]\n}\nRef: x.id > y.id\n");
    expect(model).toBeNull();
    expect(errors[0]).toMatchObject({ line: 4 });
  });

  it("finds the tables a query uses", () => {
    expect(tablesInSql("SELECT * FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN order_items i USING (x)")).toEqual(["orders", "customers", "order_items"]);
  });
});

describe("design questions", () => {
  it.each(DESIGN_QUESTIONS.map((q) => [q.id, q] as const))("%s: model answer passes every check, starter doesn't", (_id, q) => {
    const answer = parseDbml(q.solution);
    expect(answer.errors).toEqual([]);
    for (const c of q.checks) expect(c.test(answer.model!), c.label).toBe(true);
    const starter = parseDbml(q.starter);
    expect(starter.errors).toEqual([]);
    expect(q.checks.every((c) => c.test(starter.model!))).toBe(false);
  });

  it("catches a many-to-many without a unique pair", () => {
    const q = DESIGN_QUESTIONS.find((d) => d.id === "design-blog-tags")!;
    const loose = q.solution.replace("    (post_id, tag_id) [pk]", "    post_id");
    const { model } = parseDbml(loose.replace("post_id int [ref: > posts.id]", "id int [pk]\n  post_id int [ref: > posts.id]"));
    expect(q.checks.find((c) => c.label.startsWith("Posts and tags"))!.test(model!)).toBe(false);
  });
});

describe("pasted DBML", () => {
  it("accepts non-breaking spaces", () => {
    expect(parseDbml("Table x {\n  id int [pk]\n}\n").errors).toEqual([]);
  });
});
