> 💡 **In one line:** an index is a sorted copy of one or more columns, with a pointer from each value back to its row, so Postgres can jump straight to the rows you ask for instead of reading the whole table. `EXPLAIN` shows you which way it chose, and why a query is slow.

## How a B-tree index works

Without an index, finding customer 42's orders means reading every row and checking it: a **sequential scan** (Seq Scan). With 1,500 orders that's quick; with 200 million it takes minutes.

Postgres's default index is a **B-tree** (balanced tree). It stores the indexed values in sorted order, in **pages**: fixed blocks of 8 KB, the unit Postgres reads from disk. Each page holds hundreds of keys, so the tree is shallow:

- the **root** page says which page to read next for each range of values;
- **internal** pages narrow the range further;
- **leaf** pages hold every value, in order, each with a pointer to its row in the table.

With about 300 keys per page, 3 levels reach 300 × 300 × 300 = 27 million rows, and 4 levels reach about 8 billion. So any single lookup reads 3 or 4 pages, however big the table is.

```steps btree-lookup
```

The shop already has these indexes:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'shop'
ORDER BY 1;
```

9 of them. Every primary key makes one automatically (`orders_pkey` on `orders.id`); `orders_customer_idx` and `orders_date_idx` were added by hand for common lookups.

**A B-tree helps with:** `=`, `<`, `>`, `BETWEEN`, `IN`, `ORDER BY` on the indexed column (it's already sorted), and text that starts with a fixed prefix (`LIKE 'abc%'`).

## Reading a plan with EXPLAIN

`EXPLAIN` shows the **plan**: the steps Postgres will take, chosen by its **planner** before running the query. `EXPLAIN ANALYZE` also runs the query and adds what really happened.

The shop's tables are tiny, so to see a real difference this example builds a table of 200,000 orders first (it takes a few seconds, and it's rolled back afterwards). Then it asks for one customer, before and after adding an index:

```sql
CREATE TABLE big_orders AS
SELECT i AS id,
       1 + (i * 7919) % 50000 AS customer_id,
       DATE '2025-01-01' + (i % 365) AS order_date
FROM generate_series(1, 200000) AS i;
ANALYZE big_orders;

EXPLAIN (ANALYZE, COSTS OFF) SELECT * FROM big_orders WHERE customer_id = 42;

CREATE INDEX big_orders_customer_idx ON big_orders (customer_id);

EXPLAIN (ANALYZE, COSTS OFF) SELECT * FROM big_orders WHERE customer_id = 42;
```

How to read the two plans:

| | Before the index | After |
| --- | --- | --- |
| Node | `Seq Scan on big_orders` | `Bitmap Index Scan` on the index, then `Bitmap Heap Scan` on the table |
| Work | `Rows Removed by Filter: 199996`: it read every row to find 4 | went straight to the 4 rows |
| Pages read (`Buffers`) | 1,088: the whole 8.5 MB table | 7: 3 index pages, 4 table pages |
| `Execution Time` | about 15 ms on a laptop | about 0.1 ms |

The timings depend on your device; the row and page counts don't. A plan is a tree: read it from the most indented line outwards. Each line is a **node**, and its children feed it rows.

The words you'll meet:

| Node | Means |
| --- | --- |
| `Seq Scan` | read the whole table, page by page |
| `Index Scan` | walk the index, and read each matching row from the table |
| `Index Only Scan` | everything the query needs is in the index: the table isn't read |
| `Bitmap Index Scan` + `Bitmap Heap Scan` | collect all matching pointers first, sort them by page, then read each page once (good for a medium number of rows) |
| `Sort`, `HashAggregate`, `Limit` | sorting, grouping with a hash table, stopping early |

Without `ANALYZE`, `EXPLAIN` shows the planner's **estimates**: `cost=4.34..14.50 rows=8`. Cost is in made-up units (roughly "page reads"); the first number is the cost before the first row comes out, the second the cost for all rows. If the estimated `rows` is far from the actual rows, the planner's statistics are out of date: run `ANALYZE`.

## Why Postgres sometimes ignores your index

The planner picks the plan it estimates is cheapest. An index isn't always cheaper:

```sql
CREATE TABLE big_orders AS
SELECT i AS id,
       (ARRAY['pending','delivered','delivered','delivered','delivered',
              'delivered','delivered','delivered','delivered','cancelled'])[1 + i % 10] AS status
