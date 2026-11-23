/**
 * Step-through walkthroughs for the lessons, in the spirit of designedtoscale.app: press Next
 * and watch a query work, one step at a time. A lesson shows one with a fence:
 *
 *   ```steps join-left
 *   ```
 *
 * Each walkthrough uses a few real rows of the shop data. Its `sql` returns exactly the final
 * result on the real data, and `npm test` (lessons.test.ts) checks that it does, so the
 * animation can't drift from what Postgres would really do.
 */

export type Cell = string | number | null;
/** How a row is drawn: the one being looked at, a match, kept, dropped, just added… */
export type RowState = "idle" | "active" | "match" | "keep" | "drop" | "new" | "dim";

export interface StepRow {
  cells: Cell[];
  state?: RowState;
  /** Colour band for rows that belong together (a group, a partition, a streak). */
  group?: number;
  /** A short note beside the row: "150000 > 1649 ✓". */
  note?: string;
}

export interface StepTable {
  title: string;
  columns: string[];
  rows: StepRow[];
}

export interface Frame {
  /** What happens in this step, in one or two sentences. */
  caption: string;
  /** The part of the SQL this step is about, highlighted in the query. */
  clause?: string;
  tables: StepTable[];
}

export interface Walkthrough {
  id: string;
  title: string;
  sql: string;
  frames: Frame[];
  /** The rows the last frame's last table shows, which `sql` must return on the shop data. */
  result: Cell[][];
  /** Whether the order of `result` counts. */
  ordered: boolean;
}

const fmt = (n: number) => Math.round(n * 100) / 100;
const last = <T>(xs: T[]) => xs[xs.length - 1];

// ---------- WHERE: keep or drop each row ----------

function whereFilter(): Walkthrough {
  const products: [string, string, number][] = [
    ["Wireless Mouse", "Electronics", 1299],
    ["Designing Data-Intensive Applications", "Books", 1899],
    ["SQL Performance Explained", "Books", 1499],
    ["Database Internals", "Books", 2199],
    ["Clean Code", "Books", 999],
    ["Desk Lamp", "Furniture", 1999],
  ];
  const ids = [2, 6, 7, 8, 9, 12];
  const sql = `SELECT name, price\nFROM products\nWHERE category = 'Books' AND price < 2000\n  AND id IN (${ids.join(", ")})\nORDER BY id;`;
  const frames: Frame[] = [];
  const kept: StepRow[] = [];
  const states: RowState[] = products.map(() => "idle");
  const notes: (string | undefined)[] = products.map(() => undefined);
  const table = (): StepTable => ({
    title: "products",
    columns: ["name", "category", "price"],
    rows: products.map((p, i) => ({ cells: p, state: states[i], note: notes[i] })),
  });
  frames.push({ caption: "FROM: Postgres starts with every row of products (6 of them here).", clause: "FROM products", tables: [table(), { title: "Result", columns: ["name", "price"], rows: [] }] });
  products.forEach(([name, category, price], i) => {
    const books = category === "Books";
    const cheap = price < 2000;
    const ok = books && cheap;
    states[i] = "active";
    notes[i] = `${books ? "Books ✓" : `${category} ✗`} · ${price} < 2000 ${cheap ? "✓" : "✗"}`;
    if (ok) kept.push({ cells: [name, price], state: "new" });
    frames.push({
      caption: ok
        ? `${name}: a book, and ${price} is under 2000. Both parts are true, so the row is kept.`
        : books
          ? `${name}: a book, but ${price} isn't under 2000. AND needs both parts true, so it's dropped.`
          : `${name}: ${category}, not Books. The first part is false, so AND is false: dropped.`,
      clause: "WHERE category = 'Books' AND price < 2000",
      tables: [table(), { title: "Result", columns: ["name", "price"], rows: kept.map((r) => ({ ...r })) }],
    });
    states[i] = ok ? "keep" : "drop";
    kept.forEach((r) => (r.state = "idle"));
  });
  frames.push({ caption: `SELECT keeps only name and price. ${kept.length} of the ${products.length} rows passed.`, clause: "SELECT name, price", tables: [table(), { title: "Result", columns: ["name", "price"], rows: kept }] });
  return { id: "where-filter", title: "WHERE, one row at a time", sql, frames, result: kept.map((r) => r.cells), ordered: true };
}

