> 💡 **In one line:** data modelling is deciding which tables you need, what goes in each, and how they point at each other, so that the data stays correct as the app grows. A good schema makes wrong data impossible to store; a weak one lets it in quietly and you find out months later.

## Entities, relationships and ER diagrams

An **entity** is a kind of thing your app keeps track of: a customer, an order, a product. Each entity usually becomes a table. A **relationship** says how two entities connect: a customer *places* orders; an order *contains* products.

An **ER diagram** (entity–relationship diagram) draws the tables as boxes and the relationships as lines between them. Open the [Diagrams](/erd) tab and choose the shop dataset to see the shop's 7 tables and how they link.

To find the entities, read the requirements and underline the nouns, then ask of each pair "how many of one go with one of the other?". The answer is the relationship's **cardinality**:

| Cardinality | Means | Shop example | How to store it |
| --- | --- | --- | --- |
| one-to-one | each A has at most one B | (none in the shop; a user and their profile) | a foreign key with `UNIQUE`, or the same table |
| one-to-many | one A has many B; each B has one A | a customer has many orders | a foreign key on the "many" side: `orders.customer_id` |
| many-to-many | each A has many B, and each B has many A | an order has many products; a product is in many orders | a third table in between: `order_items` |

Every foreign key in the shop, read from Postgres's own catalogue:

```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS points_at
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'shop'
ORDER BY 1, 2;
```

7 links. Two of them point back at their own table (`employees.manager_id`, `customers.referred_by`): that's how you store a hierarchy.

## Many-to-many: the junction table

You can't store "this order has products 5, 7 and 9" in one column of `orders` (a list in a cell breaks the first rule of [normalization](#normalization-1nf-2nf-3nf)). And you can't put an `order_id` on `products`: a product is in many orders. So a third table, a **junction table**, holds one row per pair:

| order_items (a junction table) | Means |
| --- | --- |
| (2, 5, quantity 4, 14999.00) | order 2 has 4 × product 5 at 14,999 each |
| (2, 7, quantity 1, 1499.00) | order 2 has 1 × product 7 |
| (2, 9, quantity 2, 999.00) | order 2 has 2 × product 9 |

Its primary key is the pair `(order_id, product_id)`, so the same product can't be listed twice in one order: you'd raise the quantity instead. A junction table can carry facts about the pair itself, like `quantity` and `unit_price`.

```steps many-to-many
```

Build one yourself: tags on products (a product has many tags, a tag is on many products). This runs in a transaction that's rolled back, so the tables disappear afterwards:

```sql
CREATE TABLE tags (
  id   int  PRIMARY KEY,
  name text NOT NULL UNIQUE
);
CREATE TABLE product_tags (
  product_id int REFERENCES products(id),
  tag_id     int REFERENCES tags(id),
  PRIMARY KEY (product_id, tag_id)        -- each pair once
);
INSERT INTO tags VALUES (1, 'gift'), (2, 'bestseller');
INSERT INTO product_tags VALUES (1, 2), (6, 1), (6, 2);

SELECT p.name, string_agg(t.name, ', ' ORDER BY t.name) AS tags
FROM products p
JOIN product_tags pt ON pt.product_id = p.id
JOIN tags t ON t.id = pt.tag_id
GROUP BY p.name
ORDER BY p.name;
```

*Designing Data-Intensive Applications* gets "bestseller, gift"; the keyboard gets "bestseller". Two joins take you from products, through the pairs, to the tags. Practise it with [Design: blog posts with tags](/questions/design-blog-tags).

## Normalization: 1NF, 2NF, 3NF

**Normalization** is a set of rules that store each fact in exactly one place, so no update can leave two copies disagreeing. The first three **normal forms** (NF) are the ones that matter in practice.