FROM generate_series(1, 200000) AS i;
CREATE INDEX ON big_orders (status);
ANALYZE big_orders;

EXPLAIN SELECT * FROM big_orders WHERE status = 'delivered';
EXPLAIN SELECT * FROM big_orders WHERE status = 'pending';
```

- 80% of rows are delivered. Jumping from the index to the table 160,000 times is slower than reading the table straight through, so the first plan is a **Seq Scan**.
- 10% are pending. Now the index pays off: a **Bitmap** scan.

How many rows a condition keeps is its **selectivity**. Indexes help most when a condition keeps a small share of the rows.

An index is also ignored when the query hides the column:

| Query | Uses an index on `email`? | Fix |
| --- | --- | --- |
| `WHERE lower(email) = 'x'` | no: the index holds `email`, not `lower(email)` | an **expression index**: `CREATE INDEX ON customers (lower(email))` |
| `WHERE customer_id + 0 = 42` | no | write `customer_id = 42` |
| `WHERE email LIKE '%gmail.com'` | no: the start of the text is unknown | a trigram index (`pg_trgm`), or store the domain in its own column |
| `WHERE created_at::date = '2025-03-01'` | no | `WHERE created_at >= '2025-03-01' AND created_at < '2025-03-02'` |

## Composite indexes and the leftmost-prefix rule

A **composite index** covers several columns, sorted by the first, then by the second within each first value: like a phone book sorted by surname, then first name.

```sql
CREATE TABLE big_orders AS
SELECT i AS id,
       1 + (i * 7919) % 50000 AS customer_id,
       DATE '2025-01-01' + (i % 365) AS order_date
FROM generate_series(1, 200000) AS i;
CREATE INDEX big_cd ON big_orders (customer_id, order_date);
ANALYZE big_orders;

EXPLAIN SELECT * FROM big_orders WHERE customer_id = 42 AND order_date >= '2025-06-01';
EXPLAIN SELECT * FROM big_orders WHERE order_date = '2025-06-01';
EXPLAIN SELECT order_date FROM big_orders WHERE customer_id = 42 ORDER BY order_date DESC LIMIT 3;
```

| Query | Plan | Why |
| --- | --- | --- |
| customer 42, from June | index, both columns in `Index Cond` | one customer's orders sit together, already sorted by date |
| a date, any customer | **Seq Scan** | dates are only in order *inside* each customer: like finding every "Priya" in a surname-sorted phone book |
| customer 42's 3 latest dates | `Index Only Scan Backward`, no Sort | read the end of customer 42's section backwards; the index holds both columns, so the table isn't touched |

This is the **leftmost-prefix rule**: an index on `(a, b, c)` helps queries that filter on `a`, or `a` and `b`, or all three, but not on `b` alone.

- Put columns tested with `=` first, and the range or sort column (`>=`, `ORDER BY`) last.
- One index on `(customer_id, order_date)` also serves `WHERE customer_id = ?` alone, so you don't need a second index on `customer_id`.

## Covering, partial and expression indexes

| Kind | Example | Use it when |
| --- | --- | --- |
| **Covering** | `CREATE INDEX ON orders (customer_id) INCLUDE (status)` | a hot query reads a few extra columns: they ride along in the index, so Postgres can do an index-only scan |
| **Partial** | `CREATE INDEX ON orders (order_date) WHERE status = 'pending'` | you only ever query a small slice: 150 pending orders, not all 1,500. Smaller and faster |
| **Expression** | `CREATE INDEX ON customers (lower(email))` | the query filters on a calculation |
| **Unique** | `CREATE UNIQUE INDEX ON customers (lower(email))` | you need uniqueness on a calculation, such as case-insensitive emails |

Other index types, for other kinds of data:

| Type | For |
| --- | --- |
| **GIN** (generalized inverted index) | values that contain many items: `JSONB` documents, arrays, full-text search |
| **GiST** | geometry, ranges, nearest-neighbour search |
| **BRIN** (block range index) | huge tables whose rows arrive in order (logs by time): it stores the min and max per block range, so it's tiny |
| **Hash** | equality only; a B-tree usually does as well |

## What indexes cost

Every index is updated on every `INSERT`, on every `UPDATE` of its columns, and on every `DELETE`. Each one also takes disk space and memory: in the first example, the index on 200,000 customer ids is 2.4 MB, next to an 8.5 MB table: more than a quarter of its size, for one column.

So add indexes for the queries you actually run, check with `EXPLAIN` that they're used, and drop the ones that aren't (`pg_stat_user_indexes` shows how often each is used). A table with 15 indexes writes slowly.

## Join algorithms

Postgres joins two inputs in one of three ways, and `EXPLAIN` names which:

| Algorithm | How | Good when |
| --- | --- | --- |
| **Nested loop** | for each row on one side, look up matches on the other (ideally through an index) | one side is small: "customer 7 and their orders" |
| **Hash join** | build a hash table from the smaller side, then stream the bigger side through it | big inputs, equality conditions, no useful order |
| **Merge join** | sort both sides by the key (or read them already sorted from indexes), then walk them together like a zip | both sides are already sorted, as by a primary key |

```sql
EXPLAIN SELECT c.name, o.id
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.id = 7;
```

A **Nested Loop**: one customer, then an index lookup for their 8 orders. Remove the `WHERE` and group by city, and the plan becomes a **Hash Join**: every customer meets every order, so one pass with a hash table is cheaper than 203 lookups.

## N+1 queries and pagination

**N+1 queries** is a slowness that comes from application code, not SQL. A page lists 50 orders with one query, then runs one more query per order to fetch its customer: 1 + 50 = 51 round trips to the database. Each is fast, but together they're slow. Fetch everything in one query with a join, or with `WHERE customer_id IN (…)`.

**Pagination**: `OFFSET` still reads every skipped row.

```sql
CREATE TABLE big_orders AS
SELECT i AS id FROM generate_series(1, 200000) AS i;
ALTER TABLE big_orders ADD PRIMARY KEY (id);
ANALYZE big_orders;

