> 💡 **In one line:** a subquery is a query inside another query, and a CTE (`WITH`) is a named subquery written first. Together they let you build an answer in steps: first find the average, then the people above it; first total each customer, then rank the totals. `WITH RECURSIVE` goes further and walks trees, such as an org chart.

## Scalar subqueries: one value

A **scalar subquery** returns exactly one row with one column, so you can use it anywhere a single value fits. Who earns more than the company average?

```sql
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC;
```

The inner query runs first and gives 120714.29 (2,535,000 ÷ 21). The outer query then reads as `WHERE salary > 120714.29`, and 10 employees pass. You can't write `WHERE salary > AVG(salary)`: an aggregate can't sit in `WHERE` (see [Aggregation](/topics/aggregation#where-vs-having)).

A scalar subquery must return **one** row. If it returns several, Postgres stops:

```sql error
SELECT (SELECT name FROM employees WHERE department_id = 1);
```

*more than one row returned by a subquery used as an expression*: Engineering has 6 people, so which name? If no row comes back, the value is NULL.

## Subqueries that return a list or a table

**A list, with `IN`.** Every product in a category that has something out of stock:

```sql
SELECT name, category, price
FROM products
WHERE category IN (SELECT category FROM products WHERE stock = 0)
ORDER BY category, price;
```

The inner query returns Books, Electronics and Grocery (each has a product with 0 stock), so 12 of the 15 products come back: every one except the Furniture.

**A table, in `FROM`.** A subquery in `FROM` (a **derived table**) must have an alias. Categories that took more than 5,000,000 in revenue (all statuses):

```sql
SELECT t.category, t.revenue
FROM (
  SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  GROUP BY p.category
) AS t
WHERE t.revenue > 5000000
ORDER BY t.revenue DESC;
```

Electronics (22,072,750) and Furniture (17,998,500). This is also how you filter on a window function or an alias: compute it inside, filter outside.

## Correlated subqueries

A **correlated** subquery uses a column from the outer query, so it runs once for each outer row, with that row's values. Products priced above the average **of their own category**:

```sql
SELECT name, category, price
FROM products p
WHERE price > (
  SELECT AVG(price) FROM products p2
  WHERE p2.category = p.category
)
ORDER BY category, price DESC;
```

Follow one row: for *Database Internals* (Books, 2199.00), `p.category` is 'Books', so the inner query is the average of the 4 book prices: (1899 + 1499 + 2199 + 999) ÷ 4 = 1649.00. 2199 > 1649, so it's kept. For *Clean Code* (999.00), 999 > 1649 is false, so it's dropped. 8 products pass.

```steps correlated
```

The same shape finds the best-paid person in each department:

```sql
SELECT e.name, e.department_id, e.salary
FROM employees e
WHERE e.salary = (
  SELECT MAX(salary) FROM employees x
  WHERE x.department_id = e.department_id
)
ORDER BY e.department_id;
```

A correlated subquery in `SELECT` adds one computed column per row. Direct reports per person:

```sql
SELECT name,
       (SELECT COUNT(*) FROM employees r WHERE r.manager_id = e.id) AS direct_reports
FROM employees e
ORDER BY direct_reports DESC, name
LIMIT 4;
```

> 💡 "Runs once per row" is how to think about it, not always how Postgres runs it: the planner often turns it into a join. Still, on big tables a correlated subquery can be slow; a join with `GROUP BY`, or a window function, usually does the same faster.

## CTEs: WITH, for queries in steps

A **CTE** (common table expression) names a subquery and puts it first, so a long query reads top to bottom like a recipe:

```sql
WITH delivered AS (
  SELECT id, customer_id
  FROM orders
  WHERE status = 'delivered'
),
totals AS (
  SELECT d.customer_id, SUM(oi.quantity * oi.unit_price) AS spent
  FROM delivered d
  JOIN order_items oi ON oi.order_id = d.id
  GROUP BY d.customer_id
)
SELECT customer_id, spent
FROM totals
ORDER BY spent DESC
LIMIT 3;
```

| Step | Name | Holds |
| --- | --- | --- |
| 1 | `delivered` | the 1,200 delivered orders |
| 2 | `totals` | one row per customer: what they spent on delivered orders |
| 3 | final `SELECT` | the top 3: customer 6 (977,328), customer 95 (917,955), customer 66 (868,736) |

Each CTE can use the ones above it. A CTE lasts only for this one query. Use them whenever a query has more than one idea in it: you can run each step alone while you build it.

## WITH RECURSIVE: walking trees

A **recursive CTE** repeats a query, each time feeding it the rows from the round before, until no new rows appear. The simplest one counts to 5:

```sql
WITH RECURSIVE n AS (
  SELECT 1 AS i                           -- anchor: the starting rows
  UNION ALL
  SELECT i + 1 FROM n WHERE i < 5         -- recursive part: next rows from the last ones
)
SELECT i FROM n;
```

It has two parts joined by `UNION ALL`:

1. The **anchor** runs once: it gives 1.
2. The **recursive part** runs on the rows from the last round: 1 gives 2, 2 gives 3 … 5 gives nothing (5 < 5 is false), and it stops.

Without a stopping condition it would run forever.

**Up a tree**: Nisha Kapoor's chain of managers, up to the CEO.

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS depth
  FROM employees WHERE id = 6
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.depth + 1
  FROM employees e
  JOIN chain c ON e.id = c.manager_id
)
SELECT name, depth FROM chain;
```

| Round | Found | Because |
| --- | --- | --- |
| anchor | Nisha Kapoor, depth 0 | `id = 6` |
| 1 | Meera Iyer, depth 1 | Nisha's `manager_id` is 3 |
| 2 | Vikram Shah, depth 2 | Meera's `manager_id` is 2 |
| 3 | Asha Rao, depth 3 | Vikram's `manager_id` is 1 |
| 4 | nothing | Asha's `manager_id` is NULL: the walk ends |

```steps recursive-chain
```

**Down a tree**, with the path written out:

```sql
WITH RECURSIVE tree AS (
  SELECT id, name, 1 AS depth, name::text AS path
  FROM employees WHERE manager_id = 1
  UNION ALL
  SELECT e.id, e.name, t.depth + 1, t.path || ' > ' || e.name
  FROM employees e
  JOIN tree t ON e.manager_id = t.id
)
SELECT depth, name, path FROM tree ORDER BY path;
```

`||` joins text. Sorting by the path lists each person right under their manager, like a folder tree. The same pattern follows referrals (`customers.referred_by`), categories with parent categories, or routes between places.

> ⚠️ If the data can loop (A manages B, B manages A), a recursive CTE never ends. Keep a path and stop when it already contains the row (`WHERE NOT e.id = ANY(path_ids)`), or add `WHERE depth < 20`.

## UNION, INTERSECT and EXCEPT

These stack two results with the same columns:

| Operator | Keeps | Duplicates |
| --- | --- | --- |
| `UNION ALL` | every row from both | kept |
| `UNION` | every row from both | removed (extra work: it sorts or hashes) |
| `INTERSECT` | rows in both | removed |
| `EXCEPT` | rows in the first but not the second | removed |

UAE customers live in 6 cities, Singapore customers in 8. Which cities have Singapore customers but no UAE ones?

```sql
SELECT city FROM customers WHERE country = 'Singapore'
EXCEPT
SELECT city FROM customers WHERE country = 'UAE'
ORDER BY 1;
```

Hyderabad and Jaipur. Both sides must have the same number of columns, with matching types; the names come from the first. Combining two different tables into one list is a common use:

```sql
SELECT 'employee' AS kind, name, email FROM employees WHERE department_id = 4
UNION ALL
SELECT 'customer', name, email FROM customers WHERE id <= 2;
```

> 💡 Use `UNION ALL` unless you need duplicates removed: it's faster, and removing duplicates you didn't expect can hide a bug.

## LATERAL: a subquery per row that returns several rows

A correlated subquery in `SELECT` gives one value per row. `LATERAL` gives a whole small table per row. Each customer's 2 most recent orders:

```sql
SELECT c.id, last.order_date, last.status
FROM customers c
CROSS JOIN LATERAL (
  SELECT o.order_date, o.status
  FROM orders o
  WHERE o.customer_id = c.id
  ORDER BY o.order_date DESC
  LIMIT 2
) AS last
WHERE c.id IN (1, 2)
ORDER BY c.id, last.order_date DESC;
```

The subquery may use `c.id` because of `LATERAL`. Use `LEFT JOIN LATERAL (…) ON true` to keep customers with no orders (with NULLs). "Top N per row" is the classic use; [window functions](/topics/windows#top-n-per-group) solve the same problem another way.

## Mistakes to avoid

> ⚠️ **A scalar subquery that can return several rows**: it works on today's data and fails tomorrow. Make sure it's one value: aggregate it, or filter by a unique key.

> ⚠️ **`NOT IN (subquery)` with NULLs**: returns nothing. Use `NOT EXISTS` (see [Joins](/topics/joins#why-not-in-breaks-with-nulls)).

> ⚠️ **`UNION` when you meant `UNION ALL`**: two genuinely equal rows (two people with the same name) become one.

> ⚠️ **A recursive CTE with no way to stop**: always make sure a round can return nothing.

## Interview questions

**Q: What's a correlated subquery, and why can it be slow?**

A subquery that uses a column of the outer query, so in principle it runs once per outer row. On large tables that can be many runs. Rewriting it as a join with `GROUP BY`, or as a window function, usually lets Postgres do one pass.

**Q: CTE or subquery: which is faster?**

In Postgres 12 and later, usually the same: a CTE used once is folded into the main query like a subquery. Pick by readability. (`WITH x AS MATERIALIZED (…)` forces Postgres to compute it once and keep the result.)

**Q: How would you list everyone under a manager, at any depth?**

`WITH RECURSIVE`: the anchor selects the manager's direct reports, the recursive part joins employees whose `manager_id` is in the previous round, with a depth counter. It's breadth-first search written in SQL.
