> 💡 **In one line:** Postgres can keep more than tables. A **view** is a saved query. A **materialized view** is a saved *result*. A **function** is saved code that returns a value. A **procedure** is saved code you `CALL`, which may commit as it goes. A **trigger** runs a function by itself whenever rows change. Each one moves logic into the database: useful when every app must follow it, risky when nobody can see it.

## At a glance

| Object | What it stores | How you use it | Typical use |
| --- | --- | --- | --- |
| **View** | a query | `SELECT … FROM the_view` | hide a complex join; show only some columns |
| **Materialized view** | a query's result, on disk | `SELECT …`, then `REFRESH` | slow reports that may be a little out of date |
| **Function** | code that returns a value or rows | inside a query: `SELECT order_total(5)` | reusable calculations, rules, lookups |
| **Procedure** | code that returns nothing (or `INOUT` values) | `CALL restock(4, 50)` | jobs with several steps; batch work that commits as it goes |
| **Trigger** | "run this function when rows change" | runs by itself | audit logs, filling in columns, keeping totals in step |

## Views: a saved query

A **view** gives a name to a query. It stores no rows: each time you read it, Postgres runs the query again. Here, the spend of each customer on delivered orders:

```sql
CREATE VIEW customer_spend AS
SELECT c.id, c.name, c.city,
       COUNT(DISTINCT o.id) AS delivered_orders,
       SUM(oi.quantity * oi.unit_price) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name, c.city;

SELECT name, city, delivered_orders, spent
FROM customer_spend
ORDER BY spent DESC
LIMIT 3;
```

Customer 6 (Kolkata) is first: 9 delivered orders, 977,328 spent. Anyone can now ask that question with a one-line query, and the join logic lives in one place.

Because a view is only a query, Postgres puts its text into your query before planning. The plan shows the real tables, not the view:

```sql
CREATE VIEW customer_spend AS
SELECT c.id, c.name, SUM(oi.quantity * oi.unit_price) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name;

EXPLAIN (COSTS OFF) SELECT * FROM customer_spend WHERE id = 6;
```

`Seq Scan on customers`, `Bitmap Index Scan on orders_customer_idx`: the filter `id = 6` was pushed down into the view's query, so Postgres only looks at customer 6's orders. A view costs nothing extra; it is also never faster than its query.

What views are good for:

- **One definition of a number.** "Revenue" means delivered orders only, everywhere, because everyone reads the same view.
- **Hiding columns.** Give a team access to a view without the `email` column, and not to the table (`GRANT SELECT ON the_view TO analysts`).
- **Keeping old queries working** after you change the tables underneath: recreate the view to return the old shape.

A view over one table, with no `GROUP BY` or `DISTINCT`, can even take `INSERT`, `UPDATE` and `DELETE`: Postgres passes them through to the table.

## Materialized views: a saved result

A **materialized view** runs its query once and stores the rows on disk, like a table. Reading it is as fast as reading those rows, however slow the query was. The price: the rows don't change when the tables change, until you **refresh** it.

```sql
CREATE MATERIALIZED VIEW category_revenue AS
SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'delivered'
GROUP BY p.category;
CREATE UNIQUE INDEX ON category_revenue (category);

-- Order 22 (4 Standing Desks and a Desk Lamp) is cancelled:
UPDATE orders SET status = 'cancelled' WHERE id = 22;
SELECT revenue AS before_refresh FROM category_revenue WHERE category = 'Furniture';

REFRESH MATERIALIZED VIEW CONCURRENTLY category_revenue;
SELECT revenue AS after_refresh FROM category_revenue WHERE category = 'Furniture';
```

Before the refresh, Furniture still shows 15,198,750, counting a cancelled order. After it, 15,096,755: the 101,995 from order 22 (4 × 24,999 + 1,999) is gone.

```steps matview-refresh
```

- A plain `REFRESH` locks the materialized view: reads wait until it finishes.
- `REFRESH … CONCURRENTLY` lets people keep reading the old rows while the new ones are built. It needs a **unique index** on the materialized view, so Postgres can match old rows to new ones. Without one, it refuses:

```sql error
CREATE MATERIALIZED VIEW category_revenue AS
SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi JOIN products p ON p.id = oi.product_id
GROUP BY p.category;
REFRESH MATERIALIZED VIEW CONCURRENTLY category_revenue;
```

- A refresh always runs the **whole** query again, even if one row changed. Postgres has no built-in "update only what changed". For a huge result refreshed often, keep a summary table up to date with triggers instead (see below), or refresh on a schedule.

