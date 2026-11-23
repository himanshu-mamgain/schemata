> 💡 **In one line:** aggregation turns many rows into a few summary numbers: how many, how much, the average, the biggest. With `GROUP BY` you get those numbers per group (per city, per month, per department) instead of one for the whole table.

## Aggregate functions: COUNT, SUM, AVG, MIN, MAX

An **aggregate function** reads many rows and returns one value. Here are the most used ones on all 21 employees at once:

```sql
SELECT COUNT(*)                      AS people,
       COUNT(email)                  AS with_email,
       COUNT(DISTINCT department_id) AS departments,
       SUM(salary)                   AS payroll,
       ROUND(AVG(salary), 2)         AS average_salary,
       MIN(hire_date)                AS first_hire,
       MAX(salary)                   AS top_salary
FROM employees;
```

| Function | Returns | Here |
| --- | --- | --- |
| `COUNT(*)` | the number of rows | 21 |
| `COUNT(email)` | the number of rows where `email` **is not NULL** | 18 (3 emails are missing) |
| `COUNT(DISTINCT department_id)` | the number of different non-NULL values | 5 (Ananya's NULL isn't counted) |
| `SUM(salary)` | the total | 2,535,000 |
| `AVG(salary)` | the mean: total ÷ number of values | 2,535,000 ÷ 21 = 120,714.29 |
| `MIN`, `MAX` | the smallest and largest | first hire 2018-02-01; top salary 250,000 |

### Aggregates skip NULLs

Every aggregate except `COUNT(*)` ignores NULLs. That changes averages:

```sql
SELECT SUM(x) AS total, AVG(x) AS average, COUNT(x) AS counted, COUNT(*) AS all_rows
FROM (VALUES (10), (NULL), (20)) AS t(x);
```

The average is 15, not 10: it's (10 + 20) ÷ 2, because the NULL isn't a value. If a missing value should count as 0, say so: `AVG(COALESCE(x, 0))` gives 10.

And when there are no rows at all, `SUM` returns NULL, not 0. The Research department has nobody:

```sql
SELECT SUM(salary) AS payroll, COALESCE(SUM(salary), 0) AS payroll_or_zero
FROM employees
WHERE department_id = 6;
```

## GROUP BY: one summary per group

`GROUP BY` splits the rows into groups that share a value, then runs the aggregates once per group. You get one result row per group.

```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC;
```

The 1,500 orders fall into 3 groups: 1,200 delivered, 150 cancelled and 150 pending.

Follow one group through. For `department_id`:

```sql
SELECT department_id,
       COUNT(*)           AS people,
       SUM(salary)        AS payroll,
       ROUND(AVG(salary)) AS avg_salary
FROM employees
GROUP BY department_id
ORDER BY department_id;
```

| Step | Department 4 (Finance) |
| --- | --- |
| 1. Rows with `department_id = 4` go into one group | Karan (160000), Neha (125000), Aditya (125000) |
| 2. `COUNT(*)` | 3 |
| 3. `SUM(salary)` | 160000 + 125000 + 125000 = 410000 |
| 4. `AVG(salary)` | 410000 ÷ 3 = 136666.67, rounded to 136667 |

```steps group-by
```

Notice the last row: NULL is a group too. Ananya, who has no department, makes a group of 1.

**Grouping by several columns** makes a group for each combination: `GROUP BY country, city` gives a row for "India, Mumbai", another for "UAE, Mumbai", and so on (22 combinations).

### The GROUP BY rule

After grouping, each result row stands for a whole group. So every column in `SELECT` must either be in `GROUP BY` (the same for the whole group) or inside an aggregate (one value made from the group). This fails:

```sql error
SELECT department_id, name, COUNT(*)
FROM employees
GROUP BY department_id;
```

Department 1 has 6 people: which `name` should its one row show? Postgres refuses to guess: *column "employees.name" must appear in the GROUP BY clause or be used in an aggregate function*. If you want the names, aggregate them: `string_agg(name, ', ')` joins them into one text.

## WHERE vs HAVING

Both filter, at different moments:

- `WHERE` filters **rows**, before grouping. It can't use aggregates: when it runs, there are no groups yet.
- `HAVING` filters **groups**, after grouping. It can test `COUNT(*)`, `SUM(…)` and so on.

```sql
SELECT department_id, COUNT(*) AS people
FROM employees
WHERE department_id IS NOT NULL      -- rows: drop people with no department
GROUP BY department_id
HAVING COUNT(*) >= 4                 -- groups: keep departments with 4 or more
ORDER BY department_id;
```

Departments 1 (6 people), 2 (4) and 5 (4) stay. Putting the count in `WHERE` fails:

```sql error
SELECT department_id, COUNT(*)
FROM employees
WHERE COUNT(*) >= 4
GROUP BY department_id;
```

> 💡 Put every filter you can in `WHERE`, and only filters on aggregates in `HAVING`. Fewer rows reach the grouping, so the query does less work.

## The order a query runs in

You write `SELECT` first, but the database runs the parts in this order:

| Step | Clause | What it does |
| --- | --- | --- |
| 1 | `FROM` (and joins) | picks the tables and puts rows together |
| 2 | `WHERE` | drops rows |
| 3 | `GROUP BY` | makes groups |
| 4 | `HAVING` | drops groups |
| 5 | `SELECT` | works out the output columns, including aliases |
| 6 | `DISTINCT` | removes duplicate output rows |
| 7 | `ORDER BY` | sorts |
| 8 | `LIMIT` / `OFFSET` | keeps a slice |

```steps query-order
```

This order explains most error messages:

- `WHERE` can't use an alias from `SELECT`: the alias doesn't exist yet at step 2.
- `ORDER BY` *can* use an alias (`ORDER BY people DESC`): it runs after `SELECT`.
- `WHERE` can't use `COUNT(*)`: the groups come at step 3.

## Dates: grouping by month, week, quarter

`date_trunc('month', d)` rounds a date down to the start of its month: 17 March 2025 becomes 1 March 2025. All the dates in a month then share one value, so you can group by it.

```sql
SELECT date_trunc('month', order_date)::date AS month,
       COUNT(*) AS orders
FROM orders
GROUP BY 1
ORDER BY 1;
```

January has 128 orders, February 116, March 128. `date_trunc` returns a timestamp (a date with a time), so `::date` turns it back into a plain date. `GROUP BY 1` means "group by the first column in `SELECT`": short, but it breaks if someone reorders the columns.

Other useful pieces:

| Write | Gives for 2025-03-17 |
| --- | --- |
| `date_trunc('week', d)` | the Monday of that week: 2025-03-17 |
| `date_trunc('quarter', d)` | 2025-01-01 |
| `extract(month FROM d)` | 3 |
| `extract(dow FROM d)` | 1 (day of week: 0 is Sunday) |
| `to_char(d, 'Mon YYYY')` | Mar 2025 |

> ⚠️ Grouping by `extract(month …)` alone puts March 2024 and March 2025 together. Use `date_trunc`, which keeps the year.

## Conditional aggregation with FILTER

Often you want several counts side by side: all orders, delivered ones, cancelled ones. `FILTER (WHERE …)` makes an aggregate count only some rows:

```sql
SELECT COUNT(*) AS orders,
       COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'cancelled') / COUNT(*), 1) AS cancelled_pct
FROM orders;
```

150 of 1,500 orders were cancelled: 150 ÷ 1500 × 100 = 10.0%. The `100.0` (not `100`) makes Postgres divide with decimals; with whole numbers, 150 / 1500 would be 0.

Combine it with `GROUP BY` for a small report, one row per quarter:

```sql
SELECT date_trunc('quarter', order_date)::date AS quarter,
       COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
       COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders
GROUP BY 1
ORDER BY 1;
```

Other databases don't all have `FILTER`. The portable way is `SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)`, which gives the same 1,200.

## Medians and percentiles

The **mean** (`AVG`) adds everything and divides. One very large value pulls it up. The **median** is the middle value once the values are sorted, so one outlier barely moves it.

Engineering's six salaries, sorted: 95000, 120000, 150000, 150000, 180000, 250000.

- Mean: 945000 ÷ 6 = 157500. The CEO's 250000 pulls it up.
- Median: with an even count, the average of the two middle values: (150000 + 150000) ÷ 2 = 150000.

```sql
SELECT department_id,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median,
       ROUND(AVG(salary)) AS mean
FROM employees
WHERE department_id IS NOT NULL
GROUP BY department_id
ORDER BY department_id;
```

- `PERCENTILE_CONT(0.5)` gives the median, averaging the two middle values when needed. `0.9` gives the 90th percentile: the value 90% of rows are at or below.
- `PERCENTILE_DISC(0.5)` always returns a value that is really in the data (it doesn't average).
- `WITHIN GROUP (ORDER BY salary)` says which values to sort.

## Mistakes to avoid

> ⚠️ **`COUNT(column)` when you meant `COUNT(*)`**: it skips NULLs. `COUNT(email)` is 18, not 21.

> ⚠️ **Filtering a total in `WHERE`**: aggregates belong in `HAVING`.

> ⚠️ **Joining before you aggregate, and counting twice**: when one order has 3 lines, joining orders to lines repeats the order 3 times, so `COUNT(*)` counts lines, not orders. The [Joins lesson](/topics/joins#join-fan-out-when-joins-multiply-rows) shows this.

> ⚠️ **`SUM` of nothing is NULL**: wrap it in `COALESCE(…, 0)` when a 0 is what you mean.

## Interview questions

**Q: What's the difference between `COUNT(*)`, `COUNT(col)` and `COUNT(DISTINCT col)`?**

`COUNT(*)` counts rows. `COUNT(col)` counts rows where `col` isn't NULL. `COUNT(DISTINCT col)` counts different non-NULL values. On employees: 21, 18 for `email`, and 5 for `department_id`.

**Q: Why can't you use a column alias in `WHERE`?**

`WHERE` runs before `SELECT`, so the alias doesn't exist yet. Repeat the expression, or wrap the query in a subquery or a CTE and filter outside.

**Q: Mean or median for "typical salary"?**

The median, when a few very high values exist: one large salary moves the mean a lot and the median hardly at all. Here Engineering's mean is 157500, its median 150000.
