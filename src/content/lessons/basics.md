> 💡 **In one line:** a relational database keeps data in tables, and SQL is the language you use to ask it questions. This lesson teaches you to read one table: pick columns with `SELECT`, keep the rows you want with `WHERE`, and sort and trim them with `ORDER BY` and `LIMIT`. Every example runs on the shop data: press **Run** to see the real result.

## Tables, rows, columns and types

A **relational database** stores data in **tables**. A table is like a spreadsheet with strict rules:

- Each **row** is one thing: one customer, one order, one product.
- Each **column** is one fact about that thing: its name, its price, its city.
- Each column has a **type** (number, text, date…), and every value in it must fit that type. You can't put "hello" in a price column.

The shop that every Schemata question uses has 7 tables:

| Table | One row is… | Rows |
| --- | --- | --- |
| `customers` | a person who signed up | 203 |
| `orders` | one order a customer placed | 1,500 |
| `order_items` | one product line inside an order (product, quantity, price) | 3,000 |
| `products` | something the shop sells | 15 |
| `employees` | a person who works at the shop | 21 |
| `departments` | a team, such as Engineering or Sales | 6 |
| `logins` | one day a customer logged in | 1,952 |

Most tables have an `id` column: a number that is different on every row, so you can point at exactly one row. That column is the table's **primary key**. Other tables store that number to say "this belongs to that": `orders.customer_id` holds the `id` of the customer who placed the order. The [Joins lesson](/topics/joins) uses those links to combine tables.

## SELECT: choose columns and calculate

`SELECT` says which columns you want; `FROM` says which table. `*` means "every column", which is handy for a first look:

```sql
SELECT * FROM products LIMIT 3;
```

You get `id`, `name`, `category`, `price` and `stock` for 3 products. In real code, name the columns you need instead of `*`: the query is clearer, and it doesn't break when someone adds a column.