| Form | Rule | Breaks it | Fix |
| --- | --- | --- | --- |
| **1NF** | each cell holds one value; no repeating columns | `phones = '98xxx, 99xxx'`, or `phone1, phone2, phone3` | a `phones` table: one row per number |
| **2NF** | in a table whose key has several columns, every other column depends on the **whole** key | `order_items(order_id, product_id, quantity, product_name)`: the name depends on `product_id` alone | keep `product_name` in `products` only |
| **3NF** | no column depends on another non-key column | `customers(…, city, city_state)`: the state depends on the city, not the customer | a `cities` table; customers store `city_id` |

What goes wrong without it is called an **anomaly**:

- **Update anomaly**: a product's name is stored on 3,000 order lines. You rename it and miss some rows: now it has two names.
- **Insert anomaly**: you can't record a new city's state until a customer lives there.
- **Delete anomaly**: delete the last customer in Jaipur and you lose the fact that Jaipur is in Rajasthan.

> 💡 A shortcut that works most of the time: "every column describes the key, the whole key, and nothing but the key."

### Is order_items.unit_price a copy?

It looks like a copy of `products.price`, which would break 3NF:

```sql
SELECT p.name, p.price AS price_now, oi.unit_price AS price_paid
FROM order_items oi
JOIN products p ON p.id = oi.product_id
LIMIT 2;
```

Today they're equal, but they're **different facts**: `price` is what the product costs now; `unit_price` is what this customer paid on that day. When the price changes next month, past orders must not change. So `unit_price` belongs on the order line. Ask "if one changes, should the other change too?": if not, it isn't a duplicate.

## Constraints: let the database refuse bad data

A **constraint** is a rule Postgres checks on every insert and update. Code in your app can have bugs, scripts skip the app entirely, but a constraint is checked every time.

| Constraint | Refuses | In the shop |
| --- | --- | --- |
| `NOT NULL` | a missing value | every `name`, `price`, `order_date` |
| `UNIQUE` | a second row with the same value | (missing on `customers.email`: see below) |
| `PRIMARY KEY` | a duplicate or missing id (it is `UNIQUE` + `NOT NULL`) | `order_items (order_id, product_id)` |
| `CHECK` | a value that fails a test | `orders.status` must be pending, delivered or cancelled |
| `FOREIGN KEY` | a link to a row that doesn't exist, and deleting a row that is still linked to | `orders.customer_id` |

Each of these fails on purpose. Run them to read the errors:

```sql error
-- a status the CHECK doesn't allow
INSERT INTO orders (id, customer_id, order_date, status)
VALUES (9999, 1, '2025-01-01', 'shipped');
```

```sql error
-- department 42 doesn't exist
INSERT INTO employees (id, name, department_id, salary, hire_date)
VALUES (99, 'Test', 42, 50000, '2025-01-01');
```

```sql error
-- customer 1 still has orders pointing at them
DELETE FROM customers WHERE id = 1;
```

```sql error
-- product 5 is already in order 2: the primary key is the pair
INSERT INTO order_items VALUES (2, 5, 1, 14999.00);
```

