> 💡 **In one line:** your app works with objects; the database works with rows. Three tools sit in between, each with one job. A **validator** (such as Zod) checks data coming in from outside before anything trusts it. A **mapper** turns one shape into another: a database row into the object your API returns. An **ORM** (such as Sequelize or Prisma) writes the SQL for you and turns rows into objects. Under all three, the database's **constraints** are the last line of defence.

## At a glance

| Tool | Its one job | JavaScript / TypeScript | Java |
| --- | --- | --- | --- |
| **Validator** | check that input from outside has the right shape and values | Zod, Joi, Yup | Jakarta Bean Validation (`@NotNull`, `@Min`) |
| **Mapper** | convert between shapes: row ↔ object ↔ API response | plain functions, class-transformer | MapStruct, plain methods |
| **ORM** | write SQL for you, turn rows into objects, follow relations | Sequelize, Prisma, TypeORM | Hibernate (JPA) |
| **Query builder** | build SQL in code; you still think in SQL | Knex, Kysely, Drizzle | jOOQ |
| **Constraints** | refuse bad rows, whatever code sent them | `NOT NULL`, `CHECK`, `UNIQUE`, foreign keys | same |

**ORM** stands for object-relational mapping: mapping objects in code to rows in relational tables. A **DTO** (data transfer object) is a plain object shaped for one purpose, such as an API response.

## One request, from the browser to a row

A customer adds 2 monitors to order 2001. The browser sends:

```json
{ "productId": "3", "quantity": 2 }
```

`productId` arrived as text. Here's every step, and which tool does it:

| Step | Tool | What happens |
| --- | --- | --- |
| 1 | **Validator** | checks `quantity` is a whole number from 1 to 10, turns `"3"` into `3`; anything else gets a `400 Bad Request` |
| 2 | **Mapper** | turns the checked input into what the database needs: `{ orderId: 2001, productId: 3, quantity: 2, unitPrice: … }` |
| 3 | **ORM** | writes `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)` and sends the values separately |
| 4 | **Constraints** | the database checks the foreign key (product 3 exists), `NOT NULL`, and the primary key (this product isn't on the order twice) |
| 5 | **Mapper** | turns the saved row into the API's response: `snake_case` to `camelCase`, price as a number, nothing internal |

Each tool can fail on its own, and each catches mistakes the others can't. The rest of this lesson takes them one at a time.

## Validators: never trust input

A **validator** describes the shape data must have, and checks it. Zod is the common choice in TypeScript:

```ts
import { z } from "zod";

const NewOrderLine = z.object({
  productId: z.coerce.number().int().positive(), // "3" becomes 3
  quantity: z.number().int().min(1).max(10),
});

const result = NewOrderLine.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.issues });
}
const line = result.data; // typed: { productId: number; quantity: number }
```

- `{ "productId": "3", "quantity": 2 }` passes, as `{ productId: 3, quantity: 2 }`.
- `{ "productId": "abc", "quantity": 0 }` fails twice: not a number, and below 1.
- In TypeScript, `line` now has a real type, so the rest of the code can't mistake `productId` for text.

What a validator **can't** check is anything that needs the data: whether product 3 exists, or whether an email is already taken. Only the database knows that, so keep the rule in both places when it matters:

| Rule | In the validator | In the database |
| --- | --- | --- |
| quantity from 1 to 10 | yes: a friendly error before any query | `CHECK (quantity BETWEEN 1 AND 10)`: catches every other app and script |
| product 3 exists | can't | foreign key `REFERENCES products(id)` |
| email not used yet | can't (two sign-ups at the same moment would both pass) | `UNIQUE (email)` |
| status is one of three words | `z.enum(["pending", "delivered", "cancelled"])` | `CHECK (status IN (…))`, as the shop has |

The database refuses what no validator can see:

```sql error
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES (1, 99, 2, 100.00);
```

*violates foreign key constraint*: there's no product 99. Validators give good error messages; constraints make sure the data is right. See [constraints](/topics/modelling#constraints-let-the-database-refuse-bad-data).

## Mappers: one shape to another

The database, your code and your API each want data in a different shape:

| | Database row | API response |
| --- | --- | --- |
| Names | `unit_price` (snake_case) | `unitPrice` (camelCase) |
| Money | `NUMERIC(10,2)`; the Node.js driver `pg` returns it as the string `"18999.00"`, so no precision is lost | a number, or a string with the currency |
| Extra fields | everything in the table | only what the caller needs; never internal ones like password hashes |
| Computed values | none | `lineTotal` |

A **mapper** is the code that converts. Often it's a plain function:

```ts
type OrderItemRow = { order_id: number; product_id: number; quantity: number; unit_price: string };
type OrderLineDto = { productId: number; quantity: number; unitPrice: number; lineTotal: number };

function toOrderLineDto(row: OrderItemRow): OrderLineDto {
  const unitPrice = Number(row.unit_price); // "18999.00" → 18999
  return {
    productId: row.product_id,
    quantity: row.quantity,
    unitPrice,
    lineTotal: unitPrice * row.quantity,
  };
}
```

Why not return the row, or the ORM's object, straight from the API? Because then the API's shape is the table's shape. Add a column to the table, such as `cost_price`, and every client can now see it. Rename a column, and every client breaks. A mapper keeps the two free to change.

> 💡 For money, `Number()` is fine for display, but adding up many prices as floating-point numbers can drift by a fraction of a paisa. Do totals in SQL (`SUM(quantity * unit_price)` is exact), or keep amounts as whole paise.

## ORMs: SQL written for you

An **ORM** maps each table to a class or model, and each row to an object. You describe the table once, and call methods instead of writing SQL:

```ts
const OrderItem = sequelize.define("OrderItem", {
  orderId:   { type: DataTypes.INTEGER, field: "order_id", primaryKey: true },
  productId: { type: DataTypes.INTEGER, field: "product_id", primaryKey: true },
  quantity:  { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 10 } },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), field: "unit_price", allowNull: false },
}, { tableName: "order_items", timestamps: false });

await OrderItem.create({ orderId: 2001, productId: 3, quantity: 2, unitPrice: "18999.00" });
// Sequelize logs the SQL it sends, something like:
// INSERT INTO "order_items" ("order_id","product_id","quantity","unit_price") VALUES ($1,$2,$3,$4) RETURNING ...
```

Notice the ORM does a little of everything: `validate: { min: 1 }` is validation, and `field: "order_id"` is mapping names. That's why the three get confused. The ORM's validation runs only when this model is used, so it doesn't replace the validator at the edge, or the constraint in the database.

What an ORM gives you:

- less repetitive SQL for create, read, update and delete;
- relations: `order.getItems()` instead of writing the join;
- **migrations**: versioned files that change the schema step by step, kept with the code.

What it costs: you don't see the SQL unless you look. The commonest result is the N+1 problem.

## N+1: the classic ORM mistake

A page shows customer 6's orders, with the items in each. Code that looks innocent:

```ts
const orders = await Order.findAll({ where: { customerId: 6 } });       // 1 query
for (const order of orders) {
  order.items = await OrderItem.findAll({ where: { orderId: order.id } }); // 1 query per order
}
```

In SQL, that's one query for the orders:

```sql
SELECT id, order_date, status FROM orders WHERE customer_id = 6 ORDER BY id;
```

9 orders. Then the loop sends `SELECT … FROM order_items WHERE order_id = 5`, then `= 185`, then `= 365`, and so on: **1 + 9 = 10 queries**. That's the "N + 1": one query, then N more. Each takes a fraction of a millisecond in the database, but each is a round trip over the network, often around a millisecond. For a customer with 500 orders, that's 501 round trips for one page.

Two fixes, and most ORMs offer both (`include: [OrderItem]` in Sequelize, `include: { items: true }` in Prisma):

**One query with a join**:

```sql
SELECT o.id, o.order_date, p.name, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.customer_id = 6
ORDER BY o.id, p.name;
```

**Two queries**: the orders, then every order's items at once, with a list of ids:

```sql
SELECT order_id, product_id, quantity, unit_price
FROM order_items
WHERE order_id = ANY (ARRAY[5, 185, 365, 545, 725, 905, 1085, 1265, 1445])
ORDER BY order_id, product_id;
```

Either way, 1 or 2 round trips instead of 10, whatever the number of orders. To catch N+1 before users do, turn on the ORM's query log in development and count the queries per page. See also [N+1 queries](/topics/indexing#n-1-queries-and-pagination).

## Parameters, never string building

Every tool here sends values **separately** from the SQL text: `$1`, `$2` in the query, and the values alongside. Never build SQL by gluing text together. Here's what gluing does when someone types `x' OR '1'='1` into a "find customer by name" box:

```sql
SELECT 'SELECT id, name FROM customers WHERE name = ''' || $$x' OR '1'='1$$ || '''' AS built_query;
```

The result is `SELECT id, name FROM customers WHERE name = 'x' OR '1'='1'`. The typed text closed the quote and added a condition that is always true, so this query returns all 203 customers. That's **SQL injection**: input changes the query itself. With a real table of users, it leaks everyone's data, or worse.

With a parameter, the input is only ever a value:

```sql
PREPARE find_customer(text) AS
SELECT id, name FROM customers WHERE name = $1;

EXECUTE find_customer($$x' OR '1'='1$$);   -- 0 rows: no customer has that strange name
EXECUTE find_customer('Customer 6');       -- 1 row
DEALLOCATE find_customer;
```

In app code, that's:

```ts
const { rows } = await pool.query(
  "SELECT id, name FROM customers WHERE name = $1",
  [nameFromUser], // sent separately: it can't change the query
);
```

ORMs use parameters for you. The danger is their escape hatches for raw SQL: `sequelize.query()` given a template string with the input pasted in, or Prisma's `$queryRawUnsafe`. Use their parameter forms instead (Prisma's `$queryRaw` with a tagged template, Sequelize's `replacements` or `bind`).

## ORM, query builder or plain SQL?

| | ORM | Query builder | Plain SQL with parameters |
| --- | --- | --- | --- |
| Simple create, read, update, delete | quickest | fine | lots of repetition |
| Complex reports, window functions, CTEs | awkward: you drop to raw SQL anyway | good | best |
| Seeing the SQL that runs | turn on logging | usually obvious | always |
| Types in TypeScript | from the model (Prisma generates them) | Kysely and Drizzle are fully typed | write them yourself, or generate them |
| Risk | N+1, slow queries nobody sees | fewer surprises | repetition; mistakes in hand-written mapping |

Many teams use both: an ORM for everyday writes, and plain SQL (or a query builder) for reports and anything performance-critical. Whatever you choose, keep the **validator at the edge**, a **mapper at the API boundary**, and **constraints in the database**.

## Mistakes to avoid

> ⚠️ **Trusting the validator alone**: it can't see other apps, scripts or two requests at the same moment. Put the important rules in constraints too.

> ⚠️ **Returning ORM objects straight from the API**: new columns leak, renamed columns break clients. Map to a DTO.

> ⚠️ **Never looking at the SQL the ORM sends**: N+1 and missing indexes hide there. Log queries in development.

> ⚠️ **Building SQL with template strings**: `WHERE name = '${name}'` is an injection waiting to happen. Use parameters.

> ⚠️ **Adding up money as floating-point numbers**: totals drift. Sum in SQL, or use whole paise.

## Interview questions

**Q: What's the difference between an ORM, a mapper and a validator like Zod?**

They do different jobs at different places. A validator checks untrusted input at the edge of the app: right shape, right types, values in range. A mapper converts between shapes: a database row into the DTO the API returns, `snake_case` into `camelCase`. An ORM writes the SQL and turns rows into objects. ORMs often validate and map a little too, which is where the confusion comes from. Under all of them, database constraints are the rules that hold whatever code writes the data.

**Q: What is the N+1 problem, and how do you fix it?**

One query loads a list, then the code runs one more query for each item: 1 + N round trips. Fix it with eager loading: one query with a join, or a second query that fetches every item's children at once with `WHERE parent_id = ANY (…)`. Spot it by logging the queries for a page.

**Q: How do you prevent SQL injection?**

Send values as parameters (`$1`), never glued into the SQL text. Then input can only ever be a value, not part of the query. ORMs do this, except in their raw-query escape hatches, which have safe parameterized forms too. Least privilege for the database user limits the damage if something slips.

**Q: Why validate in the app if the database has constraints?**

They do different things. The validator rejects bad input early, with a clear message, before any query runs. Constraints guarantee the data stays correct whatever writes it, including other services, scripts and two requests at once. Use both for the rules that matter.
