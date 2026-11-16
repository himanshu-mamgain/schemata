import type { EcoRef } from "../ecosystem";
import { DESIGN_QUESTIONS, type DesignQuestion } from "./design";

export type { DesignQuestion };

export type Level = "easy" | "medium" | "hard";

interface Base {
  id: string;
  title: string;
  level: Level;
  /** Roadmap stage this question practises. */
  stage: string;
  tags: string[];
  related?: EcoRef[];
}

/** Write a query on the built-in shop dataset; it is checked against the solution's result. */
export interface SqlQuestion extends Base {
  kind: "sql";
  prompt: string;
  hint: string;
  solution: string;
  /** True when the question asks for a specific row order. */
  ordered: boolean;
  explanation: string;
}

/** A concept question: think, then reveal the model answer. */
export interface TheoryQuestion extends Base {
  kind: "theory";
  prompt: string;
  answer: string;
}

export type Question = SqlQuestion | TheoryQuestion | DesignQuestion;

export const QUESTIONS: Question[] = [
  // ---------- Easy ----------
  {
    kind: "sql", id: "high-earners", title: "Employees earning over 1.5 lakh", level: "easy", stage: "basics", tags: ["WHERE", "ORDER BY"],
    prompt: "List the name and salary of employees earning more than 150000, highest salary first.",
    hint: "Filter with WHERE, sort with ORDER BY … DESC. Strictly more than: 150000 itself is excluded.",
    solution: "SELECT name, salary\nFROM employees\nWHERE salary > 150000\nORDER BY salary DESC;",
    ordered: true,
    explanation: "WHERE filters rows before anything else happens; ORDER BY runs last. Ties keep any order, which is why the checker only compares the salary order here.",
  },
  {
    kind: "sql", id: "missing-email", title: "Employees with no email", level: "easy", stage: "basics", tags: ["NULL"],
    prompt: "Return the names of employees whose email is missing.",
    hint: "`email = NULL` is never true. NULL needs a special operator.",
    solution: "SELECT name FROM employees WHERE email IS NULL;",
    ordered: false,
    explanation: "Any comparison with NULL yields UNKNOWN, which WHERE treats as false. Use IS NULL / IS NOT NULL. This is the most common SQL trap in interviews.",
  },
  {
    kind: "sql", id: "out-of-stock", title: "Out-of-stock products by category", level: "easy", stage: "basics", tags: ["WHERE", "ORDER BY"],
    prompt: "List category and name of products with zero stock, ordered by category then name.",
    hint: "Two sort keys: ORDER BY a, b.",
    solution: "SELECT category, name FROM products WHERE stock = 0 ORDER BY category, name;",
    ordered: true,
    explanation: "ORDER BY with several columns sorts by the first, then breaks ties with the next.",
  },
  {
    kind: "sql", id: "customers-per-city", title: "Customers per city", level: "easy", stage: "aggregation", tags: ["GROUP BY", "COUNT"],
    prompt: "For each city, return the city and its number of customers. Most customers first; break ties by city name.",
    hint: "GROUP BY city, then COUNT(*).",
    solution: "SELECT city, COUNT(*) AS customers\nFROM customers\nGROUP BY city\nORDER BY customers DESC, city;",
    ordered: true,
    explanation: "GROUP BY collapses rows into one per group; aggregates like COUNT run per group. Every selected column must be grouped or aggregated.",
  },
  {
    kind: "sql", id: "big-departments", title: "Departments with 3+ people", level: "easy", stage: "aggregation", tags: ["HAVING"],
    prompt: "Return department_id and headcount for departments with at least 3 employees. Ignore employees without a department.",
    hint: "WHERE filters rows; HAVING filters groups.",
    solution: "SELECT department_id, COUNT(*) AS headcount\nFROM employees\nWHERE department_id IS NOT NULL\nGROUP BY department_id\nHAVING COUNT(*) >= 3;",
    ordered: false,
    explanation: "HAVING runs after grouping, so it can use aggregates. WHERE runs before, so it can't. Logical order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.",
  },
  {
    kind: "sql", id: "employee-department", title: "Employee with department name", level: "easy", stage: "joins", tags: ["INNER JOIN"],
    prompt: "Return each employee's name and their department's name. Leave out employees without a department.",
    hint: "Join employees to departments on department_id = id.",
    solution: "SELECT e.name, d.name AS department\nFROM employees e\nJOIN departments d ON d.id = e.department_id;",
    ordered: false,
    explanation: "An INNER JOIN keeps only rows that match on both sides, so Ananya (no department) disappears. That's exactly what was asked here.",
  },
  // ---------- Medium ----------
  {
    kind: "sql", id: "empty-departments", title: "Departments with no employees", level: "medium", stage: "joins", tags: ["LEFT JOIN", "anti-join"],
    prompt: "Return the names of departments that have no employees.",
    hint: "LEFT JOIN, then keep rows where the right side is NULL. Or NOT EXISTS.",
    solution: "SELECT d.name\nFROM departments d\nWHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id = d.id);",
    ordered: false,
    explanation: "This is an anti-join. NOT EXISTS is the safest form: NOT IN breaks as soon as the subquery returns a NULL (then nothing matches).",
  },
  {
    kind: "sql", id: "never-ordered", title: "Customers who never ordered", level: "medium", stage: "joins", tags: ["LEFT JOIN", "anti-join"],
    prompt: "Return the id and name of customers who have never placed an order.",
    hint: "LEFT JOIN orders and keep the customers whose order side is NULL.",
    solution: "SELECT c.id, c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;",
    ordered: false,
    explanation: "Classic LeetCode-style anti-join. The WHERE must test a column that can only be NULL when there was no match, like the primary key.",
  },
  {
    kind: "sql", id: "manager-names", title: "Employee and manager", level: "medium", stage: "joins", tags: ["self join"],
    prompt: "Return each employee's name and their manager's name. Include the CEO with a NULL manager.",
    hint: "Join employees to itself, with a LEFT JOIN so the CEO stays.",
    solution: "SELECT e.name AS employee, m.name AS manager\nFROM employees e\nLEFT JOIN employees m ON m.id = e.manager_id;",
    ordered: false,
    explanation: "A self join treats one table as two, using aliases. Hierarchies (managers, referrals, categories) are the classic case.",
  },
  {
    kind: "sql", id: "earn-more-than-manager", title: "Earns more than their manager", level: "medium", stage: "joins", tags: ["self join"],
    prompt: "Return the names of employees who earn strictly more than their manager.",
    hint: "Self join, then compare the two salaries.",
    solution: "SELECT e.name\nFROM employees e\nJOIN employees m ON m.id = e.manager_id\nWHERE e.salary > m.salary;",
    ordered: false,
    explanation: "In this data no one does, so the right answer is an empty result. An empty result is a valid answer: don't force rows.",
  },
  {
    kind: "sql", id: "second-highest-salary", title: "Second highest salary", level: "medium", stage: "subqueries", tags: ["subquery", "DISTINCT"],
    prompt: "Return the second highest distinct salary as a single value.",
    hint: "The highest salary below the maximum. Or DISTINCT … ORDER BY … OFFSET 1.",
    solution: "SELECT MAX(salary) AS second_highest\nFROM employees\nWHERE salary < (SELECT MAX(salary) FROM employees);",
    ordered: false,
    explanation: "Watch out for ties: 'second highest' means the second distinct value. The MAX-below-MAX form also returns NULL (not zero rows) when there is no second value, which interviewers like.",
  },
  {
    kind: "sql", id: "nth-salary-dense-rank", title: "Third highest salary per department", level: "medium", stage: "windows", tags: ["DENSE_RANK", "PARTITION BY"],
    prompt: "For each department, return department_id, name and salary of employees whose salary is the department's 3rd highest distinct salary.",
    hint: "DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC), then filter rank = 3 in an outer query.",
    solution: "SELECT department_id, name, salary\nFROM (\n  SELECT department_id, name, salary,\n         DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS r\n  FROM employees\n  WHERE department_id IS NOT NULL\n) ranked\nWHERE r = 3;",
    ordered: false,
    explanation: "ROW_NUMBER gives unique numbers (ties broken arbitrarily), RANK skips after ties (1,1,3), DENSE_RANK doesn't (1,1,2). 'Nth highest distinct' means DENSE_RANK. You can't filter a window function in WHERE, hence the subquery.",
  },
  {
    kind: "sql", id: "revenue-by-category", title: "Revenue by category", level: "medium", stage: "aggregation", tags: ["JOIN", "SUM"],
    prompt: "Return each product category and its revenue (quantity × unit_price) from delivered orders only. Highest revenue first.",
    hint: "Join orders → order_items → products, filter on status, group by category.",
    solution: "SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nJOIN products p ON p.id = oi.product_id\nWHERE o.status = 'delivered'\nGROUP BY p.category\nORDER BY revenue DESC;",
    ordered: true,
    explanation: "Filter before you aggregate. Use the price stored on the order line, not the current product price: prices change, history shouldn't.",
  },
  {
    kind: "sql", id: "duplicate-emails", title: "Find duplicate emails", level: "medium", stage: "aggregation", tags: ["GROUP BY", "HAVING"],
    prompt: "Return every email that appears on more than one customer, with how many times it appears.",
    hint: "GROUP BY email HAVING COUNT(*) > 1.",
    solution: "SELECT email, COUNT(*) AS copies\nFROM customers\nGROUP BY email\nHAVING COUNT(*) > 1;",
    ordered: false,
    explanation: "The first step of any de-duplication. A UNIQUE constraint would have prevented this. Data quality belongs in the schema.",
  },
  {
    kind: "sql", id: "keep-first-duplicate", title: "Keep the oldest duplicate", level: "medium", stage: "windows", tags: ["ROW_NUMBER", "dedupe"],
    prompt: "For each email, return the id of the customer that should be kept: the one with the lowest id. Return email and id for every email (duplicated or not).",
    hint: "ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) = 1. Or simply MIN(id) … GROUP BY email.",
    solution: "SELECT email, id\nFROM (\n  SELECT email, id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn\n  FROM customers\n) t\nWHERE rn = 1;",
    ordered: false,
    explanation: "To actually delete: DELETE FROM customers WHERE id IN (… rn > 1 …). The ROW_NUMBER form generalises to 'keep the latest row per key', which MIN can't do when you need the whole row.",
  },
  {
    kind: "sql", id: "monthly-orders", title: "Orders per month", level: "medium", stage: "aggregation", tags: ["date_trunc", "GROUP BY"],
    prompt: "Return each month of 2025 (as the first day of the month) and the number of orders placed in it, in month order.",
    hint: "date_trunc('month', order_date).",
    solution: "SELECT date_trunc('month', order_date)::date AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY 1\nORDER BY 1;",
    ordered: true,
    explanation: "date_trunc buckets timestamps. GROUP BY 1 refers to the first selected column, handy but fragile in production code.",
  },
  {
    kind: "sql", id: "top-customer-per-city", title: "Top customer per city", level: "medium", stage: "windows", tags: ["top-N per group", "RANK"],
    prompt: "For each city, return city, customer id and total spent (delivered orders) for the customer who spent the most. Include ties.",
    hint: "Aggregate spend per customer first (a CTE), then RANK() per city.",
    solution: "WITH spend AS (\n  SELECT c.city, c.id, SUM(oi.quantity * oi.unit_price) AS spent\n  FROM customers c\n  JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'\n  JOIN order_items oi ON oi.order_id = o.id\n  GROUP BY c.city, c.id\n)\nSELECT city, id, spent\nFROM (SELECT *, RANK() OVER (PARTITION BY city ORDER BY spent DESC) AS r FROM spend) t\nWHERE r = 1;",
    ordered: false,
    explanation: "'Top N per group' is the most asked window-function question. RANK keeps ties; ROW_NUMBER would pick one arbitrarily.",
  },
  // ---------- Hard ----------
  {
    kind: "sql", id: "running-total", title: "Running revenue total", level: "hard", stage: "windows", tags: ["SUM OVER", "running total"],
    prompt: "For each day in January 2025, return the date, that day's delivered revenue and the running total since 1 January. Order by date. Only days that had delivered orders.",
    hint: "Aggregate per day in a CTE, then SUM(revenue) OVER (ORDER BY day).",
    solution: "WITH daily AS (\n  SELECT o.order_date AS day, SUM(oi.quantity * oi.unit_price) AS revenue\n  FROM orders o JOIN order_items oi ON oi.order_id = o.id\n  WHERE o.status = 'delivered' AND o.order_date < DATE '2025-02-01'\n  GROUP BY o.order_date\n)\nSELECT day, revenue, SUM(revenue) OVER (ORDER BY day) AS running_total\nFROM daily\nORDER BY day;",
    ordered: true,
    explanation: "A window with ORDER BY and no frame clause defaults to RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, which is a running total. Aggregate first, then window.",
  },
  {
    kind: "sql", id: "month-over-month", title: "Month-over-month growth", level: "hard", stage: "windows", tags: ["LAG", "growth"],
    prompt: "For each month of 2025, return month, order count and the % change from the previous month (rounded to 1 decimal, NULL for January). Month order.",
    hint: "LAG(count) OVER (ORDER BY month). Watch integer division.",
    solution: "WITH m AS (\n  SELECT date_trunc('month', order_date)::date AS month, COUNT(*) AS orders\n  FROM orders GROUP BY 1\n)\nSELECT month, orders,\n       ROUND(100.0 * (orders - LAG(orders) OVER (ORDER BY month)) / LAG(orders) OVER (ORDER BY month), 1) AS pct_change\nFROM m\nORDER BY month;",
    ordered: true,
    explanation: "LAG/LEAD read neighbouring rows without a self join. Multiply by 100.0 (not 100) so Postgres does decimal division, not integer division.",
  },
  {
    kind: "sql", id: "login-streaks", title: "Longest login streak", level: "hard", stage: "windows", tags: ["gaps and islands"],
    prompt: "For each user in logins, return user_id and their longest run of consecutive login days.",
    hint: "Gaps and islands: login_date minus ROW_NUMBER() (in days) is constant within a streak. Group by that.",
    solution: "WITH g AS (\n  SELECT user_id, login_date,\n         login_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date))::int AS grp\n  FROM logins\n), streaks AS (\n  SELECT user_id, COUNT(*) AS len FROM g GROUP BY user_id, grp\n)\nSELECT user_id, MAX(len) AS longest_streak\nFROM streaks\nGROUP BY user_id;",
    ordered: false,
    explanation: "'Gaps and islands' is the classic hard SQL pattern: consecutive dates minus a consecutive counter give the same value. It also solves seat booking, uptime windows and sessionization.",
  },
  {
    kind: "sql", id: "retention", title: "Day-1 retention", level: "hard", stage: "windows", tags: ["retention", "self join"],
    prompt: "Return the share of users (0 to 1, rounded to 2 decimals) who logged in again the day after their first login.",
    hint: "Find each user's first login (MIN), then check whether first + 1 exists.",
    solution: "WITH firsts AS (\n  SELECT user_id, MIN(login_date) AS first_day FROM logins GROUP BY user_id\n)\nSELECT ROUND(AVG(CASE WHEN l.user_id IS NOT NULL THEN 1.0 ELSE 0 END), 2) AS day1_retention\nFROM firsts f\nLEFT JOIN logins l ON l.user_id = f.user_id AND l.login_date = f.first_day + 1;",
    ordered: false,
    explanation: "Product-analytics interviews love retention. AVG over a 1/0 flag is a neat way to compute a share.",
  },
  {
    kind: "sql", id: "org-chart", title: "Everyone under Vikram", level: "hard", stage: "subqueries", tags: ["recursive CTE", "hierarchy"],
    prompt: "Return the names of everyone who reports to Vikram Shah (id 2), directly or indirectly, with their depth (1 = direct report).",
    hint: "WITH RECURSIVE: start from direct reports, then repeatedly join employees on manager_id.",
    solution: "WITH RECURSIVE tree AS (\n  SELECT id, name, 1 AS depth FROM employees WHERE manager_id = 2\n  UNION ALL\n  SELECT e.id, e.name, t.depth + 1\n  FROM employees e JOIN tree t ON e.manager_id = t.id\n)\nSELECT name, depth FROM tree;",
    ordered: false,
    explanation: "A recursive CTE has an anchor query and a recursive part joined with UNION ALL; Postgres repeats it until no new rows appear. It's breadth-first search written in SQL.",
    related: [{ app: "dsa-atlas", pattern: "Graphs" }, { app: "dsa-atlas", pattern: "Recursion" }],
  },
  {
    kind: "sql", id: "median-salary", title: "Median salary per department", level: "hard", stage: "aggregation", tags: ["percentile", "median"],
    prompt: "Return department_id and the median salary for each department that has employees.",
    hint: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary).",
    solution: "SELECT department_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary\nFROM employees\nWHERE department_id IS NOT NULL\nGROUP BY department_id;",
    ordered: false,
    explanation: "PERCENTILE_CONT interpolates between the two middle values; PERCENTILE_DISC picks an actual value. Without these, you'd rank rows and average the middle one or two.",
  },
  {
    kind: "sql", id: "bought-together", title: "Frequently bought together", level: "hard", stage: "joins", tags: ["self join", "pairs"],
    prompt: "Return the 3 product pairs (product_a < product_b, as ids) that appear together in the most orders, with that count. Most frequent first; break ties by product_a, then product_b.",
    hint: "Self join order_items on the same order_id with a.product_id < b.product_id.",
    solution: "SELECT a.product_id AS product_a, b.product_id AS product_b, COUNT(*) AS together\nFROM order_items a\nJOIN order_items b ON a.order_id = b.order_id AND a.product_id < b.product_id\nGROUP BY 1, 2\nORDER BY together DESC, product_a, product_b\nLIMIT 3;",
    ordered: true,
    explanation: "The < condition both removes self-pairs and counts each pair once. This is the core of market-basket analysis.",
  },

  // ---------- Theory ----------
  {
    kind: "theory", id: "acid", title: "What does ACID mean?", level: "easy", stage: "transactions", tags: ["ACID"],
    prompt: "Explain each letter of ACID with an example.",
    answer: "**Atomicity**: all of a transaction happens or none of it (a transfer never debits without crediting). **Consistency**: a transaction moves the database from one valid state to another (constraints hold). **Isolation**: concurrent transactions don't see each other's half-done work (to a degree set by the isolation level). **Durability**: once committed, it survives a crash (the write-ahead log is flushed to disk before COMMIT returns).",
    related: [{ app: "structura", topic: "payment-idempotency" }],
  },
  {
    kind: "theory", id: "where-vs-having", title: "WHERE vs HAVING", level: "easy", stage: "aggregation", tags: ["HAVING"],
    prompt: "When do you use WHERE and when HAVING?",
    answer: "WHERE filters rows before grouping and can't use aggregates. HAVING filters groups after GROUP BY and can. Put every filter you can in WHERE: fewer rows reach the aggregation.",
  },
  {
    kind: "theory", id: "join-types", title: "Types of joins", level: "easy", stage: "joins", tags: ["JOIN"],
    prompt: "Explain INNER, LEFT, RIGHT, FULL and CROSS joins.",
    answer: "INNER keeps matching pairs only. LEFT keeps every left row (NULLs where there's no match); RIGHT is the mirror. FULL keeps unmatched rows from both sides. CROSS is every combination (n × m rows). A SEMI join (EXISTS) keeps left rows that have a match without duplicating them; an ANTI join (NOT EXISTS) keeps those that don't.",
  },
  {
    kind: "theory", id: "index-how", title: "How does an index speed up a query?", level: "medium", stage: "indexing", tags: ["B-tree", "index"],
    prompt: "What is a B-tree index, and when does it not help?",
    answer: "A B-tree keeps keys sorted in a shallow, wide tree (3–4 levels for millions of rows), so a lookup is O(log n) page reads instead of scanning the table. It helps equality, ranges, ORDER BY and prefix LIKE 'abc%'. It doesn't help when the query reads most of the table (a sequential scan is cheaper), with functions on the column (unless you index the expression), with leading-wildcard LIKE '%abc', or when the column has very few distinct values. Every index slows writes and takes space.",
    related: [{ app: "dsa-atlas", pattern: "Trees" }, { app: "dsa-atlas", pattern: "Binary Search" }],
  },
  {
    kind: "theory", id: "composite-index", title: "Column order in a composite index", level: "medium", stage: "indexing", tags: ["composite index"],
    prompt: "You have an index on (customer_id, order_date). Which queries can use it?",
    answer: "Leftmost-prefix rule: it serves WHERE customer_id = ?, and WHERE customer_id = ? AND order_date > ?, and ORDER BY order_date for one customer. It can't efficiently serve WHERE order_date > ? alone. Put equality columns first, then range columns. If it also contains every column the query needs, it's a covering index (an index-only scan; INCLUDE adds payload columns).",
  },
  {
    kind: "theory", id: "isolation-levels", title: "Isolation levels and anomalies", level: "hard", stage: "transactions", tags: ["isolation", "MVCC"],
    prompt: "Name the isolation levels and the anomalies each one prevents.",
    answer: "Read Uncommitted allows dirty reads. Read Committed (the Postgres default) prevents dirty reads but allows non-repeatable reads. Repeatable Read prevents those too (in Postgres it's snapshot isolation, which also prevents phantoms) but allows write skew. Serializable prevents everything, as if transactions ran one at a time; Postgres does it with SSI and aborts conflicting transactions, so your app must retry. Lost updates: use SELECT … FOR UPDATE or an atomic UPDATE x = x + 1.",
    related: [{ app: "structura", topic: "locking" }],
  },
  {
    kind: "theory", id: "mvcc", title: "What is MVCC?", level: "hard", stage: "internals", tags: ["MVCC", "VACUUM"],
    prompt: "How do Postgres readers and writers avoid blocking each other?",
    answer: "Multi-Version Concurrency Control: an UPDATE writes a new row version instead of overwriting. Each version records the transactions that created and deleted it, and each transaction reads from a snapshot, so readers never block writers and writers never block readers. The cost: old versions (dead tuples) pile up until VACUUM reclaims them. Long-running transactions hold back that cleanup and cause bloat.",
  },
  {
    kind: "theory", id: "normalization", title: "Normalization: 1NF to 3NF", level: "medium", stage: "modelling", tags: ["normalization"],
    prompt: "Explain 1NF, 2NF, 3NF and when you'd denormalize.",
    answer: "1NF: atomic values, no repeating groups. 2NF: no column depends on only part of a composite key. 3NF: no column depends on another non-key column (store city_id, not city plus its state). The goal is one fact in one place, so updates can't create contradictions. Denormalize deliberately for read-heavy paths (counters, precomputed totals, reporting tables) and keep the copies in sync with triggers, jobs or events.",
  },
  {
    kind: "theory", id: "sharding-vs-replication", title: "Replication vs sharding", level: "hard", stage: "scaling", tags: ["sharding", "replication"],
    prompt: "What's the difference, and how do you pick a shard key?",
    answer: "Replication copies the same data to several nodes: it adds read capacity and failover, not write capacity. Asynchronous replicas can lag (read-your-writes problems). Sharding splits the data across nodes by a key, which scales writes and storage. A good shard key has high cardinality, spreads load evenly (no hot shard) and keeps the queries you run most on one shard (e.g. tenant_id for a SaaS app). Cross-shard joins and transactions become expensive. Consistent hashing reduces data movement when you add shards.",
    related: [{ app: "structura", topic: "database-sharding" }, { app: "structura", topic: "consistent-hashing" }],
  },
  {
    kind: "theory", id: "cap", title: "CAP and PACELC", level: "hard", stage: "scaling", tags: ["CAP", "consistency"],
    prompt: "Explain the CAP theorem and why PACELC is more useful.",
    answer: "During a network Partition, a distributed store must choose Consistency (refuse some requests) or Availability (answer, possibly with stale data). CAP says nothing about normal operation; PACELC adds: Else, choose Latency or Consistency. Examples: Spanner is PC/EC; Cassandra and DynamoDB default to PA/EL, with tunable quorum reads and writes (R + W > N for strong reads).",
  },
  {
    kind: "theory", id: "sql-vs-nosql", title: "SQL or NoSQL?", level: "medium", stage: "nosql", tags: ["NoSQL", "trade-offs"],
    prompt: "How do you decide between a relational database and a NoSQL store?",
    answer: "Default to Postgres: relations, constraints, transactions, ad-hoc queries, and JSONB for flexible bits. Pick NoSQL for a specific access pattern: key-value at huge scale with predictable latency (DynamoDB), very high write throughput with time-ordered data (Cassandra), caching and counters (Redis), deeply connected data (Neo4j), full-text search (Elasticsearch), analytics over billions of rows (ClickHouse). In NoSQL you model around your queries, not around entities.",
    related: [{ app: "structura", topic: "key-value-store" }],
  },
  {
    kind: "theory", id: "lsm-vs-btree", title: "LSM tree vs B-tree storage", level: "hard", stage: "internals", tags: ["LSM", "B-tree", "storage engines"],
    prompt: "Why do Cassandra and RocksDB write faster than Postgres, and what do they pay for it?",
    answer: "LSM trees buffer writes in memory (a memtable plus the WAL), flush them as sorted immutable files (SSTables) and merge those in the background (compaction). Writes are sequential, so they're fast. Reads may check several files, helped by Bloom filters, and compaction costs background I/O (write amplification). B-trees update pages in place: reads are faster and more predictable, writes are random I/O.",
    related: [{ app: "dsa-atlas", pattern: "Trees" }],
  },
  {
    kind: "theory", id: "caching-patterns", title: "Caching a database", level: "medium", stage: "scaling", tags: ["Redis", "cache"],
    prompt: "Explain cache-aside, write-through and how to avoid stale data.",
    answer: "Cache-aside: read the cache; on a miss, read the DB and fill the cache with a TTL. On writes, update the DB and then delete the cache key (don't update it, to avoid races). Write-through: write to the cache and DB together. Watch for the thundering herd on hot-key expiry (use locks or request coalescing, or early refresh) and for caching negative results.",
    related: [{ app: "structura", topic: "distributed-cache" }, { app: "structura", topic: "redis-basics" }],
  },
  // ---------- Schema design (DBML + diagram) ----------
  ...DESIGN_QUESTIONS,
];

export const questionById = (id: string) => QUESTIONS.find((q) => q.id === id);