// ---------- NULL: = NULL vs IS NULL ----------

function nullCompare(): Walkthrough {
  const people: [string, string | null][] = [
    ["Kabir Singh", null],
    ["Divya Pillai", null],
    ["Tara Bose", "tara@shop.dev"],
    ["Neha Joshi", "neha@shop.dev"],
  ];
  const ids = [5, 10, 11, 15];
  const sql = `-- The wrong way\nSELECT name FROM employees\nWHERE email = NULL AND id IN (${ids.join(", ")});\n\n-- The right way\nSELECT name FROM employees\nWHERE email IS NULL AND id IN (${ids.join(", ")})\nORDER BY id;`;
  const rows = (test: "eq" | "is", upto: number): StepRow[] =>
    people.map(([name, email], i) => {
      if (i > upto) return { cells: [name, email] };
      const v = test === "eq" ? (email === null ? "unknown" : "false") : email === null ? "true" : "false";
      return { cells: [name, email], state: i === upto ? "active" : v === "true" ? "keep" : "drop", note: test === "eq" ? `email = NULL → ${v}` : `email IS NULL → ${v}` };
    });
  const frames: Frame[] = [
    { caption: "Four employees; two have no email (NULL). First, the wrong way: WHERE email = NULL.", clause: "email = NULL", tables: [{ title: "employees", columns: ["name", "email"], rows: rows("eq", -1) }] },
    ...people.map((p, i): Frame => ({
      caption:
        p[1] === null
          ? `${p[0]}: is an unknown email equal to an unknown value? Nobody knows: the answer is unknown, and WHERE drops unknown rows.`
          : `${p[0]}: is '${p[1]}' equal to an unknown value? Also unknown. Every row gives unknown.`,
      clause: "email = NULL",
      tables: [{ title: "employees", columns: ["name", "email"], rows: rows("eq", i) }],
    })),
    { caption: "Result of = NULL: no rows at all, though two emails are missing.", clause: "email = NULL", tables: [{ title: "employees", columns: ["name", "email"], rows: rows("eq", 3) }, { title: "Result", columns: ["name"], rows: [] }] },
    {
      caption: "Now IS NULL. It asks a different question, \"is there no value?\", and that has a true or false answer.",
      clause: "WHERE email IS NULL",
      tables: [{ title: "employees", columns: ["name", "email"], rows: rows("is", 3).map((r) => ({ ...r, state: r.state === "active" ? (r.cells[1] === null ? "keep" : "drop") : r.state })) }, { title: "Result", columns: ["name"], rows: [{ cells: ["Kabir Singh"], state: "new" }, { cells: ["Divya Pillai"], state: "new" }] }],
    },
  ];
  return { id: "null-compare", title: "= NULL vs IS NULL", sql, frames, result: [["Kabir Singh"], ["Divya Pillai"]], ordered: true };
}

// ---------- GROUP BY + HAVING ----------

const staff: { id: number; name: string; dept: number; salary: number }[] = [
  { id: 11, name: "Tara Bose", dept: 3, salary: 140000 },
  { id: 14, name: "Karan Malhotra", dept: 4, salary: 160000 },
  { id: 17, name: "Pooja Reddy", dept: 5, salary: 100000 },
  { id: 12, name: "Ishaan Gupta", dept: 3, salary: 90000 },
  { id: 15, name: "Neha Joshi", dept: 4, salary: 125000 },
  { id: 18, name: "Manish Verma", dept: 5, salary: 60000 },
  { id: 13, name: "Zoya Ahmed", dept: 3, salary: 85000 },
  { id: 16, name: "Aditya Kulkarni", dept: 4, salary: 125000 },
  { id: 19, name: "Sana Qureshi", dept: 5, salary: 60000 },
  { id: 20, name: "Rahul Jain", dept: 5, salary: 55000 },
];
const DEPT_GROUP: Record<number, number> = { 3: 1, 4: 2, 5: 3 };