A column in `SELECT` can also be a **calculation**. `AS` gives the result column a name (an **alias**). Here is every price with 18% GST (India's goods and services tax) added, rounded to 2 decimal places:

```sql
SELECT name, price, ROUND(price * 1.18, 2) AS price_with_gst
FROM products
ORDER BY price DESC
LIMIT 4;
```

The Standing Desk costs 24999.00, and 24999.00 × 1.18 = 29498.82. The calculation runs once per row, and the table itself doesn't change: `SELECT` only reads.

## WHERE: keep the rows you want

`WHERE` keeps only the rows for which a condition is true. You compare with `=`, `<>` (not equal), `<`, `>`, `<=` and `>=`, and combine conditions with `AND`, `OR` and `NOT`.

```sql
SELECT name, category, price
FROM products
WHERE category = 'Books' AND price < 2000;
```

3 rows: the three books under 2000. *Database Internals* costs 2199.00, so it's left out. Text goes in single quotes: `'Books'`. Double quotes mean something else in SQL (a column or table name).


```steps where-filter
```

### AND is done before OR

This is the most common `WHERE` bug. You want books and groceries under 1000:

```sql
SELECT name, category, price
FROM products
WHERE category = 'Books' OR category = 'Grocery' AND price < 1000;
```

You get 6 rows, including *Database Internals* at 2199.00. SQL does `AND` before `OR`, the same way maths does × before +, so it read this as "Books, **or** (Grocery under 1000)". Brackets fix it:

```sql
SELECT name, category, price
FROM products
WHERE (category = 'Books' OR category = 'Grocery') AND price < 1000;
```

Now 3 rows: *Clean Code* (999.00), the coffee (899.00) and the tea (399.00).

> ⚠️ Whenever a `WHERE` mixes `AND` and `OR`, add brackets, even when you think you don't need them.

### Shortcuts: IN, BETWEEN, LIKE

| Write | Means | Example |
| --- | --- | --- |
| `city IN ('Mumbai', 'Pune')` | equal to any value in the list | 52 customers live in Mumbai or Pune |
| `salary BETWEEN 100000 AND 125000` | from 100000 **to** 125000, both ends included | 6 employees, including two on exactly 125000 |
| `name LIKE '%Desk%'` | text pattern: `%` is any run of characters, `_` is exactly one | *Standing Desk* and *Desk Lamp* |
| `name ILIKE 'd%'` | like `LIKE`, but ignores upper and lower case | 3 products starting with D or d |

```sql
SELECT name, salary
FROM employees
WHERE salary BETWEEN 100000 AND 125000
ORDER BY salary;
```

## NULL: the value that isn't there

**NULL** means "no value": unknown or missing. It is not zero and not an empty text `''`. In the shop, three employees have no email address, so their `email` is NULL.

The trap: any comparison with NULL gives neither true nor false, but a third answer, **unknown**. `WHERE` keeps a row only when its condition is true, so unknown rows are dropped:

```sql
SELECT name, email FROM employees WHERE email = NULL;
```

0 rows, even though 3 emails are missing. `email = NULL` asks "is this email equal to an unknown value?", and the answer is unknown, every time. Use `IS NULL` (or `IS NOT NULL`):

```sql
SELECT name, email FROM employees WHERE email IS NULL;
```

Now you get Kabir Singh, Divya Pillai and Rahul Jain.

```steps null-compare
```

This is called **three-valued logic**: true, false and unknown. Run this to see how each operator treats NULL:

```sql
SELECT NULL = NULL AS equal,
       NULL <> 1    AS not_equal,
       NULL AND false AS and_false,
       NULL OR true   AS or_true,
       1 + NULL       AS plus;
```

| Expression | Result | Why |
| --- | --- | --- |
| `NULL = NULL` | NULL (unknown) | Two unknowns may or may not be equal |
| `NULL <> 1` | NULL | Unknown might be 1 |
| `NULL AND false` | false | Whatever the unknown is, AND with false is false |
| `NULL OR true` | true | Whatever the unknown is, OR with true is true |
| `1 + NULL` | NULL | Any arithmetic with NULL is NULL |

`COALESCE(a, b)` returns the first value that isn't NULL. Use it to show something friendlier:

```sql
SELECT name, COALESCE(email, 'no email') AS contact
FROM employees
WHERE department_id = 5;
```

> ⚠️ `NOT IN` and NULL: Ananya Ghosh has no department (`department_id` is NULL). You might expect `WHERE department_id NOT IN (1, 2, 3, 4, 5)` to find her. It returns nothing: "is NULL not one of these?" is unknown, so her row is dropped. Write `WHERE department_id IS NULL` instead.

```sql
SELECT name, department_id
FROM employees
WHERE department_id NOT IN (1, 2, 3, 4, 5);
```

## ORDER BY, LIMIT and DISTINCT

Without `ORDER BY`, the database returns rows in whatever order is fastest for it, and that order can change from one run to the next. If the order matters, say so.

- `ORDER BY salary DESC` sorts from highest to lowest; `ASC` (the default) from lowest to highest.
- `ORDER BY category, name` sorts by category, and by name inside each category.
- `LIMIT 3` keeps the first 3 rows; `OFFSET 10` skips the first 10 (for "page 2").

```sql
SELECT name, salary
FROM employees
ORDER BY salary DESC
LIMIT 5;
```

The 5th row is Rohan Das on 150000. But Meera Iyer also earns 150000, so which of the two comes 5th is up to the database. When ties matter, add a second sort key that breaks them: `ORDER BY salary DESC, name`.

**Where do NULLs go?** In Postgres, NULLs sort as if they were bigger than every value: last with `ASC`, first with `DESC`. Ananya's missing department comes first here:

```sql
SELECT name, department_id
FROM employees
ORDER BY department_id DESC
LIMIT 3;
```

Add `NULLS LAST` (or `NULLS FIRST`) to choose: `ORDER BY department_id DESC NULLS LAST`.

**DISTINCT** removes duplicate rows from the result. 203 customers live in only 8 cities:

```sql
SELECT DISTINCT city FROM customers ORDER BY city;
```

`COUNT(DISTINCT country)` counts different values: the customers come from 3 countries (India, UAE and Singapore).

## CASE: if-then inside a query

`CASE` picks a value by checking conditions in order, and stops at the first one that is true. It is SQL's if-else.

```sql
SELECT name, stock,
       CASE WHEN stock = 0  THEN 'sold out'
            WHEN stock < 50 THEN 'running low'
            ELSE 'plenty'
       END AS availability
FROM products
ORDER BY stock;
```

3 products are sold out, 4 are running low (12 to 45 left), and 8 have plenty. A product with 0 stock also has fewer than 50, but it gets "sold out" because that condition comes first. Without an `ELSE`, rows that match nothing get NULL.

## Data types that matter

| Type | Holds | In the shop |
| --- | --- | --- |
| `INT` | whole numbers | `stock`, `salary`, every `id` |
| `NUMERIC(10,2)` | exact decimals: up to 10 digits, 2 after the point | `price`, `unit_price` |
| `TEXT` | text of any length | `name`, `city`, `status` |
| `DATE` | a calendar day, no time | `order_date`, `hire_date` |
| `TIMESTAMPTZ` | a moment in time, with time zone | (not in the shop; use it for "created at") |
| `BOOLEAN` | true or false | (results of comparisons) |
| `JSONB` | a JSON document stored in a column | see [Beyond relational](/topics/nosql) |

Three behaviours to know:

```sql
SELECT 7 / 2       AS whole_division,
       7 / 2.0     AS decimal_division,
       0.1::float8 + 0.2::float8 AS float_sum,
       0.1 + 0.2   AS numeric_sum;
```

- **Whole-number division drops the remainder**: `7 / 2` is 3. Make one side a decimal (`7 / 2.0`, or `100.0 * …`) to get 3.5. This matters in every "percentage" question.
- **Floating-point numbers are approximate**: `0.1 + 0.2` as `float8` is 0.30000000000000004. `NUMERIC` is exact (0.3), so money is always `NUMERIC`.
- **Casting** changes a type: `'2025-03-01'::date` or `CAST('42' AS int)`.

Dates do arithmetic in days:

```sql
SELECT DATE '2025-03-01' + 30 AS thirty_days_later,
       DATE '2025-03-31' - DATE '2025-03-01' AS days_between;
```

## Mistakes to avoid

> ⚠️ **`= NULL` instead of `IS NULL`**: it never matches anything.

> ⚠️ **Mixing `AND` and `OR` without brackets**: `AND` runs first and quietly changes your question.

> ⚠️ **Relying on row order without `ORDER BY`**: it can change between runs. And with ties, add a second sort key.

> ⚠️ **Whole-number division in percentages**: `count / total` is 0 for every share below 1. Write `100.0 * count / total`.

## Interview questions

**Q: What's the difference between `NULL`, `0` and `''`?**

`0` is a number and `''` is text with no characters: both are real values you can compare. NULL means the value is missing or unknown, so comparing it with `=` gives unknown. Test it with `IS NULL`.

**Q: Does `BETWEEN 100 AND 200` include 100 and 200?**

Yes, both ends. For dates with times, prefer `>= start AND < next_day`, so you don't miss times later on the last day.

**Q: Why might `SELECT … LIMIT 10` return different rows each time?**

Without `ORDER BY`, the order isn't defined, so "the first 10" isn't either. Always sort before `LIMIT`, with a tie-breaker if values can repeat.