| | View | Materialized view | Summary table kept by triggers |
| --- | --- | --- | --- |
| Always up to date | yes | no: as of the last refresh | yes |
| Speed to read | as slow as the query | fast | fast |
| Cost | every read | every refresh: the whole query | every write: a little extra work |
| Can be indexed | no (the tables' indexes are used) | yes | yes |

## Functions: code that returns a value

A **function** takes arguments and returns a value, or rows. You use it inside a query, like `lower()` or `SUM()`. The simplest kind is written in SQL:

```sql
CREATE FUNCTION order_total(p_order_id int) RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(quantity * unit_price), 0)
  FROM order_items
  WHERE order_id = p_order_id
$$;

SELECT id, status, order_total(id) AS total
FROM orders
WHERE id <= 5
ORDER BY id;
```

- `$$ … $$` is a way of quoting the body, so quotes inside it need no escaping.
- `p_order_id` starts with `p_` so it can't be confused with a column name.

For conditions, loops and variables, use **PL/pgSQL** (Postgres's procedural language, built in):

```sql
CREATE FUNCTION price_band(p numeric) RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p < 1000 THEN
    RETURN 'budget';
  ELSIF p < 10000 THEN
    RETURN 'mid';
  ELSE
    RETURN 'premium';
  END IF;
END;
$$;

SELECT price_band(price) AS band, COUNT(*) AS products
FROM products
GROUP BY 1
ORDER BY MIN(price);
```

3 budget, 8 mid and 4 premium products. A function can also return a whole table: declare `RETURNS TABLE (…)`, and use it in `FROM`:

```sql
CREATE FUNCTION top_products(n int)
RETURNS TABLE (name text, revenue numeric)
LANGUAGE sql STABLE
AS $$
  SELECT p.name, SUM(oi.quantity * oi.unit_price)
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  GROUP BY p.name
  ORDER BY 2 DESC
  LIMIT n
$$;

SELECT * FROM top_products(3);
```

### IMMUTABLE, STABLE, VOLATILE

Every function says how its result can change. Postgres trusts this label to decide what it may skip or reuse:

| Label | Promise | Example | Allowed in an index? |
| --- | --- | --- | --- |
| `IMMUTABLE` | same arguments, same result, forever | `price_band(price)`, `lower(text)` | yes |
| `STABLE` | same result within one statement; may read tables | `order_total(id)`, `current_date` | no |
| `VOLATILE` (the default) | may change any time, may change data | `random()`, a function that inserts rows | no |

An index stores results to look them up later, so it only accepts `IMMUTABLE` functions. A function that uses today's date can't be one: its answer changes tomorrow.

```sql error
CREATE FUNCTION age_days(d date) RETURNS int
LANGUAGE sql STABLE
AS $$ SELECT current_date - d $$;

CREATE INDEX ON orders (age_days(order_date));
```

*functions in index expression must be marked IMMUTABLE*. `price_band` is `IMMUTABLE`, so `CREATE INDEX ON products (price_band(price))` works, and `WHERE price_band(price) = 'premium'` can use that index. Never label a function `IMMUTABLE` when it isn't: Postgres will believe you, and an index on it will hold wrong answers.

## Procedures: code you CALL

A **procedure** is like a function, with three differences:

- you run it with `CALL`, on its own, never inside a `SELECT`;
- it returns nothing, except through `INOUT` arguments;
- it may `COMMIT` or `ROLLBACK` partway through.

```sql
CREATE PROCEDURE restock(p_product int, p_qty int)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'restock quantity must be positive, got %', p_qty;
  END IF;
  UPDATE products SET stock = stock + p_qty WHERE id = p_product;
END;
$$;

CALL restock(4, 50);
SELECT name, stock FROM products WHERE id = 4;
```

The USB-C Hub goes from 0 to 50. `RAISE EXCEPTION` stops the procedure with an error, and the whole `CALL` is undone. A procedure can't be used inside a query:

```sql error
CREATE PROCEDURE restock(p_product int, p_qty int)
LANGUAGE plpgsql
AS $$ BEGIN UPDATE products SET stock = stock + p_qty WHERE id = p_product; END; $$;

SELECT restock(4, 50);
```

*restock(integer, integer) is a procedure*: use `CALL`.

What only a procedure can do is commit as it goes. A job that archives millions of rows can work in batches of 10,000 and `COMMIT` after each, so it never holds locks for an hour, and a failure halfway keeps the batches already done:

```sql norun
CREATE PROCEDURE archive_old_orders()
LANGUAGE plpgsql
AS $$
DECLARE
  moved int;
BEGIN
  LOOP
    WITH batch AS (
      DELETE FROM orders
      WHERE id IN (SELECT id FROM orders WHERE order_date < '2024-01-01' LIMIT 10000)
      RETURNING *
    )
    INSERT INTO orders_archive SELECT * FROM batch;
    GET DIAGNOSTICS moved = ROW_COUNT;
    EXIT WHEN moved = 0;
    COMMIT;  -- each batch is saved for good
  END LOOP;
END;
$$;

CALL archive_old_orders();
```

This only works when `CALL` isn't already inside a transaction: a `COMMIT` can't end a transaction the caller started. Every example here runs inside one (so it can be undone), which is why this one is shown but not run. Try it, and Postgres says *invalid transaction termination*:

```sql error
CREATE PROCEDURE commit_inside()
LANGUAGE plpgsql
AS $$ BEGIN UPDATE products SET stock = stock WHERE id = 1; COMMIT; END; $$;

CALL commit_inside();
```

### Function or procedure?

| | Function | Procedure |
| --- | --- | --- |
| How you run it | inside a query: `SELECT f(x)`, `WHERE f(x) = …`, `FROM f(x)` | `CALL p(x)`, on its own |
| Returns | a value, a row or a table | nothing, or `INOUT` arguments |
| Can change data | yes, in Postgres (if `VOLATILE`) | yes |
| `COMMIT` / `ROLLBACK` inside | never: it runs inside the caller's statement | yes, when called outside a transaction |
| Use it for | calculations, lookups, rules you use in queries | multi-step jobs, batch work, maintenance |

> 💡 Interview answers often come from SQL Server, where a function may not change any data at all. In Postgres a function can, so the real difference is how it's called and transaction control. Say which database you mean.

## Triggers: run code when rows change

A **trigger** tells Postgres to run a function by itself whenever rows are inserted, updated or deleted. The function sees the row before the change as `OLD` and after it as `NEW`.

**An audit log.** Every price change is recorded, whoever makes it and from whichever app:

```sql
CREATE TABLE price_history (
  product_id int NOT NULL,
  old_price  numeric(10,2) NOT NULL,
  new_price  numeric(10,2) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION log_price_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO price_history (product_id, old_price, new_price)
  VALUES (OLD.id, OLD.price, NEW.price);
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_price_audit
AFTER UPDATE OF price ON products
FOR EACH ROW
WHEN (OLD.price IS DISTINCT FROM NEW.price)
EXECUTE FUNCTION log_price_change();

UPDATE products SET price = price * 0.9 WHERE category = 'Books';  -- a 10% book sale
UPDATE products SET stock = stock + 1 WHERE id = 1;               -- not a price change
SELECT product_id, old_price, new_price FROM price_history ORDER BY product_id;
```

4 rows, one per book (1899.00 → 1709.10, and so on). The stock update logged nothing: `UPDATE OF price` limits the trigger to that column, and `WHEN` skips rows whose price didn't really change.

**Filling in a column.** A `BEFORE` trigger runs before the row is written, and can change `NEW`. If the app leaves out the price, take it from the product:

```sql
CREATE FUNCTION fill_unit_price() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.unit_price IS NULL THEN
    SELECT price INTO NEW.unit_price FROM products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_fill_price
BEFORE INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION fill_unit_price();

INSERT INTO orders VALUES (2001, 1, '2025-12-01', 'pending');
INSERT INTO order_items (order_id, product_id, quantity) VALUES (2001, 3, 1) RETURNING *;
```

`unit_price` is `NOT NULL`, yet the insert works: constraints are checked after `BEFORE` triggers, and by then the trigger has filled in 18999.00.

**Keeping another table in step.** An `AFTER` trigger reacts once the row is in. Taking stock for each order line, with a rule that stock can't go below zero:

```sql error
ALTER TABLE products ADD CONSTRAINT stock_not_negative CHECK (stock >= 0);

CREATE FUNCTION take_stock() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  RETURN NULL;  -- an AFTER trigger's return value is ignored
END;
$$;

CREATE TRIGGER order_items_take_stock
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION take_stock();

INSERT INTO orders VALUES (2001, 1, '2025-12-01', 'pending');
INSERT INTO order_items VALUES (2001, 10, 20, 24999.00);  -- 20 desks; only 12 in stock
```

The stock update breaks the `CHECK`, so the trigger fails, and so does the `INSERT` that fired it: the order line is never saved. The trigger runs inside the same statement and transaction (see [transactions](/topics/transactions#acid)). With a quantity of 2, both succeed, and the desk's stock goes from 12 to 10.

```steps trigger-flow
```

The order things happen in, for one row:

1. `BEFORE` row triggers, in name order. They can change `NEW`, or return `NULL` to skip the row.
2. `NOT NULL` and `CHECK` constraints are checked.
3. The row is written, and unique indexes check for duplicates.
4. `AFTER` row triggers run, at the end of the statement. They see the final row and can't change it. Foreign keys are checked here too, by triggers Postgres makes itself (or at `COMMIT`, if the constraint is deferred).

A `FOR EACH STATEMENT` trigger runs once per statement instead of once per row: cheaper when an `UPDATE` touches a million rows.

### The cost of triggers

- **Hidden work.** Someone reading `INSERT INTO order_items …` can't see that it also changes `products`. Name triggers clearly, and list them with `\d order_items` (in psql, Postgres's command-line client).
- **Speed.** A row trigger runs once per row: an `UPDATE` of 1,000,000 rows calls it 1,000,000 times.
- **Chains.** A trigger that updates a table with its own triggers can set off a chain, or a loop.
- **Bulk loads.** `COPY` and big imports fire every trigger too.

Use a constraint when it can say the rule (`CHECK`, `UNIQUE`, a foreign key): it's simpler and faster. Use a trigger when the rule needs another table, or for audit logs that must catch every change, from every app.

## How to choose

- **The same join or rule in many queries?** A view.
- **A slow report that may be minutes or hours old?** A materialized view, refreshed on a schedule. With a unique index and `CONCURRENTLY`, readers never wait.
- **A calculation you want inside queries, or in an index?** A function. Make it `IMMUTABLE` only if it truly is.
- **A job with several steps, or a batch that should commit as it goes?** A procedure.
- **Something that must happen on every change, whichever app makes it?** A trigger. Prefer a constraint when one can express the rule.
- **Business logic that changes often?** Usually the app's code, where it's tested, reviewed and deployed with everything else.

## Mistakes to avoid

> ⚠️ **Thinking a view makes a query faster.** It's the same query with a name. For speed, index the tables, or materialize it.

> ⚠️ **Forgetting that a materialized view goes stale.** Show "as of 10:00" next to its numbers, and refresh on a schedule.

> ⚠️ **`REFRESH` without `CONCURRENTLY` on a busy report.** Every reader waits until the whole query finishes.

> ⚠️ **Marking a function `IMMUTABLE` when it reads a table or the clock.** Postgres caches and indexes wrong answers.

> ⚠️ **`COMMIT` inside a function, or a procedure called inside a transaction.** Postgres stops with *invalid transaction termination*.

> ⚠️ **A trigger that updates the table it's on.** It fires itself. Use a `BEFORE` trigger that changes `NEW` instead.

## Interview questions

**Q: What's the difference between a stored procedure and a function?**

A function returns a value (or rows) and is used inside a query: `SELECT order_total(5)`. A procedure is run with `CALL`, returns nothing except `INOUT` arguments, and can `COMMIT` or `ROLLBACK` partway through, which suits batch jobs. In Postgres both can change data; in SQL Server a function can't.

**Q: View or materialized view?**

A view is a saved query: always up to date, as slow as its query. A materialized view stores the result: fast to read, but out of date until `REFRESH`, which re-runs the whole query. Use a view for convenience and access control, a materialized view for slow reports that can lag a little.

**Q: How do you refresh a materialized view without blocking readers?**

`REFRESH MATERIALIZED VIEW CONCURRENTLY`. It builds the new result alongside the old one and swaps in the differences, so readers keep reading. It needs a unique index on the materialized view.

**Q: When would you use a trigger, and what are the risks?**

For things that must happen on every change from every app: audit logs, filling in derived columns, keeping a summary table in step. The risks: logic that nobody sees when reading the app's code, slow bulk writes (a row trigger runs once per row), and chains of triggers. Prefer a constraint when one can express the rule.

**Q: Why can't you index a function that uses `current_date`?**

An index stores the function's results to look them up later. A function that depends on the date gives a different answer tomorrow, so the stored results would be wrong. Postgres only allows `IMMUTABLE` functions in indexes.
