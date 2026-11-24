> 💡 **In one line:** under every query, a database reads and writes fixed-size pages, keeps copies of the busy ones in memory, writes every change to a log before touching the data, keeps old row versions so readers never wait, and guesses the cheapest plan from statistics. Knowing these explains most performance surprises.

## Pages and the buffer pool

Postgres stores each table as a file of **pages** (also called blocks): fixed chunks of 8 KB (8,192 bytes). A page holds as many rows as fit, plus a small header and a list of where each row starts. Postgres always reads and writes whole pages, never single rows.

```sql
SELECT current_setting('block_size') AS page_bytes;

SELECT relname AS table_name, relpages AS pages, reltuples::int AS rows,
       pg_size_pretty(pg_relation_size(oid)) AS size
FROM pg_class
WHERE relname IN ('products', 'orders', 'order_items', 'customers')
ORDER BY relpages DESC;
```

All 15 products fit in 1 page; the 3,000 order lines take 20 pages (160 kB). Every row has a hidden **ctid**: its address, as (page number, position in the page):

```sql
SELECT ctid, id, name FROM products ORDER BY id LIMIT 4;
```

The keyboard is at `(0,1)`: page 0, slot 1.

The **buffer pool** (`shared_buffers`, 128 MB by default) is Postgres's own memory cache of pages. A query first looks there; only a miss reads from disk (and the operating system has its own file cache below that). In `EXPLAIN (ANALYZE, BUFFERS)`, `shared hit` counts pages found in memory and `read` counts pages fetched from outside. A query that's slow the first time and fast the second is usually a cold cache warming up. When memory is full, the least-used pages are pushed out.

## B-trees and LSM trees

How a storage engine organises data decides whether it's faster at reads or writes.