function groupBy(): Walkthrough {
  const sql = `SELECT department_id, COUNT(*) AS people, SUM(salary) AS payroll\nFROM employees\nWHERE department_id IN (3, 4, 5)\nGROUP BY department_id\nHAVING COUNT(*) >= 4;`;
  const raw = (grouped: boolean): StepTable => ({
    title: "employees",
    columns: ["name", "department_id", "salary"],
    rows: (grouped ? [...staff].sort((a, b) => a.dept - b.dept) : staff).map((e) => ({ cells: [e.name, e.dept, e.salary], group: grouped ? DEPT_GROUP[e.dept] : undefined })),
  });
  const depts = [3, 4, 5].map((d) => {
    const rows = staff.filter((e) => e.dept === d);
    return { d, n: rows.length, sum: rows.reduce((s, e) => s + e.salary, 0) };
  });
  const groups = (having: boolean): StepTable => ({
    title: "One row per group",
    columns: ["department_id", "people", "payroll"],
    rows: depts.map((g) => ({ cells: [g.d, g.n, g.sum], group: DEPT_GROUP[g.d], state: having ? (g.n >= 4 ? "keep" : "drop") : "new", note: having ? `COUNT(*) = ${g.n} ${g.n >= 4 ? "≥ 4 ✓" : "< 4 ✗"}` : undefined })),
  });
  const kept = depts.filter((g) => g.n >= 4);
  return {
    id: "group-by",
    title: "GROUP BY, then HAVING",
    sql,
    frames: [
      { caption: "10 employees from three departments, in no particular order.", clause: "FROM employees", tables: [raw(false)] },
      { caption: "GROUP BY department_id puts rows with the same department_id side by side: 3 is Marketing, 4 is Finance, 5 is Support.", clause: "GROUP BY department_id", tables: [raw(true)] },
      {
        caption: `Each group becomes one row. COUNT(*) counts its rows; SUM(salary) adds its salaries: Finance is ${depts[1].sum}.`,
        clause: "SELECT department_id, COUNT(*) AS people, SUM(salary) AS payroll",
        tables: [raw(true), groups(false)],
      },
      { caption: "HAVING runs on the groups. Only Support has 4 or more people; the others are dropped.", clause: "HAVING COUNT(*) >= 4", tables: [groups(true)] },
      { caption: "The result: one row, for department 5.", tables: [{ title: "Result", columns: ["department_id", "people", "payroll"], rows: kept.map((g) => ({ cells: [g.d, g.n, g.sum], group: DEPT_GROUP[g.d], state: "new" as RowState })) }] },
    ],
    result: kept.map((g) => [g.d, g.n, g.sum]),
    ordered: false,
  };
}

// ---------- The order a query runs in ----------

