import type { EcoRef } from "../ecosystem";

export type Phase = "Foundations" | "Intermediate" | "Advanced" | "Expert";

export interface Stage {
  id: string;
  title: string;
  phase: Phase;
  summary: string;
  /** What to learn, in order. */
  concepts: string[];
  /** A query to open in the editor and play with (shop dataset). */
  tryIt: string;
  related?: EcoRef[];
}

export const PHASES: Phase[] = ["Foundations", "Intermediate", "Advanced", "Expert"];

export const ROADMAP: Stage[] = [
  {
    id: "basics", phase: "Foundations", title: "Querying one table",
    summary: "Tables, rows and columns; reading data with SELECT and shaping it with WHERE, ORDER BY and LIMIT.",
    concepts: ["What a relational database is: tables, rows, columns, types", "SELECT, aliases and expressions", "WHERE with AND / OR / IN / BETWEEN / LIKE", "NULL and three-valued logic (IS NULL)", "ORDER BY, LIMIT / OFFSET, DISTINCT", "CASE expressions", "Data types: INT, NUMERIC, TEXT, DATE, TIMESTAMPTZ, BOOLEAN, JSONB"],
    tryIt: "SELECT name, category, price,\n       CASE WHEN stock = 0 THEN 'sold out' ELSE 'in stock' END AS availability\nFROM products\nORDER BY price DESC\nLIMIT 10;",
  },
  {
    id: "aggregation", phase: "Foundations", title: "Aggregation",
    summary: "Summarise many rows into few: counts, sums, averages per group.",
    concepts: ["COUNT, SUM, AVG, MIN, MAX; COUNT(*) vs COUNT(col)", "GROUP BY with one or more columns", "HAVING vs WHERE", "Logical query order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT", "Date bucketing with date_trunc", "FILTER (WHERE …) and conditional aggregation", "PERCENTILE_CONT for medians"],
    tryIt: "SELECT status, COUNT(*) AS orders,\n       COUNT(*) FILTER (WHERE order_date >= '2025-07-01') AS second_half\nFROM orders\nGROUP BY status;",
  },
  {
    id: "joins", phase: "Foundations", title: "Joins",
    summary: "Combine tables through keys. The single most important SQL skill.",
    concepts: ["Primary keys and foreign keys", "INNER, LEFT, RIGHT, FULL and CROSS JOIN", "Self joins (hierarchies)", "Semi joins (EXISTS) and anti joins (NOT EXISTS / LEFT JOIN … IS NULL)", "Why NOT IN breaks with NULLs", "Join fan-out: how joins multiply rows and inflate SUMs"],
    tryIt: "SELECT d.name AS department, COUNT(e.id) AS people\nFROM departments d\nLEFT JOIN employees e ON e.department_id = d.id\nGROUP BY d.name\nORDER BY people DESC;",
  },
  {
    id: "subqueries", phase: "Intermediate", title: "Subqueries and CTEs",
    summary: "Build queries out of queries; recursion for trees and graphs.",
    concepts: ["Scalar, row and table subqueries", "Correlated subqueries", "WITH (CTEs) for readability", "WITH RECURSIVE for hierarchies and graph walks", "UNION / UNION ALL / INTERSECT / EXCEPT", "LATERAL joins"],
    tryIt: "WITH RECURSIVE chain AS (\n  SELECT id, name, manager_id, 0 AS depth FROM employees WHERE id = 6\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id, c.depth + 1\n  FROM employees e JOIN chain c ON e.id = c.manager_id\n)\nSELECT * FROM chain;",
    related: [{ app: "dsa-atlas", pattern: "Recursion" }, { app: "dsa-atlas", pattern: "Graphs" }],
  },
  {
    id: "windows", phase: "Intermediate", title: "Window functions",
    summary: "Compute across related rows without collapsing them: ranks, running totals, previous values.",
    concepts: ["OVER (PARTITION BY … ORDER BY …)", "ROW_NUMBER vs RANK vs DENSE_RANK", "Top-N per group", "LAG / LEAD for period-over-period", "Running totals and moving averages with frames (ROWS BETWEEN)", "Gaps and islands", "FIRST_VALUE, NTILE"],
    tryIt: "SELECT name, department_id, salary,\n       RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rank_in_dept,\n       salary - AVG(salary) OVER (PARTITION BY department_id) AS vs_dept_avg\nFROM employees;",
  },
  {
    id: "modelling", phase: "Intermediate", title: "Data modelling",
    summary: "Design schemas that stay correct as the app grows.",
    concepts: ["Entities, relationships, ER diagrams", "One-to-many and many-to-many (junction tables)", "Normalization: 1NF, 2NF, 3NF", "Constraints: NOT NULL, UNIQUE, CHECK, FOREIGN KEY", "Natural vs surrogate keys; UUID vs bigint", "When to denormalize", "Soft deletes, audit columns, time zones"],
    tryIt: "-- How is the shop modelled? Every foreign key:\nSELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table\nFROM information_schema.table_constraints tc\nJOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name\nJOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name\nWHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'shop';",
  },
  {
    id: "views-functions", phase: "Intermediate", title: "Views, functions and triggers",
    summary: "Keep queries, results and code inside the database: views, materialized views, functions, procedures and triggers.",
    concepts: ["Views: a saved query, and what they're good for", "Materialized views: a saved result, REFRESH and REFRESH CONCURRENTLY", "Functions in SQL and PL/pgSQL; RETURNS TABLE", "IMMUTABLE, STABLE and VOLATILE, and indexes on functions", "Procedures: CALL, INOUT, and COMMIT inside a procedure", "Function vs procedure", "Triggers: BEFORE and AFTER, row and statement, OLD and NEW", "When to use a constraint, a trigger or app code"],
    tryIt: "CREATE VIEW customer_spend AS\nSELECT c.id, c.name, SUM(oi.quantity * oi.unit_price) AS spent\nFROM customers c\nJOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'\nJOIN order_items oi ON oi.order_id = o.id\nGROUP BY c.id, c.name;\n\nSELECT * FROM customer_spend ORDER BY spent DESC LIMIT 5;",
  },
  {
    id: "indexing", phase: "Advanced", title: "Indexes and query plans",
    summary: "Make queries fast and know why they are slow.",
    concepts: ["How a B-tree index works", "EXPLAIN and EXPLAIN ANALYZE: Seq Scan, Index Scan, Bitmap Scan", "Join algorithms: nested loop, hash join, merge join", "Composite indexes and the leftmost-prefix rule; skipping a column and skip scan", "Covering indexes (INCLUDE), partial and expression indexes", "GIN for JSONB and full-text, BRIN for huge append-only tables", "The cost of indexes on writes", "When an index makes a query slower", "N+1 queries, keyset pagination vs OFFSET"],
    tryIt: "EXPLAIN ANALYZE\nSELECT * FROM orders WHERE customer_id = 42;\n\n-- Then try a column without an index:\n-- EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';",
    related: [{ app: "dsa-atlas", pattern: "Trees" }, { app: "dsa-atlas", pattern: "Binary Search" }, { app: "structura", topic: "query-cache" }],
  },
  {
    id: "transactions", phase: "Advanced", title: "Transactions and concurrency",
    summary: "Keep data correct when many users write at once.",
    concepts: ["ACID", "BEGIN / COMMIT / ROLLBACK, savepoints", "Isolation levels and anomalies: dirty read, non-repeatable read, phantom, lost update, write skew", "Row locks: SELECT … FOR UPDATE / SKIP LOCKED", "Optimistic locking with a version column", "Deadlocks and how to avoid them", "Idempotency keys"],
    tryIt: "BEGIN;\nUPDATE products SET stock = stock - 1 WHERE id = 1 RETURNING name, stock;\nROLLBACK;\n\nSELECT name, stock FROM products WHERE id = 1; -- unchanged",
    related: [{ app: "structura", topic: "locking" }, { app: "structura", topic: "payment-idempotency" }],
  },
  {
    id: "scaling", phase: "Advanced", title: "Scaling databases",
    summary: "From one server to many: replicas, partitions, shards and caches.",
    concepts: ["Vertical vs horizontal scaling", "Connection pooling (PgBouncer)", "Read replicas and replication lag", "Table partitioning (range, list, hash)", "Sharding and choosing a shard key", "Consistent hashing", "CAP and PACELC", "Caching: cache-aside, write-through, invalidation", "Unique ID generation (Snowflake IDs)"],
    tryIt: "-- Range partitioning, the first step before sharding:\nCREATE TABLE events (id bigint, at date, payload text) PARTITION BY RANGE (at);\nCREATE TABLE events_2025_h1 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-07-01');\nCREATE TABLE events_2025_h2 PARTITION OF events FOR VALUES FROM ('2025-07-01') TO ('2026-01-01');\nINSERT INTO events SELECT i, DATE '2025-01-01' + i % 365, 'e' FROM generate_series(1, 1000) i;\nEXPLAIN SELECT * FROM events WHERE at >= '2025-09-01';",
    related: [{ app: "structura", topic: "database-sharding" }, { app: "structura", topic: "consistent-hashing" }, { app: "structura", topic: "distributed-cache" }, { app: "structura", topic: "unique-id-generator" }],
  },
  {
    id: "nosql", phase: "Expert", title: "Beyond relational",
    summary: "Document, key-value, wide-column, graph, search, analytics and vector databases, and how to model for each.",
    concepts: ["Document modelling: embed vs reference (MongoDB)", "Key-value and single-table design (DynamoDB)", "Wide-column and partition keys (Cassandra)", "Data structures as a database (Redis)", "Graph modelling and traversals (Neo4j, Cypher)", "Inverted indexes (Elasticsearch)", "Columnar storage and OLAP (ClickHouse, DuckDB)", "Vector search (pgvector)", "Postgres JSONB as the middle ground"],
    tryIt: "-- Postgres as a document store, with JSONB:\nSELECT jsonb_build_object(\n  'customer', c.name,\n  'orders', jsonb_agg(jsonb_build_object('id', o.id, 'date', o.order_date, 'status', o.status))\n) AS doc\nFROM customers c JOIN orders o ON o.customer_id = c.id\nWHERE c.id = 7\nGROUP BY c.name;",
    related: [{ app: "structura", topic: "key-value-store" }, { app: "structura", topic: "vector-database" }, { app: "structura", topic: "social-graph" }],
  },
  {
    id: "internals", phase: "Expert", title: "How databases work inside",
    summary: "Pages, trees, logs and versions: what happens under every query.",
    concepts: ["Pages and the buffer pool", "B+ trees vs LSM trees", "Write-ahead log (WAL), checkpoints and crash recovery", "MVCC, VACUUM and bloat", "HOT updates and fillfactor; MySQL's undo log", "How a query runs: parser, analyzer, rewriter, planner, executor", "Query planning: statistics, selectivity, and how a cost is calculated", "Two-phase commit, Raft and leader election", "Build your own: CMU BusTub"],
    tryIt: "-- Postgres keeps a hidden row version for MVCC:\nSELECT xmin, xmax, ctid, id, name FROM products LIMIT 5;",
    related: [{ app: "dsa-atlas", pattern: "Trees" }, { app: "dsa-atlas", pattern: "Heap / Priority Queue" }, { app: "structura", topic: "leader-election" }],
  },
];

export const stageById = (id: string) => ROADMAP.find((s) => s.id === id);
