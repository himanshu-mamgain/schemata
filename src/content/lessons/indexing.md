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

This is the **leftmost-prefix rule**: an index on `(a, b, c)` helps queries that filter on `a`, or `a` and `b`, or all three, but not on `b` alone (Postgres 18 sometimes can, with a skip scan: see below).

- Put columns tested with `=` first, and the range or sort column (`>=`, `ORDER BY`) last.
- One index on `(customer_id, order_date)` also serves `WHERE customer_id = ?` alone, so you don't need a second index on `customer_id`.
- The order of the conditions in `WHERE` doesn't matter: `c = 3 AND a = 7` is the same query as `a = 7 AND c = 3`. Only the order of the columns in the index does.

### Skipping a column: `a` and `c` on an `(a, b, c)` index

What if a query filters on `a` and `c`, but not `b`? This table has 200,000 rows: `a` has 20 values, `b` 100 and `c` 100. The index is on `(a, b, c)`:

```sql
CREATE TABLE t AS
SELECT i AS id, i % 20 AS a, (i / 20) % 100 AS b, (i / 2000) % 100 AS c
FROM generate_series(0, 199999) AS i;
CREATE INDEX t_abc ON t (a, b, c);
ANALYZE t;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM t WHERE a = 7 AND b = 42 AND c = 3;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM t WHERE a = 7 AND c = 3;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM t WHERE b = 42 AND c = 3;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM t WHERE c = 3;
```

Add up `hit` and `read` on the top `Buffers` line of each plan to get the pages it read (the whole table is 1,088 pages):

| Query | How the `(a, b, c)` index is used | Pages read |
| --- | --- | --- |
| `a = 7 AND b = 42 AND c = 3` | jumps straight to the 1 matching row | 4 |
| `a = 7 AND c = 3` | jumps to the start of `a = 7`, then reads all 10,000 of its entries and checks `c` on each. Only the 100 matches touch the table | 56 |
| `b = 42 AND c = 3` | **skip scan**: one search for each value of `a` (`Index Searches: 22`) | 68 |
| `c = 3` | not used: `Seq Scan` | 1,088 |

- **`a` and `c`**: the index still helps, but only `a` decides where to start. Inside `a = 7`, the entries are sorted by `b` first, so the `c = 3` entries are spread across all 100 values of `b`. `c` is checked inside the index, so rows that fail it cost no table reads.
- **No `a` at all**: Postgres 17 and older usually can't use the index. **Skip scan**, new in Postgres 18, searches once for each value of `a`: `(0, 42, 3)`, `(1, 42, 3)` … It pays off only when `a` has few values, like these 20.
- **A range on a middle column works like a gap.** In `a = 7 AND b > 50 AND c = 3`, `c` is only checked, never used to jump.

If `a` and `c` together is a common query, give it an index that starts with both:

```sql
CREATE TABLE t AS
SELECT i AS id, i % 20 AS a, (i / 20) % 100 AS b, (i / 2000) % 100 AS c
FROM generate_series(0, 199999) AS i;
CREATE INDEX t_acb ON t (a, c, b);
ANALYZE t;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM t WHERE a = 7 AND c = 3;
```

15 pages instead of 56: 3 index pages to reach `(7, 3)`, then the 12 table pages that hold the 100 rows.

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

In Postgres, each kind of write treats indexes differently:

- An `INSERT` adds an entry to **every** index on the table.
- An `UPDATE` writes a new version of the row (see [MVCC](/topics/internals#mvcc-vacuum-and-bloat)). Unless it's a **HOT update** (explained in [internals](/topics/internals#hot-updates-and-fillfactor)), every index gets a new entry, even the indexes on columns that didn't change.
- A `DELETE` doesn't touch the indexes at once. The row is only marked dead, and VACUUM removes its index entries later.

This inserts the same 50,000 rows into a table with no indexes, then into one with three, and measures how much the database had to write to its log:

```sql
CREATE TABLE mark AS SELECT pg_current_wal_insert_lsn() AS lsn;
CREATE TABLE no_index (id int, a int, b text, c date);
INSERT INTO no_index
SELECT i, i % 1000, md5(i::text), DATE '2025-01-01' + i % 365 FROM generate_series(1, 50000) AS i;
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), (SELECT lsn FROM mark))) AS written_with_no_index;

CREATE TABLE three_indexes (id int, a int, b text, c date);
CREATE INDEX ON three_indexes (a);
CREATE INDEX ON three_indexes (b);
CREATE INDEX ON three_indexes (c);
UPDATE mark SET lsn = pg_current_wal_insert_lsn();
INSERT INTO three_indexes
SELECT i, i % 1000, md5(i::text), DATE '2025-01-01' + i % 365 FROM generate_series(1, 50000) AS i;
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), (SELECT lsn FROM mark))) AS written_with_three;
```

About 5 MB without indexes, about 18 MB with three: more than three times the writing for the same rows. (`pg_current_wal_insert_lsn()` is the position in the write-ahead log, Postgres's record of every change; see [internals](/topics/internals#the-write-ahead-log-checkpoints-and-crash-recovery).)

Each index also takes disk space and memory: in the first example, the index on 200,000 customer ids is 2.4 MB, next to an 8.5 MB table: more than a quarter of its size, for one column.

So add indexes for the queries you actually run, check with `EXPLAIN` that they're used, and drop the ones that aren't (`pg_stat_user_indexes` shows how often each is used). A table with 15 indexes writes slowly.

## When an index makes a query slower

Adding an index can make things worse. The four usual reasons:

**1. A worse plan for `ORDER BY … LIMIT`.** A shop logs 200,000 events, one a minute. The last 2,000 are refunds. The newest 5 refunds, before and after an index on `created_at`:

```sql
CREATE TABLE events AS
SELECT i AS id,
       TIMESTAMP '2025-01-01' + i * INTERVAL '1 minute' AS created_at,
       CASE WHEN i > 198000 THEN 'refund' ELSE 'sale' END AS kind
FROM generate_series(1, 200000) AS i;
ANALYZE events;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT * FROM events WHERE kind = 'refund' ORDER BY created_at LIMIT 5;

CREATE INDEX events_created ON events (created_at);

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT * FROM events WHERE kind = 'refund' ORDER BY created_at LIMIT 5;
```

| | Plan | Rows looked at | Pages read |
| --- | --- | --- | --- |
| No index | `Seq Scan`, then a top-5 sort | 200,000 | 1,280 |
| Index on `created_at` | `Index Scan` in date order, stopping at 5 refunds | 198,005 (`Rows Removed by Filter: 198000`) | 1,805 |

The planner knows refunds are 1% of rows, and assumes they're spread evenly. So it expects 5 refunds within the first 500 or so events in date order, and walking the index looks cheap. But every refund is at the end. It walks almost the whole index, then reads the table in index order, and reads more pages than before. The fix is an index that matches the whole query: `CREATE INDEX ON events (kind, created_at)` goes straight to the first refund and reads 4 pages.

**2. Slower writes.** Every new index adds work to every insert, and to most updates (the measurement above). A table that takes many writes and few reads may be better off with fewer indexes.

**3. No more HOT updates.** An index on a column you update all the time (`stock`, `updated_at`, `view_count`) turns every update of that column into a full update of every index on the table. See [HOT updates](/topics/internals#hot-updates-and-fillfactor).

**4. Wrong estimates.** After a big change to the data, the statistics are out of date, and the planner may use the index for a filter that now matches half the table. Reading many rows through an index means jumping around the table, which costs more than reading it in order. Run `ANALYZE`, and compare estimated and actual rows in `EXPLAIN ANALYZE`.

To find which it is, run `EXPLAIN (ANALYZE, BUFFERS)` with and without the index (on a copy, or inside a transaction you roll back), and compare the pages read.

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

> ⚠️ **Adding an index without measuring**: it can make a query slower (an `ORDER BY … LIMIT` that walks the wrong index) and every write heavier. Check `EXPLAIN (ANALYZE, BUFFERS)` before and after.

## Interview questions

**Q: How does an index make a query faster, and when doesn't it?**

A B-tree keeps the column sorted in a shallow tree, so a lookup reads 3–4 pages instead of the whole table. It doesn't help when the query keeps a large share of the rows (a sequential read is cheaper), when the column is wrapped in a function, or for `LIKE '%…'`. Every index also slows writes.

**Q: You have an index on `(customer_id, order_date)`. Which queries use it?**

`WHERE customer_id = ?`, `WHERE customer_id = ? AND order_date > ?`, and `WHERE customer_id = ? ORDER BY order_date`. Not `WHERE order_date = ?` alone: dates are only sorted inside each customer.

**Q: A query is slow. What do you do?**

Run `EXPLAIN ANALYZE` and find the node where most time goes. Look for a Seq Scan on a big table with a selective filter (add an index), estimates far from actual rows (run `ANALYZE`), a big Sort (an index in that order can remove it), or a nested loop over many rows. Fix one thing, then measure again.

**Q: You have an index on `(a, b, c)` and query `WHERE a = ? AND c = ?`. Is the index used?**

Yes, but only `a` decides where to start: Postgres reads all of `a`'s entries and checks `c` on each, inside the index. Without `a`, older Postgres versions can't use it; Postgres 18's skip scan can, when `a` has few values. If `a` and `c` is a common query, index `(a, c, b)` or `(a, c)`.

**Q: A query got slower after you added an index. Why?**

Most often the planner chose the new index for an `ORDER BY … LIMIT`, expecting matches early, and had to walk most of it. Or the statistics are stale, or the index removed HOT updates and made writes heavier. Compare `EXPLAIN (ANALYZE, BUFFERS)` with and without it, and index the whole query: `(filter column, sort column)`.

**Q: OFFSET pagination is slow on page 1000. Why, and what instead?**

`OFFSET 20000` reads and throws away 20,000 rows every time. Keyset pagination (`WHERE id > last_seen_id ORDER BY id LIMIT 20`) jumps straight to the right place through the index.