function queryOrder(): Walkthrough {
  const sql = `SELECT department_id, COUNT(*) AS people, ROUND(AVG(salary)) AS avg_salary\nFROM employees\nWHERE department_id IN (3, 4, 5) AND salary >= 60000\nGROUP BY department_id\nHAVING COUNT(*) >= 3\nORDER BY avg_salary DESC\nLIMIT 2;`;
  const all: StepTable = { title: "1. FROM employees (these 10)", columns: ["name", "dept", "salary"], rows: staff.map((e) => ({ cells: [e.name, e.dept, e.salary] })) };
  const where: StepTable = {
    title: "2. WHERE salary >= 60000",
    columns: ["name", "dept", "salary"],
    rows: staff.map((e) => ({ cells: [e.name, e.dept, e.salary], state: e.salary >= 60000 ? "keep" : "drop", note: e.salary >= 60000 ? undefined : "55000 < 60000" })),
  };
  const kept = staff.filter((e) => e.salary >= 60000).sort((a, b) => a.dept - b.dept);
  const grouped: StepTable = { title: "3. GROUP BY department_id", columns: ["name", "dept", "salary"], rows: kept.map((e) => ({ cells: [e.name, e.dept, e.salary], group: DEPT_GROUP[e.dept] })) };
  const agg = [3, 4, 5].map((d) => {
    const rows = kept.filter((e) => e.dept === d);
    return { d, n: rows.length, avg: Math.round(rows.reduce((s, e) => s + e.salary, 0) / rows.length) };
  });
  const having: StepTable = {
    title: "4–5. HAVING COUNT(*) >= 3, then SELECT",
    columns: ["department_id", "people", "avg_salary"],
    rows: agg.map((g) => ({ cells: [g.d, g.n, g.avg], group: DEPT_GROUP[g.d], state: g.n >= 3 ? "keep" : "drop" })),
  };
  const sorted = agg.filter((g) => g.n >= 3).sort((a, b) => b.avg - a.avg);
  const ordered: StepTable = { title: "6. ORDER BY avg_salary DESC", columns: ["department_id", "people", "avg_salary"], rows: sorted.map((g) => ({ cells: [g.d, g.n, g.avg], group: DEPT_GROUP[g.d] })) };
  const limited: StepTable = {
    title: "7. LIMIT 2: the result",
    columns: ["department_id", "people", "avg_salary"],
    rows: sorted.map((g, i) => ({ cells: [g.d, g.n, g.avg], group: DEPT_GROUP[g.d], state: i < 2 ? "new" : "drop" })),
  };
  const top = sorted.slice(0, 2);
  return {
    id: "query-order",
    title: "The order a query really runs in",
    sql,
    frames: [
      { caption: "You write SELECT first, but Postgres starts with FROM: these 10 employees (the WHERE's department test picked them).", clause: "FROM employees", tables: [all] },
      { caption: "WHERE drops single rows. Rahul Jain earns 55000, under 60000, so he's gone before any grouping.", clause: "salary >= 60000", tables: [where] },
      { caption: "GROUP BY makes one group per department. Support now has 3 people, not 4.", clause: "GROUP BY department_id", tables: [grouped] },
      { caption: `HAVING tests each group: all three have 3 people, so all stay. Then SELECT works out the averages: Finance ${agg[1].avg}, Marketing ${agg[0].avg}, Support ${agg[2].avg}.`, clause: "HAVING COUNT(*) >= 3", tables: [having] },
      { caption: "ORDER BY sorts the groups by the average SELECT just made. It can use the alias avg_salary because it runs after SELECT.", clause: "ORDER BY avg_salary DESC", tables: [ordered] },
      { caption: "LIMIT runs last and keeps the first 2 rows.", clause: "LIMIT 2", tables: [limited, { title: "Result", columns: ["department_id", "people", "avg_salary"], rows: top.map((g) => ({ cells: [g.d, g.n, g.avg], group: DEPT_GROUP[g.d], state: "new" as RowState })) }] },
    ],
    result: top.map((g) => [g.d, g.n, g.avg]),
    ordered: true,
  };
}

// ---------- JOIN: inner and left ----------

const joinPeople: { id: number; name: string; dept: number | null }[] = [
  { id: 1, name: "Asha Rao", dept: 1 },
  { id: 7, name: "Arjun Menon", dept: 2 },
  { id: 11, name: "Tara Bose", dept: 3 },
  { id: 21, name: "Ananya Ghosh", dept: null },
];
const joinDepts: [number, string][] = [
  [1, "Engineering"],
  [2, "Sales"],
  [3, "Marketing"],
  [6, "Research"],
];

