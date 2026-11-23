> 💡 **In one line:** a transaction groups several changes so they succeed or fail together, and isolation decides what a transaction sees of others running at the same time. Most "it worked in testing, broke in production" database bugs are two transactions meeting.

## ACID

A **transaction** is a group of statements that belong together, such as "take payment, create the order, reduce the stock". ACID names four promises a database makes about transactions:

| Letter | Promise | Example: one keyboard sold |
| --- | --- | --- |
| **A**tomicity | all of the transaction happens, or none of it | if creating the order fails, the stock isn't reduced either |
| **C**onsistency | the schema's rules hold before and after | a `CHECK (stock >= 0)` stops the stock going negative: the whole transaction fails |
| **I**solation | transactions running at the same time don't trip over each other's half-done work | another shopper never sees the stock reduced for an order that's later cancelled |
| **D**urability | once `COMMIT` returns, the change survives a crash or power cut | Postgres writes the change to its write-ahead log on disk before confirming (see [internals](/topics/internals)) |

Consistency is partly yours: the database can only enforce the rules you wrote down as [constraints](/topics/modelling#constraints-let-the-database-refuse-bad-data). Here, the shop has no rule against negative stock, so this update is accepted:

```sql
UPDATE products SET stock = stock - 1000 WHERE id = 2;
SELECT name, stock FROM products WHERE id = 2;
```

The Wireless Mouse now shows −660 in stock. Add the rule and the same update is refused:

```sql error
ALTER TABLE products ADD CONSTRAINT stock_not_negative CHECK (stock >= 0);
UPDATE products SET stock = stock - 1000 WHERE id = 2;
```

## BEGIN, COMMIT, ROLLBACK and savepoints

- `BEGIN` starts a transaction.
- `COMMIT` makes all its changes permanent and visible to everyone.
- `ROLLBACK` undoes all of them.

Without `BEGIN`, each statement is its own transaction (**autocommit**).

```sql
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 1 RETURNING name, stock;
ROLLBACK;

SELECT name, stock FROM products WHERE id = 1;
```

Inside the transaction the keyboard's stock is 119 (`RETURNING` shows the row after the change); after `ROLLBACK` it's 120 again.

A **savepoint** is a bookmark inside a transaction: you can roll back to it without losing everything before it.

```sql
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 1;       -- keep this
SAVEPOINT before_mouse;
UPDATE products SET stock = stock - 1000 WHERE id = 2;    -- a mistake
ROLLBACK TO SAVEPOINT before_mouse;                       -- undo only the mistake
SELECT id, name, stock FROM products WHERE id IN (1, 2) ORDER BY id;
ROLLBACK;
```

The keyboard is still 119 (kept); the mouse is back to 340.

> ⚠️ In Postgres, once a statement fails inside a transaction, every later statement fails too ("current transaction is aborted") until you `ROLLBACK`, or roll back to a savepoint. That's atomicity doing its job.

## Isolation levels and anomalies

When transactions run at the same time, timing can produce results no single transaction would. These are the **anomalies**:

| Anomaly | What happens |
| --- | --- |
| **Dirty read** | you read a change another transaction hasn't committed (and may roll back) |
| **Non-repeatable read** | you read a row twice in one transaction and get different values |
| **Phantom** | you run the same query twice and new rows appear |
| **Lost update** | two transactions read the same value, both write a new one, and one write is lost |
| **Write skew** | two transactions each check a rule, both pass, and together they break it |

```steps non-repeatable-read
```

The **isolation level** decides which anomalies can happen. Postgres has three (asking for Read Uncommitted gives Read Committed):

| Level | Each statement sees | Prevents | Still possible |
| --- | --- | --- | --- |
| **Read Committed** (default) | what was committed when *that statement* started | dirty reads | non-repeatable reads, phantoms, lost updates (if you read then write), write skew |
| **Repeatable Read** | one snapshot taken at the transaction's first query | also non-repeatable reads and phantoms; a conflicting update raises an error instead of being lost | write skew |
| **Serializable** | a snapshot, plus checks that the result matches *some* one-at-a-time order | everything | nothing: conflicting transactions get "could not serialize access" and must be retried |

```sql
SHOW transaction_isolation;
```

Set it per transaction with `BEGIN ISOLATION LEVEL REPEATABLE READ;`. Stricter levels add little waiting. Instead, when two transactions conflict, Postgres cancels one of them with an error, so the application must **retry** it.

**Write skew**, the anomaly only Serializable stops: a hospital needs at least one doctor on call. Two doctors on call each ask to go off. Each transaction checks "is someone else still on call?" (yes: the other doctor), and each sets itself off call. Both commit, and nobody is on call. Neither transaction changed a row the other changed, so only Serializable notices.

## The lost update, and how to prevent it

This is the bug you're most likely to write: read a value, compute in the app, write it back.

```steps lost-update
```

Three fixes, in the order you should reach for them:

1. **Let the database do the arithmetic** in one statement: `UPDATE products SET stock = stock - 1 WHERE id = 1`. Postgres locks the row, so a second update waits and then works from the new value.

```steps atomic-update
```

2. **Lock the row before reading it**, when the app really needs to read and decide: `SELECT stock FROM products WHERE id = 1 FOR UPDATE;` holds a row lock until the transaction ends, so the other transaction's `FOR UPDATE` waits.

3. **Optimistic locking**, when holding locks is impractical (the user edits a form for 2 minutes): keep a `version` column, and only update if it hasn't changed since you read it.

```sql
ALTER TABLE products ADD COLUMN version int NOT NULL DEFAULT 1;

-- Both users read version 1. The first save:
UPDATE products SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 1
RETURNING id, stock, version;

-- The second save, still holding version 1:
UPDATE products SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 1
RETURNING id, stock, version;
```

The first update returns one row (version is now 2); the second updates **0 rows**, because the version no longer matches. The app sees 0 and tells the user "someone changed this; reload and try again". No locks are held while the user thinks.

## Row locks: FOR UPDATE and SKIP LOCKED

| Lock | Blocks others from | Use for |
| --- | --- | --- |
| `SELECT … FOR UPDATE` | updating, deleting or locking these rows until you commit | read-then-write on rows you'll change |
| `SELECT … FOR SHARE` | changing them, but lets others read and share-lock | making sure a referenced row doesn't vanish |
| `… FOR UPDATE SKIP LOCKED` | (skips rows already locked instead of waiting) | job queues: several workers each grab different jobs |
| `… FOR UPDATE NOWAIT` | (fails at once instead of waiting) | when waiting is worse than failing |

A worker taking 3 pending orders to process, without fighting other workers for the same ones:

```sql
SELECT id, status
FROM orders
WHERE status = 'pending'
ORDER BY id
LIMIT 3
FOR UPDATE SKIP LOCKED;
```

Here it gets orders 1, 11 and 21. A second worker running the same query at the same time skips those three and gets the next three. This turns a table into a reliable queue.

## Deadlocks

A **deadlock** is two transactions each waiting for a lock the other holds:

| Step | Transaction A | Transaction B |
| --- | --- | --- |
| 1 | updates product 1 (locks it) | |
| 2 | | updates product 2 (locks it) |
| 3 | wants product 2: waits for B | |
| 4 | | wants product 1: waits for A. Neither can move. |

Postgres checks for this after a second of waiting (`deadlock_timeout`), cancels one transaction with "deadlock detected", and the other continues. The cancelled one must be retried.

To avoid them:

- lock rows in the **same order** everywhere (for example, always by ascending id): then step 4 can't happen;
- keep transactions **short**: no network calls or user input while holding locks;
- update many rows in one statement rather than one at a time.

## Idempotency keys

A payment request times out. Did it go through? If the client retries and the server charges again, the customer pays twice. An **idempotency key** makes a retry safe: the client sends the same unique key with every attempt, and the server stores it with a `UNIQUE` constraint, so the second attempt can't create a second payment.

```sql
CREATE TABLE payments (
  idempotency_key text PRIMARY KEY,
  order_id        int NOT NULL,
  amount          numeric(10,2) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- First attempt
INSERT INTO payments (idempotency_key, order_id, amount)
VALUES ('pay_7f3a2c', 2, 63493.00)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING idempotency_key;

-- The retry, with the same key
INSERT INTO payments (idempotency_key, order_id, amount)
VALUES ('pay_7f3a2c', 2, 63493.00)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING idempotency_key;

SELECT COUNT(*) AS payments FROM payments;
```

The first insert returns the key; the retry returns nothing (the key exists), and there's still 1 payment. The server then looks up the stored result and returns it. Structura's [idempotent payments](https://structura-web.netlify.app/topic/payment-idempotency/) topic follows a whole payment through this.

## Mistakes to avoid

> ⚠️ **Read, compute in the app, write back**: the lost update. Update in one statement, or `SELECT … FOR UPDATE` first.

> ⚠️ **Long transactions**: they hold locks, block others, and stop VACUUM cleaning up (see [internals](/topics/internals)). Never wait for a user or a slow API inside one.

> ⚠️ **Serializable without retries**: conflicting transactions are cancelled by design. Wrap the transaction in a retry loop.

> ⚠️ **Locking rows in different orders in different places**: the recipe for deadlocks.

## Interview questions

**Q: What isolation level does Postgres use by default, and what can go wrong at it?**

Read Committed. Each statement sees data committed before it started, so reading the same row twice can give different values, new rows can appear, and read-then-write code can lose updates. Write skew is possible at every level except Serializable.

**Q: Two users buy the last item at the same time. How do you stop overselling?**

Do it in one conditional statement: `UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0`, and check that one row was updated. Or lock the row with `SELECT … FOR UPDATE` before checking. A `CHECK (stock >= 0)` constraint is the safety net underneath.

**Q: Optimistic or pessimistic locking?**

Pessimistic (`FOR UPDATE`) holds a lock while you work: right for short transactions with real contention. Optimistic (a version column checked on write) holds nothing and detects conflicts at save time: right for long edits and rare conflicts, at the cost of asking the user to retry.

**Q: How do you make a payment API safe to retry?**

The client sends an idempotency key with each request; the server stores it under a unique constraint together with the result. A repeated key returns the stored result instead of charging again.