EXPLAIN (ANALYZE, COSTS OFF) SELECT id FROM big_orders ORDER BY id LIMIT 20 OFFSET 150000;
EXPLAIN (ANALYZE, COSTS OFF) SELECT id FROM big_orders WHERE id > 150000 ORDER BY id LIMIT 20;
```

The first reads 150,020 rows to return 20. The second, **keyset pagination**, remembers the last id the user saw and asks for the rows after it: the index jumps straight there and reads 20. The deeper the page, the bigger the gap. The cost of keyset pagination: no "jump to page 400", only next and previous.

## Mistakes to avoid

> ⚠️ **An index on every column "just in case"**: writes slow down and most go unused. Index what your queries filter, join and sort on.

> ⚠️ **Wrapping the column in a function** (`lower(email)`, `created_at::date`): the plain index can't be used. Index the expression, or rewrite the condition.

> ⚠️ **A composite index in the wrong order**: `(order_date, customer_id)` doesn't help "one customer's recent orders" much. Equality columns first.

> ⚠️ **Trusting `EXPLAIN` estimates on stale statistics**: after a big load, run `ANALYZE`.

> ⚠️ **Deep `OFFSET` pages**: page 5,000 reads 100,000 rows. Use keyset pagination.

## Interview questions

**Q: How does an index make a query faster, and when doesn't it?**

A B-tree keeps the column sorted in a shallow tree, so a lookup reads 3–4 pages instead of the whole table. It doesn't help when the query keeps a large share of the rows (a sequential read is cheaper), when the column is wrapped in a function, or for `LIKE '%…'`. Every index also slows writes.

**Q: You have an index on `(customer_id, order_date)`. Which queries use it?**

`WHERE customer_id = ?`, `WHERE customer_id = ? AND order_date > ?`, and `WHERE customer_id = ? ORDER BY order_date`. Not `WHERE order_date = ?` alone: dates are only sorted inside each customer.

**Q: A query is slow. What do you do?**

Run `EXPLAIN ANALYZE` and find the node where most time goes. Look for a Seq Scan on a big table with a selective filter (add an index), estimates far from actual rows (run `ANALYZE`), a big Sort (an index in that order can remove it), or a nested loop over many rows. Fix one thing, then measure again.

**Q: OFFSET pagination is slow on page 1000. Why, and what instead?**

`OFFSET 20000` reads and throws away 20,000 rows every time. Keyset pagination (`WHERE id > last_seen_id ORDER BY id LIMIT 20`) jumps straight to the right place through the index.