function join(kind: "inner" | "left"): Walkthrough {
  const keyword = kind === "inner" ? "JOIN" : "LEFT JOIN";
  const sql = `SELECT e.name, d.name AS department\nFROM employees e\n${keyword} departments d ON d.id = e.department_id\nWHERE e.id IN (1, 7, 11, 21)\nORDER BY e.id;`;
  const out: StepRow[] = [];
  const frames: Frame[] = [];
  const left = (active: number, done: number): StepTable => ({
    title: "employees e",
    columns: ["name", "department_id"],
    rows: joinPeople.map((p, i) => ({ cells: [p.name, p.dept], state: i === active ? "active" : i < done ? "dim" : "idle" })),
  });
  const right = (match: number | null, scanning: boolean): StepTable => ({
    title: "departments d",
    columns: ["id", "name"],
    rows: joinDepts.map(([id, name]) => ({ cells: [id, name], state: match === id ? "match" : scanning ? "idle" : "dim" })),
  });
  frames.push({ caption: `${keyword} takes each employee in turn and looks for departments where d.id = e.department_id.`, clause: `${keyword} departments d ON d.id = e.department_id`, tables: [left(-1, 0), right(null, true), { title: "Result", columns: ["name", "department"], rows: [] }] });
  joinPeople.forEach((p, i) => {
    const d = joinDepts.find(([id]) => id === p.dept);
    out.forEach((r) => (r.state = "idle"));
    if (d) out.push({ cells: [p.name, d[1]], state: "new" });
    else if (kind === "left") out.push({ cells: [p.name, null], state: "new" });
    frames.push({
      caption: d
        ? `${p.name} has department_id ${p.dept}. Department ${d[0]} matches, so one row goes to the result: ${p.name}, ${d[1]}.`
        : kind === "inner"
          ? `${p.name}'s department_id is NULL. NULL equals nothing, so no department matches, and an inner join keeps no row for her.`
          : `${p.name}'s department_id is NULL, so nothing matches. A LEFT JOIN keeps her anyway, with NULL in the department's columns.`,
      clause: "ON d.id = e.department_id",
      tables: [left(i, i), right(d ? d[0] : null, false), { title: "Result", columns: ["name", "department"], rows: out.map((r) => ({ ...r })) }],
    });
  });
  out.forEach((r) => (r.state = "idle"));
  frames.push({
    caption:
      kind === "inner"
        ? "Done: 3 rows. Ananya (no department) and Research (no employees) are missing: an inner join keeps only pairs that match."
        : "Done: 4 rows, one per employee. Research still isn't here: LEFT keeps unmatched rows of the left table only. A FULL JOIN would add it.",
    tables: [left(-1, 4), right(null, false), { title: "Result", columns: ["name", "department"], rows: out }],
  });
  return { id: `join-${kind}`, title: kind === "inner" ? "INNER JOIN, row by row" : "LEFT JOIN, row by row", sql, frames, result: out.map((r) => r.cells), ordered: true };
}

// ---------- Fan-out ----------

function fanOut(): Walkthrough {
  const lines: [number, number, number][] = [
    [5, 4, 14999],
    [7, 1, 1499],
    [9, 2, 999],
  ];
  const sql = `SELECT o.id, o.customer_id, oi.product_id, oi.quantity\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nWHERE o.id = 2\nORDER BY oi.product_id;`;
  const order: StepTable = { title: "orders", columns: ["id", "customer_id", "status"], rows: [{ cells: [2, 75, "delivered"], state: "active" }] };
  const items = (k: number): StepTable => ({ title: "order_items", columns: ["order_id", "product_id", "quantity"], rows: lines.map(([p, q], i) => ({ cells: [2, p, q], state: i === k ? "match" : i < k ? "dim" : "idle" })) });
  const result = (k: number): StepTable => ({ title: "Result", columns: ["id", "customer_id", "product_id", "quantity"], rows: lines.slice(0, k + 1).map(([p, q], i) => ({ cells: [2, 75, p, q], group: 1, state: i === k ? "new" : "idle" })) });
  return {
    id: "fan-out",
    title: "How a join repeats rows",
    sql,
    frames: [
      { caption: "One order: number 2, placed by customer 75.", clause: "FROM orders o", tables: [order, items(-1)] },
      ...lines.map((_, k): Frame => ({
        caption: k === 0 ? "Its first line matches, so the order appears once in the result…" : k === 1 ? "…the second line matches too, so the same order appears again…" : "…and a third time. One order has become 3 rows.",
        clause: "JOIN order_items oi ON oi.order_id = o.id",
        tables: [order, items(k), result(k)],
      })),
      {
        caption: "That's right for listing lines. But COUNT(*) here says 3 orders, not 1, and summing an order-level value would count it 3 times. Count COUNT(DISTINCT o.id), or aggregate the lines before joining.",
        tables: [result(2)],
      },
    ],
    result: lines.map(([p, q]) => [2, 75, p, q]),
    ordered: true,
  };
}

// ---------- Correlated subquery ----------

