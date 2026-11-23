> 💡 **In one line:** a window function computes something across a set of related rows (a rank, a running total, the previous month's value) **without** collapsing them into one row the way `GROUP BY` does. Every row stays, and gains a new column.

## OVER: what a window is

With `GROUP BY`, Finance's 3 employees become one row holding their average. With a **window function**, each of the 3 rows stays and gets the average beside it:

```sql
SELECT name, salary,
       ROUND(AVG(salary) OVER (PARTITION BY department_id)) AS dept_avg,
       salary - ROUND(AVG(salary) OVER (PARTITION BY department_id)) AS vs_avg
FROM employees
WHERE department_id = 4;
```

| name | salary | dept_avg | vs_avg |
| --- | --- | --- | --- |
| Karan Malhotra | 160000 | 136667 | +23333 |
| Neha Joshi | 125000 | 136667 | −11667 |
| Aditya Kulkarni | 125000 | 136667 | −11667 |

`OVER (…)` turns a function into a window function, and says which rows each row looks at:

- `PARTITION BY department_id` splits the rows into groups (here, one per department). Each row only sees rows in its own partition. Without it, the window is the whole result.
- `ORDER BY …` sorts the rows inside each partition. Ranking functions and running totals need it.
- A **frame** (`ROWS BETWEEN …`) narrows the window further, for moving averages. More on that below.

`OVER ()` with nothing inside means "all rows". Each person's share of the whole payroll:

```sql
SELECT name, salary,
       ROUND(100.0 * salary / SUM(salary) OVER (), 1) AS pct_of_payroll
FROM employees
ORDER BY salary DESC
LIMIT 3;
```

Asha Rao earns 250000 of 2535000: 9.9%.

## ROW_NUMBER, RANK and DENSE_RANK

All three number the rows in order. They differ only on **ties**. Engineering has two people on 150000:

```sql
SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_number,
       RANK()       OVER (ORDER BY salary DESC) AS rank,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank
FROM employees
WHERE department_id = 1
ORDER BY salary DESC;
```

| name | salary | ROW_NUMBER | RANK | DENSE_RANK |
| --- | --- | --- | --- | --- |
| Asha Rao | 250000 | 1 | 1 | 1 |
| Vikram Shah | 180000 | 2 | 2 | 2 |
| Meera Iyer | 150000 | 3 | 3 | 3 |
| Rohan Das | 150000 | 4 | 3 | 3 |
| Kabir Singh | 120000 | 5 | **5** | **4** |
| Nisha Kapoor | 95000 | 6 | 6 | 5 |

- **ROW_NUMBER** gives every row a different number. Meera and Rohan get 3 and 4, but which one is 3 is up to the database, unless you add a tie-breaker (`ORDER BY salary DESC, name`).
- **RANK** gives ties the same number, then **skips**: after two 3rds comes 5th, like a race.
- **DENSE_RANK** gives ties the same number and **doesn't skip**: after two 3rds comes 4th.

```steps rank-functions
```

Which to use:

| The question says | Use |
| --- | --- |
| "the 3rd highest **distinct** salary" | `DENSE_RANK() = 3` |
| "top 3, ties included" | `RANK() <= 3` |
| "exactly one row per group" (latest order, first login) | `ROW_NUMBER() = 1` with a tie-breaker |

## Top-N per group

"The 2 best-paid people in each department" is the most asked window question. Number the rows inside each department, then keep numbers 1 and 2:

```sql
SELECT department_id, name, salary
FROM (
  SELECT department_id, name, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, name) AS rn
  FROM employees
  WHERE department_id IS NOT NULL
) ranked
WHERE rn <= 2
ORDER BY department_id, rn;
```

In Finance, Neha and Aditya both earn 125000; the tie-breaker `name` puts Aditya first, so he's the 2nd. Swap `ROW_NUMBER` for `RANK` and both would be kept.

Why the subquery? Window functions run after `WHERE` (they're worked out with the `SELECT` columns), so you can't filter on them directly:

```sql error
SELECT name, salary, RANK() OVER (ORDER BY salary DESC) AS r
FROM employees
WHERE RANK() OVER (ORDER BY salary DESC) <= 3;
```

*window functions are not allowed in WHERE*. Compute them in a subquery or CTE, then filter outside.

## LAG and LEAD: the row before and after

`LAG(x)` reads `x` from the previous row in the window's order; `LEAD(x)` from the next one. Month-over-month change, without joining the table to itself:

```sql
WITH m AS (
  SELECT date_trunc('month', order_date)::date AS month, COUNT(*) AS orders
  FROM orders
  GROUP BY 1
)
SELECT month, orders,
       LAG(orders)  OVER (ORDER BY month) AS previous,
       orders - LAG(orders) OVER (ORDER BY month) AS change,
       LEAD(orders) OVER (ORDER BY month) AS next
FROM m
ORDER BY month
LIMIT 4;
```

January has no previous month, so `previous` is NULL, and so is the change (anything minus NULL is NULL). February: 116 − 128 = −12. As a percentage: `ROUND(100.0 * (orders − previous) / previous, 1)`, which is −9.4% for February.

`LAG(orders, 12)` looks 12 rows back (the same month last year, with monthly rows); `LAG(orders, 1, 0)` gives 0 instead of NULL when there's no row.

## Running totals and moving averages

`SUM(x) OVER (ORDER BY day)` adds up everything from the first row to the current one: a **running total**. A **frame** sets exactly which rows count: `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` means "this row and the 2 before it", for a 3-day moving average.

```sql
WITH daily AS (
  SELECT o.order_date AS day, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'delivered'
  GROUP BY o.order_date
)
SELECT day, revenue,
       SUM(revenue) OVER (ORDER BY day) AS running_total,
       ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS avg_3_days
FROM daily
ORDER BY day
LIMIT 4;
```

| day | revenue | running_total | avg_3_days |
| --- | --- | --- | --- |
| 1 Jan | 127,591 | 127,591 | 127,591 (only 1 day so far) |
| 2 Jan | 164,778 | 127,591 + 164,778 = 292,369 | (127,591 + 164,778) ÷ 2 = 146,184.50 |
| 3 Jan | 24,985 | 317,354 | (127,591 + 164,778 + 24,985) ÷ 3 = 105,784.67 |
| 4 Jan | 103,686 | 421,040 | (164,778 + 24,985 + 103,686) ÷ 3 = 97,816.33 |

```steps running-total
```

Aggregate first (one row per day in the CTE), then apply the window. A window over the raw order lines would add every line separately.

### ROWS or RANGE: the default frame and ties

With `ORDER BY` and no frame, Postgres uses `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. "RANGE" counts every row with the **same value** as the current one, so tied rows get the same running total:

```sql
SELECT x,
       SUM(x) OVER (ORDER BY x) AS default_range,
       SUM(x) OVER (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_frame
FROM (VALUES (10), (20), (20), (30)) AS t(x);
```

With the default, both 20s show 50 (10 + 20 + 20). With `ROWS`, they show 30 and 50, one row at a time. Running totals over dates usually have one row per date, so both agree; when values can repeat, write the frame you mean.

## Gaps and islands

Finding runs of consecutive days ("streaks") is a classic hard question. Customer 1 logged in on 1, 2, 3 March, then 7, 8, 9, 10 March, then 14 to 17 March… Each run is an **island**; the missing days between are **gaps**.

The trick: number the logins in date order with `ROW_NUMBER`, and subtract that number (as days) from the date. Inside a run, the date and the number both go up by 1 each row, so the difference stays the same. A gap makes the date jump while the number doesn't, so the difference changes.

```sql
SELECT login_date,
       ROW_NUMBER() OVER (ORDER BY login_date) AS rn,
       login_date - (ROW_NUMBER() OVER (ORDER BY login_date))::int AS island
FROM logins
WHERE user_id = 1
ORDER BY login_date
LIMIT 8;
```

| login_date | rn | login_date − rn |
| --- | --- | --- |
| 1 Mar | 1 | 28 Feb |
| 2 Mar | 2 | 28 Feb |
| 3 Mar | 3 | 28 Feb |
| 7 Mar | 4 | **3 Mar** (a gap: the date jumped by 4, the number by 1) |
| 8 Mar | 5 | 3 Mar |
| 9 Mar | 6 | 3 Mar |
| 10 Mar | 7 | 3 Mar |
| 14 Mar | 8 | **6 Mar** |

```steps gaps-islands
```

Now group by that value: each group is one streak.

```sql
WITH g AS (
  SELECT login_date,
         login_date - (ROW_NUMBER() OVER (ORDER BY login_date))::int AS island
  FROM logins
  WHERE user_id = 1
)
SELECT MIN(login_date) AS starts, MAX(login_date) AS ends, COUNT(*) AS days
FROM g
GROUP BY island
ORDER BY days DESC, starts
LIMIT 3;
```

Customer 1's longest streaks are 4 days. Add `PARTITION BY user_id` to do every user at once: that's the [Longest login streak](/questions/login-streaks) question. The same pattern finds free seats in a row, uptime periods and user sessions.

## FIRST_VALUE, NTILE and friends

| Function | Gives |
| --- | --- |
| `FIRST_VALUE(name) OVER (PARTITION BY department_id ORDER BY salary DESC)` | the top earner's name on every row of their department |
| `NTILE(4) OVER (ORDER BY salary DESC)` | splits the rows into 4 nearly equal buckets (quartiles): 1 is the top quarter |
| `COUNT(*) OVER (PARTITION BY department_id)` | the department's size on each row |
| `PERCENT_RANK()` | the share of rows ranked below this one, from 0 to 1 |

```sql
SELECT name, department_id, salary,
       FIRST_VALUE(name) OVER (PARTITION BY department_id ORDER BY salary DESC) AS top_earner,
       NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees
ORDER BY salary DESC
LIMIT 6;
```

> ⚠️ `LAST_VALUE` surprises people. With the default frame, the window ends at the current row, so `LAST_VALUE(name) OVER (ORDER BY salary DESC)` is just the current row's name. Add `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` to see the whole partition.

## Mistakes to avoid

> ⚠️ **Filtering a window function in `WHERE`**: not allowed. Wrap it in a subquery or CTE.

> ⚠️ **`ROW_NUMBER` without a tie-breaker**: when values tie, which row gets 1 can change between runs. Add a unique column to the `ORDER BY`.

> ⚠️ **`RANK` when the question says "distinct"**: "3rd highest distinct salary" is `DENSE_RANK`; `RANK` skips numbers after ties.

> ⚠️ **Windowing before aggregating**: for a running total of daily revenue, make one row per day first, then apply `SUM() OVER`.

## Interview questions

**Q: What's the difference between `GROUP BY` and a window function?**

`GROUP BY` collapses each group into one row. A window function keeps every row and adds a value computed over its group (its "window"), so you can show a row next to its group's total, rank or average.

**Q: ROW_NUMBER, RANK or DENSE_RANK?**

On salaries 250, 180, 150, 150, 120: ROW_NUMBER gives 1, 2, 3, 4, 5; RANK gives 1, 2, 3, 3, 5; DENSE_RANK gives 1, 2, 3, 3, 4. "Nth distinct value" means DENSE_RANK; "top N with ties" means RANK; "one row per group" means ROW_NUMBER.

**Q: How do you find the longest streak of consecutive days?**

Gaps and islands: `date − ROW_NUMBER() OVER (PARTITION BY user ORDER BY date)` is constant inside a streak. Group by it, count the rows of each group, and take the maximum per user.
