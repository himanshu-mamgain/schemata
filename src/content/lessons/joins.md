> 💡 **In one line:** a join puts rows from two tables side by side wherever a condition matches, usually "this column holds that row's id". The shop keeps employees and departments in separate tables; a join shows each employee next to their department's name.

## Primary keys and foreign keys

Data is split into tables so each fact is stored once. The department called "Engineering" is written in one row of `departments`, not on each of its 6 employees. If it's renamed, you change one row.

Two kinds of key connect the tables:

- A **primary key** (PK) is the column that identifies one row: `departments.id`. No two rows share a value, and it's never NULL.
- A **foreign key** (FK) is a column that holds another table's primary key: `employees.department_id` holds a `departments.id`. Postgres checks it: you can't give an employee `department_id = 99` when department 99 doesn't exist.

The shop's links:

| Foreign key | Points at | Means |
| --- | --- | --- |
| `employees.department_id` | `departments.id` | the employee's team (NULL for Ananya: no team) |
| `employees.manager_id` | `employees.id` | the employee's manager: a link inside one table |
| `orders.customer_id` | `customers.id` | who placed the order |
| `order_items.order_id` | `orders.id` | which order the line belongs to |
| `order_items.product_id` | `products.id` | which product was bought |
| `customers.referred_by` | `customers.id` | the customer who invited them |
| `logins.user_id` | `customers.id` | who logged in |

Press **Diagram** on any question page to see these links drawn.

## INNER JOIN: only the rows that match

```sql
SELECT e.name, e.department_id, d.id, d.name AS department
FROM employees e
JOIN departments d ON d.id = e.department_id
WHERE e.id IN (1, 7, 21);
```

- `employees e` gives the table a short name (an **alias**), so you can write `e.name`. Both tables have a `name` column, so you must say which one.
- `ON d.id = e.department_id` is the **join condition**: put a department next to an employee when this is true.
- `JOIN` on its own means `INNER JOIN`.

Follow the three employees asked for:

| Employee | `department_id` | Matching department | In the result? |
| --- | --- | --- | --- |
| Asha Rao (id 1) | 1 | Engineering | yes |
| Arjun Menon (id 7) | 2 | Sales | yes |
| Ananya Ghosh (id 21) | NULL | none: NULL equals nothing | **no** |

An inner join drops rows with no match on either side. Over the whole table, 21 employees give 20 rows.


```steps join-inner
```

## LEFT JOIN: keep every row on the left

`LEFT JOIN` keeps every row of the first (left) table. Where nothing matches, the right table's columns are NULL:

```sql
SELECT e.name, d.name AS department
FROM employees e
LEFT JOIN departments d ON d.id = e.department_id
WHERE e.id IN (1, 21);
```

Ananya now appears, with a NULL department. Over the whole table: 21 rows.


```steps join-left
```

The most common use is counting, including the zeros. People per department, with the empty Research team too:

```sql
SELECT d.name AS department, COUNT(e.id) AS people
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
GROUP BY d.name
ORDER BY people DESC, department;
```

Research shows 0. It must be `COUNT(e.id)`, not `COUNT(*)`: Research's row exists (with NULL employee columns), so `COUNT(*)` counts it as 1. `COUNT(e.id)` skips the NULL and gives 0.

### Where you filter changes the answer

With a `LEFT JOIN`, a condition on the right table means different things in `ON` and in `WHERE`. Count each customer's cancelled orders:

```sql
SELECT c.name, COUNT(o.id) AS cancelled_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'cancelled'
WHERE c.id IN (1, 2, 3)
GROUP BY c.id, c.name
ORDER BY c.id;
```

Customers 1, 2 and 3 show 8, 0 and 0. Now move the status test to `WHERE`:

```sql
SELECT c.name, COUNT(o.id) AS cancelled_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'cancelled' AND c.id IN (1, 2, 3)
GROUP BY c.id, c.name
ORDER BY c.id;
```

Only Customer 1 is left. `WHERE` runs after the join: customers 2 and 3 have no cancelled orders, their rows fail `o.status = 'cancelled'`, and they're dropped. The LEFT JOIN has quietly become an INNER JOIN.

> 💡 Rule of thumb: conditions on the right-hand table of a `LEFT JOIN` go in `ON`; conditions that should remove left rows go in `WHERE`.

## RIGHT, FULL and CROSS JOIN

| Join | Keeps | Employees with departments |
| --- | --- | --- |
| `RIGHT JOIN` | every row of the right table | every department, Research with NULL employee columns. It's a `LEFT JOIN` written the other way round; most people only write LEFT. |
| `FULL JOIN` | unmatched rows from both sides | 22 rows: the 20 matches, Ananya (no department) and Research (no employees) |
| `CROSS JOIN` | every combination, no condition | 21 × 6 = 126 rows |

```sql
SELECT e.name AS employee, d.name AS department
FROM employees e
FULL JOIN departments d ON d.id = e.department_id
WHERE e.id IS NULL OR d.id IS NULL;
```

This shows only the two unmatched rows: a quick way to find data that doesn't line up.

A `CROSS JOIN` is useful when you want every combination on purpose: every category in every size.

```sql
SELECT p.category, s.size
FROM (SELECT DISTINCT category FROM products) p
CROSS JOIN (VALUES ('S'), ('M')) AS s(size)
ORDER BY 1, 2;
```