function correlated(): Walkthrough {
  const products: [string, string, number][] = [
    ["Designing Data-Intensive Applications", "Books", 1899],
    ["SQL Performance Explained", "Books", 1499],
    ["Database Internals", "Books", 2199],
    ["Clean Code", "Books", 999],
    ["Coffee Beans 1kg", "Grocery", 899],
    ["Green Tea 100 bags", "Grocery", 399],
    ["Protein Bars x12", "Grocery", 1199],
  ];
  const avg = (c: string) => {
    const ps = products.filter((p) => p[1] === c);
    return fmt(ps.reduce((s, p) => s + p[2], 0) / ps.length);
  };
  const sql = `SELECT name, price\nFROM products p\nWHERE category IN ('Books', 'Grocery')\n  AND price > (SELECT AVG(price) FROM products p2\n               WHERE p2.category = p.category)\nORDER BY id;`;
  const states: RowState[] = products.map(() => "idle");
  const notes: (string | undefined)[] = products.map(() => undefined);
  const table = (): StepTable => ({ title: "products p", columns: ["name", "category", "price"], rows: products.map((p, i) => ({ cells: p, state: states[i], note: notes[i], group: p[1] === "Books" ? 1 : 2 })) });
  const frames: Frame[] = [{ caption: "For every outer row, the inner query runs again with that row's category: p.category changes each time.", clause: "WHERE p2.category = p.category", tables: [table()] }];
  products.forEach(([name, category, price], i) => {
    const a = avg(category);
    states[i] = "active";
    notes[i] = `${price} > ${a} ${price > a ? "✓" : "✗"}`;
    frames.push({
      caption: `${name} is in ${category}, so the inner query averages the ${category} prices: ${a}. ${price} ${price > a ? ">" : "is not more than"} ${a}, so it's ${price > a ? "kept" : "dropped"}.`,
      clause: "price > (SELECT AVG(price) FROM products p2",
      tables: [table()],
    });
    states[i] = price > a ? "keep" : "drop";
  });
  const kept = products.filter((p) => p[2] > avg(p[1]));
  frames.push({ caption: "Each product was compared with its own category's average: 4 of 7 are above it.", tables: [table(), { title: "Result", columns: ["name", "price"], rows: kept.map((p) => ({ cells: [p[0], p[2]], state: "new" as RowState })) }] });
  // The result in id order: products 6, 8 (books) and 13, 15 (grocery).
  const order = ["Designing Data-Intensive Applications", "Database Internals", "Coffee Beans 1kg", "Protein Bars x12"];
  return { id: "correlated", title: "A correlated subquery, row by row", sql, frames, result: order.map((n) => { const p = kept.find((x) => x[0] === n)!; return [p[0], p[2]]; }), ordered: true };
}

// ---------- Recursive CTE ----------

function recursive(): Walkthrough {
  const emp: [number, string, number | null][] = [
    [1, "Asha Rao", null],
    [2, "Vikram Shah", 1],
    [3, "Meera Iyer", 2],
    [4, "Rohan Das", 2],
    [6, "Nisha Kapoor", 3],
  ];
  const sql = `WITH RECURSIVE chain AS (\n  SELECT id, name, manager_id, 0 AS depth\n  FROM employees WHERE id = 6\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id, c.depth + 1\n  FROM employees e JOIN chain c ON e.id = c.manager_id\n)\nSELECT name, depth FROM chain;`;
  const found: StepRow[] = [];
  const frames: Frame[] = [];
  const table = (active: number | null): StepTable => ({ title: "employees", columns: ["id", "name", "manager_id"], rows: emp.map(([id, n, m]) => ({ cells: [id, n, m], state: id === active ? "match" : found.some((f) => f.cells[0] === n) ? "dim" : "idle" })) });
  let current = emp.find((e) => e[0] === 6)!;
  let depth = 0;
  found.push({ cells: [current[1], depth], state: "new" });
  frames.push({ caption: "The anchor runs once: the row with id 6, Nisha Kapoor, at depth 0.", clause: "SELECT id, name, manager_id, 0 AS depth", tables: [table(6), { title: "chain", columns: ["name", "depth"], rows: found.map((r) => ({ ...r })) }] });
  while (current[2] !== null) {
    const next = emp.find((e) => e[0] === current[2])!;
    depth += 1;
    found.forEach((r) => (r.state = "idle"));
    found.push({ cells: [next[1], depth], state: "new" });
    frames.push({
      caption: `Round ${depth}: the last row found was ${current[1]}, whose manager_id is ${current[2]}. The join finds employee ${next[0]}, ${next[1]}, at depth ${depth}.`,
      clause: "JOIN chain c ON e.id = c.manager_id",
      tables: [table(next[0]), { title: "chain", columns: ["name", "depth"], rows: found.map((r) => ({ ...r })) }],
    });
    current = next;
  }
  found.forEach((r) => (r.state = "idle"));
  frames.push({ caption: "Round 4: Asha Rao's manager_id is NULL, so the join finds nothing. No new rows: the recursion stops.", tables: [table(null), { title: "chain", columns: ["name", "depth"], rows: found }] });
  return { id: "recursive-chain", title: "WITH RECURSIVE, round by round", sql, frames, result: found.map((r) => r.cells), ordered: false };
}