**B-tree** (Postgres indexes, MySQL's InnoDB tables): keys sorted in pages arranged as a shallow tree (see [how a B-tree works](/topics/indexing#how-a-b-tree-index-works)). An update finds its page and changes it in place. Reads are quick and predictable; writes land in random places on disk.

**LSM tree** (log-structured merge tree: Cassandra, RocksDB, ScyllaDB):

1. A write goes to a log on disk (for crash safety) and to a sorted table in memory, the **memtable**.
2. When the memtable is full, it's written out as an immutable sorted file, an **SSTable** (sorted string table). Writes are always sequential, which is fast on any disk.
3. A read checks the memtable, then the SSTables from newest to oldest. A **Bloom filter** per file (a small structure that says "definitely not here" or "maybe here") skips most files.
4. In the background, **compaction** merges SSTables, keeping only the newest version of each key and dropping deletes.

| | B-tree | LSM tree |
| --- | --- | --- |
| Write | find the page, change it in place (random I/O) | append (sequential I/O): much faster |
| Read | one path down the tree | memtable, then possibly several files |
| Space and background work | free space inside pages; VACUUM in Postgres | old versions until compaction; compaction rewrites data many times (**write amplification**) |
| Best for | mixed reads and writes, range queries | write-heavy data: logs, events, time series, messages |

## The write-ahead log, checkpoints and crash recovery

Writing a changed page to its place on disk at every commit would be slow (random writes, 8 KB each time). Instead, Postgres writes a short record of each change to the **write-ahead log** (WAL): an append-only file. The rule in the name: the log record reaches disk **before** the change is considered committed.

1. `UPDATE` changes the page in the buffer pool (memory) and appends a WAL record.
2. `COMMIT` waits until the WAL is flushed to disk. That's the durability in ACID.
3. Later, a **checkpoint** writes all changed pages to their real places on disk, and older WAL can be recycled.
4. After a crash, Postgres starts from the last checkpoint and **replays** the WAL, redoing every committed change. Nothing committed is lost.

The log has a position, the **LSN** (log sequence number), which grows as records are added. This updates every order and measures how much WAL it wrote:

```sql
CREATE TABLE mark AS SELECT pg_current_wal_insert_lsn() AS lsn;
UPDATE orders SET status = status;
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), (SELECT lsn FROM mark))) AS wal_written;
```

About half a megabyte for an 80 kB table. Each of the 1,500 rows gets a new version (see MVCC below), and the first change to each page after a checkpoint logs the whole 8 KB page, to protect against a page only half-written during a crash.

The same log feeds **replication**: replicas receive the WAL stream and replay it (see [scaling](/topics/scaling#read-replicas-and-replication-lag)).

## MVCC, VACUUM and bloat

**MVCC** (multi-version concurrency control) lets readers and writers work at the same time without waiting for each other. An `UPDATE` never overwrites a row: it writes a **new version** and marks the old one as replaced. Each version carries:

- `xmin`: the id of the transaction that created it;
- `xmax`: the id of the transaction that deleted or replaced it (0 while it's current).

```sql
SELECT xmin, xmax, ctid, id, stock FROM products WHERE id = 1;
UPDATE products SET stock = stock - 1 WHERE id = 1;
SELECT xmin, xmax, ctid, id, stock FROM products WHERE id = 1;
```

After the update the row has a new `xmin` (this transaction) and a new `ctid`: it now lives in another slot of the page. The old version is still on the page, invisible to new transactions but kept for anyone who started earlier. Each transaction reads from a **snapshot**: it sees the versions committed before it started, and ignores newer ones. So a long report sees consistent data while others write, and nobody waits.

```steps mvcc-versions
```

The cost: old versions (**dead tuples**) take space until **VACUUM** marks it reusable. **Autovacuum** runs it in the background. When cleanup can't keep up, tables and indexes fill with dead rows and grow: **bloat**, which makes scans slower.

The classic cause: a transaction left open for hours (an idle session that ran `BEGIN` and never finished). VACUUM can't remove any version that transaction might still need to see, anywhere in the database. Find them in `pg_stat_activity` with `state = 'idle in transaction'`.

## HOT updates and fillfactor

A new row version needs index entries too: each index points at the row's exact place, its `ctid`. So an `UPDATE` that changes one column could mean a new entry in every index on the table. That's why people say "Postgres duplicates every row you update".

A **HOT update** (heap-only tuple) avoids it. When two things are true:

1. no indexed column changes, and
2. the new version fits on the **same page** as the old one,

Postgres writes the new version on that page and links the old version to it. The indexes keep pointing at the old place and follow the link. No index is touched.

`pg_stat_xact_user_tables` counts the updates in the current transaction, and how many were HOT. `stock` has no index, so all 15 are HOT:

```sql
CREATE TEMP TABLE seen AS
SELECT n_tup_upd AS upd, n_tup_hot_upd AS hot FROM pg_stat_xact_user_tables WHERE relname = 'products';

UPDATE products SET stock = stock + 1;

SELECT s.n_tup_upd - seen.upd AS updates, s.n_tup_hot_upd - seen.hot AS hot_updates
FROM pg_stat_xact_user_tables s, seen
WHERE s.relname = 'products';
```

Now index `stock` and run the same update: 15 updates, **0** HOT. Every update now adds an entry to both indexes (the primary key's and the new one), though only `stock` changed:

```sql
CREATE INDEX products_stock_idx ON products (stock);
CREATE TEMP TABLE seen AS
SELECT n_tup_upd AS upd, n_tup_hot_upd AS hot FROM pg_stat_xact_user_tables WHERE relname = 'products';

UPDATE products SET stock = stock + 1;

SELECT s.n_tup_upd - seen.upd AS updates, s.n_tup_hot_upd - seen.hot AS hot_updates
FROM pg_stat_xact_user_tables s, seen
WHERE s.relname = 'products';
```

The second condition needs free space on the page. **fillfactor** sets how full Postgres packs a table's pages when inserting: 100% by default, so pages start full. Leaving room lets updates stay on their page:

```sql
CREATE TABLE full_pages  (id int, counter int, pad text);
CREATE TABLE roomy_pages (id int, counter int, pad text) WITH (fillfactor = 70);
INSERT INTO full_pages  SELECT i, 0, repeat('x', 100) FROM generate_series(1, 20000) AS i;
INSERT INTO roomy_pages SELECT i, 0, repeat('x', 100) FROM generate_series(1, 20000) AS i;
CREATE INDEX ON full_pages (id);
CREATE INDEX ON roomy_pages (id);

UPDATE full_pages  SET counter = counter + 1;
UPDATE roomy_pages SET counter = counter + 1;

SELECT relname, n_tup_upd AS updates, n_tup_hot_upd AS hot_updates,
       pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_stat_xact_user_tables
WHERE relname IN ('full_pages', 'roomy_pages')
ORDER BY relname;
```

| Table | Updates | HOT | Why |
| --- | --- | --- | --- |
| `full_pages` (fillfactor 100) | 20,000 | 0 | every page was full: each new version went to another page, with a new index entry |
| `roomy_pages` (fillfactor 70) | 20,000 | 9,000 | 30% of each page was free, so many new versions stayed home |

The price of fillfactor 70 is a bigger table from the start. Use it on tables whose rows are updated often, and keep indexes off columns that change all the time.

### How MySQL does it instead

MySQL's InnoDB engine takes the opposite approach:

| | Postgres | MySQL (InnoDB) |
| --- | --- | --- |
| Where the new version goes | a new copy of the row in the table | the row is changed **in place** |
| Where the old version goes | stays in the table until VACUUM | copied to the **undo log**, a separate store of old versions |
| A reader who needs the old version | reads the old copy directly | rebuilds it from the undo log |
| Indexes point to | the row's physical place (`ctid`) | the primary key, so other indexes don't change when the row moves |
| Cleaning up | VACUUM | a purge thread deletes undo records nobody needs |
| What a long transaction costs | dead rows pile up in the table (bloat) | the undo log grows |

Neither is free: both keep old versions for as long as some transaction might read them. Postgres makes updates simple and rollbacks instant (the old row is still there); InnoDB keeps tables compact but makes old reads slower.

## How a query runs: parser, rewriter, planner, executor

Every query goes through the same five stages:

| Stage | What it does | If something's wrong |
| --- | --- | --- |
| **Parser** | checks the grammar and builds a parse tree | *syntax error at or near "FORM"* |
| **Analyzer** | looks up every table, column and function name, and their types | *column "nme" does not exist* |
| **Rewriter** | replaces each view with its query (and applies rules and row-level security policies) | |
| **Planner** | picks the cheapest way to run it: which indexes, which join order, which join algorithm | |
| **Executor** | runs the plan: each node pulls rows from the nodes below it, a row at a time | runtime errors: *division by zero* |

The first two catch typos before any data is read:

```sql error
SELECT name FORM products;
```

```sql error
SELECT nme FROM products;
```

The rewriter is why a view costs nothing extra: by the time the planner sees the query, the view's name is gone and its query is in its place (see [views](/topics/views-functions#views-a-saved-query)). `EXPLAIN` shows the planner's choice; `EXPLAIN ANALYZE` also runs the executor.

## Query planning: statistics, selectivity and cost

For each query, the **planner** considers possible plans (seq scan or index, which join order, which join algorithm) and picks the one with the lowest estimated **cost**. It can't run them all to see, so it estimates from **statistics** that `ANALYZE` collects: for each column, the share of NULLs, the number of distinct values, the most common values and how often each appears.

```sql
SELECT attname, n_distinct, most_common_vals::text, most_common_freqs::text
FROM pg_stats
WHERE schemaname = 'shop' AND tablename = 'orders' AND attname = 'status';
```

`status` has 3 values: delivered 80% of rows, cancelled 10%, pending 10%. So for `WHERE status = 'pending'` the planner estimates 1,500 × 0.1 = 150 rows: its **selectivity** is 0.1. Run `EXPLAIN` and you'll see `rows=150`.

### How a cost is calculated

A plan's **cost** is an estimate in made-up units, built from a few settings. One page read in order costs 1:

```sql
SELECT name, setting
FROM pg_settings
WHERE name IN ('seq_page_cost', 'random_page_cost', 'cpu_tuple_cost', 'cpu_index_tuple_cost', 'cpu_operator_cost')
ORDER BY name;
```

| Setting | Default | Cost of |
| --- | --- | --- |
| `seq_page_cost` | 1 | reading a page in order |
| `random_page_cost` | 4 | reading a page by jumping to it, as an index scan does |
| `cpu_tuple_cost` | 0.01 | handling one row |
| `cpu_index_tuple_cost` | 0.005 | handling one index entry |
| `cpu_operator_cost` | 0.0025 | one comparison, such as `status = 'pending'` |

`orders` has 10 pages and 1,500 rows. Work out a sequential scan by hand, then check it against `EXPLAIN`:

```sql
SELECT relpages, reltuples FROM pg_class WHERE relname = 'orders';
EXPLAIN SELECT * FROM orders;
EXPLAIN SELECT * FROM orders WHERE status = 'pending';
```

| Plan | Calculation | Cost |
| --- | --- | --- |
| Read every row | 10 pages × 1 + 1,500 rows × 0.01 | 10 + 15 = **25.00** |
| … and test `status = 'pending'` on each | 25 + 1,500 comparisons × 0.0025 | 25 + 3.75 = **28.75** |

`EXPLAIN` prints `cost=0.00..25.00` and `cost=0.00..28.75`: the same numbers. The first number is the cost before the first row comes out (0 here: a scan starts at once). The planner works out a cost like this for every plan it considers, using its row estimates, and runs the cheapest.

`random_page_cost` = 4 is why an index loses when it would fetch many rows: each row it fetches may mean jumping to another page, at 4 times the price of reading pages in order. On fast SSDs (solid-state drives), many teams lower it to 1.1, which makes the planner choose indexes more often.

Estimates go wrong when columns are related. The planner assumes conditions are independent, and multiplies:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE status = 'cancelled' AND customer_id = 1;
```

Customer 1 has 8 orders, and the planner expects 10% of them to be cancelled: `rows=1`. In this data, **all 8** of customer 1's orders are cancelled, so the actual is 8. Here it doesn't matter, but on a big table an estimate 100 times too low can pick a nested loop that runs for minutes. Fixes: `ANALYZE` after big changes, and `CREATE STATISTICS` to teach the planner that two columns move together.

## Distributed agreement: two-phase commit and Raft

Once data lives on several servers, they must sometimes agree.

**Two-phase commit** (2PC) makes one transaction commit on several databases, or on none:

1. **Prepare**: the coordinator asks every participant "can you commit?". Each one writes everything to its log, so it can commit later even after a crash, and answers yes or no.
2. **Commit**: if all said yes, the coordinator tells them all to commit; if any said no, all roll back.

Its weakness: if the coordinator dies between the two phases, participants that said yes must wait, holding locks, until it comes back. That's why many systems use **sagas** instead (a chain of local transactions, each with an undo step).

**Raft** (and Paxos) keep several copies of a log identical and pick a **leader**:

- One node is the leader; clients write to it. The leader sends each entry to the followers and treats it as committed once a **majority** has stored it. With 5 nodes, 3 must confirm, so the system survives 2 failures.
- Followers expect regular heartbeats. If the leader goes quiet, a follower waits a random timeout, asks for votes, and becomes leader with a majority.
- A majority is needed for everything, so a cut-off minority can't elect its own leader: no "two leaders" (split brain).

etcd, Consul, CockroachDB and many managed databases use Raft. Structura's [leader election](https://structura-web.netlify.app/topic/leader-election/) topic animates it.

## Build your own

The best way to really learn this is to build a small database. **CMU's BusTub** (from the Carnegie Mellon database course, free online) walks you through a buffer pool, a B+ tree index, query execution and concurrency control, with tests. The course's lecture videos explain every topic in this lesson in depth.

## Mistakes to avoid

> ⚠️ **Sessions left "idle in transaction"**: they hold back VACUUM for the whole database and cause bloat. Set `idle_in_transaction_session_timeout`.

> ⚠️ **Mass `UPDATE` or `DELETE` of most of a table**: it doubles the table with dead versions and writes a lot of WAL. Batch it, or build a new table and swap.

> ⚠️ **Never running `ANALYZE` after loading data**: the planner works from old statistics and picks bad plans.

> ⚠️ **Turning off `fsync` for speed**: commits stop waiting for the WAL to reach disk, and a crash can corrupt the database.

> ⚠️ **Indexing a column that's updated all the time**: every update loses HOT and writes to every index. Leave such columns unindexed if you can, and lower the table's fillfactor.

## Interview questions

**Q: How does Postgres survive a crash without losing committed data?**

Write-ahead logging: every change is first recorded in the WAL, and `COMMIT` returns only after the WAL is flushed to disk. After a crash, Postgres replays the WAL from the last checkpoint, redoing committed changes.

**Q: What is MVCC, and what does it cost?**

Updates write new row versions instead of overwriting, and each transaction reads a snapshot, so readers and writers don't block each other. The cost is dead versions that VACUUM must clean up; long-open transactions stop the cleanup and tables bloat.

**Q: Why would the planner choose a bad plan?**

Its row estimates are wrong: statistics are stale (run `ANALYZE`), or columns are correlated and it multiplied their selectivities as if they were independent (use `CREATE STATISTICS`). Compare estimated and actual rows in `EXPLAIN ANALYZE` to find the node where they part ways.

**Q: Why does an update in Postgres sometimes write to every index, and how do you avoid it?**

An update writes a new version of the row, at a new place, and indexes point at places. A HOT update avoids touching the indexes when no indexed column changes and the new version fits on the same page. So keep indexes off columns you update often, and leave free space on pages with a lower fillfactor.

**Q: How does Postgres pick between a sequential scan and an index scan?**

It estimates a cost for each plan from row estimates and a few settings: 1 per page read in order, 4 per page read by jumping (`random_page_cost`), and small amounts per row and per comparison. A sequential scan of `orders` costs 10 pages × 1 + 1,500 rows × 0.01 = 25. It runs whichever plan is cheapest, so wrong row estimates lead to wrong choices.

**Q: B-tree or LSM tree for a write-heavy event log?**

LSM tree: writes are sequential appends to memory and immutable files, so it takes far more writes per second. You pay with reads that may check several files and with background compaction.