**What a missing constraint costs.** `customers.email` has no `UNIQUE`, and three emails are duplicated (that's what the [duplicate emails](/questions/duplicate-emails) question finds). Try to add the constraint now:

```sql error
ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);
```

It fails: the bad rows are already there. You'd have to clean them up first ([Keep the oldest duplicate](/questions/keep-first-duplicate)). Constraints are cheapest on day one.

When a linked row is deleted, a foreign key can do more than refuse. `ON DELETE CASCADE` deletes the linked rows too (deleting an order deletes its lines); `ON DELETE SET NULL` clears the link. Use `CASCADE` only where the child truly can't exist alone.

## Keys: natural or surrogate, int or UUID

A **natural key** is a real-world value that is already unique: an email, a PAN number, an ISBN. A **surrogate key** is a made-up number with no meaning, like the shop's `id` columns.

Prefer surrogate keys for primary keys, and put `UNIQUE` on the natural one:

- Natural values change (people change emails), and a primary key is copied into every table that points at it.
- Natural values aren't always unique or present (two people, one shared email; a customer with no PAN).

Two ways to make surrogate ids:

| | `bigint` identity | `uuid` |
| --- | --- | --- |
| Looks like | 1, 2, 3 … | `7d71d1ee-1387-4936-8b4b-fbe8211d9d2e` |
| Size | 8 bytes | 16 bytes |
| Made by | the database, in order | anyone, anywhere (app, phone, another service), with no clash |
| Downside | reveals how many rows you have; one database must hand them out | bigger indexes; random UUIDs scatter inserts across the index (UUIDv7, which starts with a timestamp, fixes that) |

```sql
CREATE TABLE notes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO notes (body) VALUES ('first'), ('second');
SELECT id, body FROM notes;
```

`GENERATED ALWAYS AS IDENTITY` hands out 1, 2, 3 …; you never set `id` yourself. (Older code uses `serial` for the same thing.)

## When to denormalize

**Denormalizing** means storing a copy or a precomputed value on purpose, to make reads faster. It trades write work and the risk of copies disagreeing for read speed.

Do it when all three are true:

1. a read happens far more often than the data changes (an order's total is shown on every page view, but the order never changes after it's placed);
2. computing it each time is measurably too slow;
3. you have one clear way to keep the copy right: the same transaction, a trigger, or a background job.

Common examples: `orders.total`, a `posts.comment_count` counter, a reporting table rebuilt every night. Start normalized; denormalize the one hot path you measured.

## Soft deletes, audit columns and time zones

**Soft delete**: instead of `DELETE`, set `deleted_at = now()`, and filter `WHERE deleted_at IS NULL` everywhere. You can undo it, and history stays. The cost: every query must remember the filter, and a `UNIQUE (email)` now also blocks re-signing up with a deleted account's email (use a partial index: `UNIQUE (email) WHERE deleted_at IS NULL`).

**Audit columns**: `created_at timestamptz NOT NULL DEFAULT now()` and `updated_at` on most tables. They cost almost nothing and answer "when did this change?" in every bug hunt.

**Time zones**: store moments as `timestamptz`. Postgres converts the input to UTC (coordinated universal time) and back to the viewer's zone when reading. 10:00 in India (UTC+5:30) is stored as 04:30 UTC:

```sql
SELECT TIMESTAMPTZ '2025-03-01 10:00:00+05:30' AT TIME ZONE 'UTC' AS in_utc;
```

Use plain `date` for calendar days with no time (a birthday, `order_date`). Avoid `timestamp` without a zone for moments: nobody knows later which zone it was in.

## Mistakes to avoid

> ⚠️ **Lists in a column** (`tags = 'a,b,c'`): you can't join on them, index them or keep them consistent. Make a junction table.

> ⚠️ **No constraints, "the app checks it"**: the app has bugs and scripts bypass it. Duplicates and orphan rows get in, and cleaning them later is slow.

> ⚠️ **A natural key as the primary key**: when it changes, every table pointing at it must change too.

> ⚠️ **Copying data without a plan to keep it in sync**: denormalize on purpose, with one owner for the copy.

## Interview questions

**Q: How do you model a many-to-many relationship?**

With a junction table holding one row per pair, a foreign key to each side, and a primary key (or `UNIQUE`) on the pair so a pair can't repeat. The junction table can carry facts about the pair, like quantity or the date a tag was added.

**Q: What is 3NF, in one sentence?**

Every non-key column depends on the key, the whole key, and nothing but the key. In practice: one fact in one place, so an update can't create two versions of it.

**Q: UUID or auto-increment ids?**

Auto-increment `bigint` is smaller and keeps inserts in order. UUIDs can be made anywhere without asking the database (offline apps, many services, merging data), at the cost of 16 bytes and scattered index inserts. UUIDv7 keeps the ordering. Use bigint by default, UUIDs when ids must be created outside one database or must not be guessable.

**Q: Hard delete or soft delete?**

Soft delete when you need undo, history or audit; hard delete when data must really go (privacy laws such as GDPR, or old logs). With soft deletes, filter deleted rows everywhere and make unique constraints partial.