// ---------- ROW_NUMBER / RANK / DENSE_RANK ----------

function ranks(): Walkthrough {
  const eng: [string, number][] = [
    ["Asha Rao", 250000],
    ["Vikram Shah", 180000],
    ["Meera Iyer", 150000],
    ["Rohan Das", 150000],
    ["Kabir Singh", 120000],
    ["Nisha Kapoor", 95000],
  ];
  const sql = `SELECT name, salary,\n       ROW_NUMBER() OVER (ORDER BY salary DESC, name) AS row_number,\n       RANK()       OVER (ORDER BY salary DESC) AS rank,\n       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank\nFROM employees\nWHERE department_id = 1\nORDER BY salary DESC, name;`;
  const computed: Cell[][] = [];
  let rank = 0;
  let dense = 0;
  eng.forEach(([n, s], i) => {
    const tie = i > 0 && eng[i - 1][1] === s;
    if (!tie) {
      rank = i + 1;
      dense += 1;
    }
    computed.push([n, s, i + 1, rank, dense]);
  });
  const table = (upto: number): StepTable => ({
    title: "Engineering, sorted by salary",
    columns: ["name", "salary", "row_number", "rank", "dense_rank"],
    rows: computed.map((r, i) => ({ cells: i <= upto ? r : [r[0], r[1], "", "", ""], state: i === upto ? "active" : "idle", group: i === 2 || i === 3 ? 1 : undefined })),
  });
  const captions = [
    "Asha Rao has the highest salary: 1 in all three columns.",
    "Vikram Shah: 2 everywhere. No ties yet, so the three functions agree.",
    "Meera Iyer, 150000: number 3 in all three columns.",
    "Rohan Das also earns 150000: a tie. ROW_NUMBER still gives a new number (4); RANK and DENSE_RANK give the tie the same place, 3.",
    "Kabir Singh, the next salary. RANK jumps to 5, because 4 people are ahead of him. DENSE_RANK takes the next number, 4: no gap.",
    "Nisha Kapoor: 6, 6 and 5. \"3rd highest distinct salary\" means DENSE_RANK = 3: Meera and Rohan.",
  ];
  return {
    id: "rank-functions",
    title: "ROW_NUMBER, RANK and DENSE_RANK side by side",
    sql,
    frames: [
      { caption: "Engineering's six salaries, sorted from highest. Watch what each function does at the tie.", clause: "OVER (ORDER BY salary DESC", tables: [table(-1)] },
      ...captions.map((c, i): Frame => ({ caption: c, clause: i === 3 ? "RANK()" : undefined, tables: [table(i)] })),
    ],
    result: computed,
    ordered: true,
  };
}

// ---------- Running total and moving average ----------

function runningTotal(): Walkthrough {
  const days: [string, number][] = [
    ["2025-01-01", 127591],
    ["2025-01-02", 164778],
    ["2025-01-03", 24985],
    ["2025-01-04", 103686],
    ["2025-01-05", 186978],
  ];
  const sql = `WITH daily AS (\n  SELECT o.order_date AS day, SUM(oi.quantity * oi.unit_price) AS revenue\n  FROM orders o JOIN order_items oi ON oi.order_id = o.id\n  WHERE o.status = 'delivered' AND o.order_date <= DATE '2025-01-05'\n  GROUP BY o.order_date\n)\nSELECT day, revenue,\n       SUM(revenue) OVER (ORDER BY day) AS running_total,\n       ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS avg_3_days\nFROM daily ORDER BY day;`;
  const rows: Cell[][] = [];
  let total = 0;
  days.forEach(([d, r], i) => {
    total += r;
    const win = days.slice(Math.max(0, i - 2), i + 1);
    rows.push([d, r, total, fmt(win.reduce((s, x) => s + x[1], 0) / win.length)]);
  });
  const table = (upto: number): StepTable => ({
    title: "daily",
    columns: ["day", "revenue", "running_total", "avg_3_days"],
    rows: rows.map((r, i) => ({
      cells: i <= upto ? r : [r[0], r[1], "", ""],
      state: i === upto ? "active" : i < upto && i >= upto - 2 ? "match" : "idle",
    })),
  });
  return {
    id: "running-total",
    title: "A running total and a 3-day window",
    sql,
    frames: [
      { caption: "One row per day of delivered revenue (aggregated first, in the CTE).", clause: "WITH daily AS", tables: [table(-1)] },
      ...rows.map((r, i): Frame => ({
        caption:
          i === 0
            ? `1 Jan: the running total is just this day, ${r[2]}. The 3-day window holds only this row too.`
            : i === 1
              ? `2 Jan: running total ${rows[0][2]} + ${r[1]} = ${r[2]}. The window holds 2 days: average ${r[3]}.`
              : `${String(r[0]).slice(8)} Jan: running total ${r[2]}. The window is now this row and the 2 before it (lit up): average ${r[3]}. The oldest day slides out.`,
        clause: i < 2 ? "SUM(revenue) OVER (ORDER BY day)" : "ROWS BETWEEN 2 PRECEDING AND CURRENT ROW",
        tables: [table(i)],
      })),
    ],
    result: rows,
    ordered: true,
  };
}