4 categories × 2 sizes = 8 rows.

## Self joins: a table joined to itself

`employees.manager_id` points at another row of `employees`. To show each person next to their manager, use the same table twice, with two aliases:

```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.id
LIMIT 5;
```

Read `e` as "the employee" and `m` as "their manager". Vikram Shah's `manager_id` is 1, so `m` is the row with id 1: Asha Rao. The `LEFT JOIN` keeps Asha herself, who has no manager. The same trick works for `customers.referred_by` (who invited whom).

## Semi joins and anti joins

Sometimes you don't want the other table's columns: only to know whether a match **exists**.

**Semi join**: customers who have at least one cancelled order.

```sql
SELECT COUNT(*) AS customers_with_a_cancellation
FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.id AND o.status = 'cancelled'
);
```

18 customers. A plain `JOIN` would return 150 rows here: one per cancelled order, so a customer with 8 cancellations appears 8 times. `EXISTS` asks "is there at least one?" and keeps each customer once. (`SELECT 1` is a convention: `EXISTS` only checks whether a row exists, not what's in it.)

**Anti join**: customers who have **never** ordered. Two common ways, both give 23:

```sql
SELECT COUNT(*) AS never_ordered
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

```sql
SELECT COUNT(*) AS never_ordered
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
```

The second keeps every customer, then keeps only those where the order side came back empty. Test a column that can only be NULL when there was no match, such as the order's primary key.

## Why NOT IN breaks with NULLs

A third way to write an anti join looks natural, but it has a trap. Departments with nobody in them:

```sql
SELECT name
FROM departments
WHERE id NOT IN (SELECT department_id FROM employees);
```

0 rows, although Research is empty. The list from the subquery contains Ananya's NULL. For Research (id 6), `6 NOT IN (1, 2, …, NULL)` means "6 ≠ 1 and 6 ≠ 2 and … and 6 ≠ NULL". The last test is unknown, so the whole condition is unknown, and the row is dropped. One NULL in the list empties the whole answer.

`NOT EXISTS` doesn't have this problem, and it returns Research:

```sql
SELECT name
FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id = d.id);
```

> ⚠️ Prefer `NOT EXISTS` for "has no match". If you use `NOT IN` with a subquery, add `WHERE column IS NOT NULL` inside it.

## Join fan-out: when joins multiply rows

A join returns one row per matching **pair**. When one row matches several rows, it's repeated once for each. Order 2 has 3 lines, so it appears 3 times:

```sql
SELECT o.id, o.customer_id, oi.product_id, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = 2;
```

```steps fan-out
```

That's correct when you want lines. It goes wrong when you count or add up something that belongs to the order, not the line. Customer 75 has 9 orders:

```sql
SELECT COUNT(*) AS rows_after_join, COUNT(DISTINCT o.id) AS orders
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.customer_id = 75;
```

`COUNT(*)` says 27: it counts lines. `COUNT(DISTINCT o.id)` says 9.

It gets worse with two one-to-many joins at once. Customer 3 has 8 orders and 42 login days. Joining both repeats every order once per login:

```sql
SELECT COUNT(*) AS rows_after_join,
       COUNT(DISTINCT o.id) AS orders,
       COUNT(DISTINCT l.login_date) AS login_days
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN logins l ON l.user_id = c.id
WHERE c.id = 3;
```

8 × 42 = 336 rows. Any `SUM` over this would be 42 times too big for orders and 8 times too big for logins. Count each side on its own instead (a subquery or a CTE per side), then combine:

```sql
SELECT c.id,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders,
       (SELECT COUNT(*) FROM logins l WHERE l.user_id = c.id)     AS login_days
FROM customers c
WHERE c.id = 3;
```

> ⚠️ Before you `SUM` after a join, ask: "how many rows does one thing become?" If the answer can be more than 1, aggregate first and join after.

## Mistakes to avoid

> ⚠️ **Inner join when you needed every row**: employees without a department, products never sold, customers who never ordered: they all vanish. Use `LEFT JOIN` when the question says "all" or "including those with none".

> ⚠️ **`WHERE` on the right table of a `LEFT JOIN`**: it turns it back into an inner join. Move the condition into `ON`.

> ⚠️ **`COUNT(*)` with a `LEFT JOIN`**: counts the NULL row as 1. Count a column of the right table.

> ⚠️ **`NOT IN` with a subquery that can contain NULL**: returns nothing. Use `NOT EXISTS`.

## Interview questions

**Q: What's the difference between INNER JOIN and LEFT JOIN?**

An inner join keeps only rows that have a match on both sides. A left join keeps every row of the left table and fills the right side with NULLs when there's no match. Employees joined to departments: 20 rows inner, 21 left (Ananya has no department).

**Q: How do you find rows with no match in another table?**

An anti join: `WHERE NOT EXISTS (SELECT 1 FROM other WHERE other.fk = t.id)`, or `LEFT JOIN other … WHERE other.id IS NULL`. Avoid `NOT IN (subquery)`: a single NULL in the subquery makes it return nothing.

**Q: Your revenue total doubled after you added a join. Why?**

Join fan-out: the new table has several rows per row you were summing, so each value is repeated. Aggregate the detail table first (in a subquery or CTE), then join the totals.