// ---------- Gaps and islands ----------

function gapsIslands(): Walkthrough {
  const dates = ["2025-03-01", "2025-03-02", "2025-03-03", "2025-03-07", "2025-03-08", "2025-03-09", "2025-03-10", "2025-03-14", "2025-03-15", "2025-03-16", "2025-03-17"];
  const minus = (d: string, n: number) => {
    const t = new Date(d + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() - n);
    return t.toISOString().slice(0, 10);
  };
  const islands = dates.map((d, i) => minus(d, i + 1));
  const ids = [...new Set(islands)];
  const sql = `WITH g AS (\n  SELECT login_date,\n         login_date - (ROW_NUMBER() OVER (ORDER BY login_date))::int AS island\n  FROM logins\n  WHERE user_id = 1 AND login_date <= DATE '2025-03-17'\n)\nSELECT MIN(login_date) AS starts, MAX(login_date) AS ends, COUNT(*) AS days\nFROM g GROUP BY island ORDER BY starts;`;
  const table = (step: 0 | 1 | 2): StepTable => ({
    title: "customer 1's logins",
    columns: ["login_date", "rn", "login_date − rn"],
    rows: dates.map((d, i) => ({ cells: [d, step >= 1 ? i + 1 : "", step >= 2 ? islands[i] : ""], group: step >= 2 ? ids.indexOf(islands[i]) + 1 : undefined })),
  });
  const result = ids.map((id) => {
    const ds = dates.filter((_, i) => islands[i] === id);
    return [ds[0], last(ds), ds.length] as Cell[];
  });
  return {
    id: "gaps-islands",
    title: "Gaps and islands",
    sql,
    frames: [
      { caption: "Customer 1's first logins. You can see three runs of days, with gaps between them.", tables: [table(0)] },
      { caption: "ROW_NUMBER numbers the logins 1, 2, 3… in date order. Inside a run, the date and the number both go up by 1 each row.", clause: "ROW_NUMBER() OVER (ORDER BY login_date)", tables: [table(1)] },
      { caption: "Subtract the number from the date. Inside a run the result stays the same; after a gap the date jumps further than the number, so the result changes. Each value marks one island.", clause: "login_date - (ROW_NUMBER() OVER (ORDER BY login_date))::int", tables: [table(2)] },
      {
        caption: `GROUP BY that value: each group is a streak. Here: ${result.map((r) => `${r[2]} days`).join(", ")}.`,
        clause: "GROUP BY island",
        tables: [table(2), { title: "Result", columns: ["starts", "ends", "days"], rows: result.map((r, i) => ({ cells: r, group: i + 1, state: "new" as RowState })) }],
      },
    ],
    result,
    ordered: true,
  };
}

export const WALKTHROUGHS: Walkthrough[] = [whereFilter(), nullCompare(), groupBy(), queryOrder(), join("inner"), join("left"), fanOut(), correlated(), recursive(), ranks(), runningTotal(), gapsIslands()];

export const walkthroughById = (id: string) => WALKTHROUGHS.find((w) => w.id === id);
