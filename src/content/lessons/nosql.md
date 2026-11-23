> 💡 **In one line:** "NoSQL" is a family of databases that each give up some of what a relational database offers (joins, flexible queries, multi-row transactions) to be very good at one access pattern: huge key lookups, endless writes, connected data, text search, analytics. You model for them by starting from your queries, not from your entities.

## Postgres JSONB: the middle ground

Before picking a new database, know that Postgres stores documents well. A **JSONB** column holds a JSON document in a binary form you can query and index. A customer and their orders as one document:

```sql
SELECT jsonb_build_object(
  'id', c.id, 'name', c.name, 'city', c.city,
  'orders', jsonb_agg(jsonb_build_object('id', o.id, 'date', o.order_date, 'status', o.status) ORDER BY o.id)
) AS doc
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.id = 7
GROUP BY c.id;
```

One row, holding the customer and their 8 orders nested inside: the shape a document database would store, built here from tables.

JSONB shines for the parts of your data that have **no fixed shape**. Products in different categories have different specs:

```sql
CREATE TABLE product_docs AS
SELECT id, jsonb_build_object(
  'name', name, 'price', price,
  'specs', CASE id
    WHEN 1 THEN '{"switches": "brown", "layout": "TKL", "wireless": false}'::jsonb
    WHEN 2 THEN '{"dpi": 4000, "wireless": true}'::jsonb
    WHEN 5 THEN '{"anc": true, "wireless": true, "battery_hours": 30}'::jsonb
    ELSE '{}'::jsonb END) AS doc
FROM products WHERE category = 'Electronics';

SELECT doc->>'name' AS name FROM product_docs
WHERE doc @> '{"specs": {"wireless": true}}'
ORDER BY id;
```

| Operator | Means | Example |
| --- | --- | --- |
| `->` | get a field as JSON | `doc->'specs'` |
| `->>` | get a field as text | `doc->>'name'` |
| `@>` | contains this piece of JSON | `doc @> '{"specs": {"wireless": true}}'`: the mouse and the headphones |
| `?` | has this key | `doc->'specs' ? 'battery_hours'`: only the headphones |

A **GIN index** on the column (`CREATE INDEX ON product_docs USING gin (doc)`) makes `@>` and `?` fast on large tables. Keep the fields you filter and join on most as normal columns, and the rest in JSONB.

## Document databases: embed or reference (MongoDB)

A **document database** such as MongoDB stores JSON-like documents, grouped in collections, with no fixed schema. The central choice is **embed** (put related data inside the document) or **reference** (store an id and look it up separately, like a foreign key):

| Embed when | Reference when |
| --- | --- |
| you always read them together (an order and its lines) | the related data is shared (a product appears in many orders) |
| the inner list is small and bounded (a user's 3 addresses) | the list grows without limit (a user's 50,000 logins) |
| the inner data belongs to this document only | the related data changes on its own and must stay consistent everywhere |

Embedding makes the common read one fetch, with no join. The cost: the same data copied in many documents must be updated in all of them, and documents have a size limit (16 MB in MongoDB).

## Key-value and single-table design (DynamoDB)

**DynamoDB** (Amazon's managed key-value store) finds every item by its key, in a few milliseconds at any size, and spreads data across partitions automatically. It has no joins and only simple queries. So you design the key to answer your queries directly.

Each item has a **partition key** (PK: which partition it lives in) and an optional **sort key** (SK: its order inside the partition). A query reads one partition, optionally a range of sort keys. **Single-table design** stores several kinds of items in one table so one query fetches a customer and their orders:

| PK | SK | Other attributes |
| --- | --- | --- |
| `CUSTOMER#7` | `PROFILE` | name: Customer 7, city: Jaipur |
| `CUSTOMER#7` | `ORDER#2025-01-05#618` | status: delivered |
| `CUSTOMER#7` | `ORDER#2025-03-11#258` | status: delivered |
| `PRODUCT#5` | `PROFILE` | name: Noise-cancelling Headphones |

- "Customer 7 and all their orders": PK = `CUSTOMER#7`. One request.
- "Customer 7's orders in March": PK = `CUSTOMER#7`, SK between `ORDER#2025-03` and `ORDER#2025-04`. Sort keys sort as text, so dates written year-first sort in time order.
- "All orders delivered yesterday, across customers": not possible with this key. You'd add a **global secondary index** with a different key, which is a second copy of the data.

The trade: list every query before you design, because a new query later can mean reshaping the data.

## Wide-column stores and partition keys (Cassandra)

**Cassandra** spreads rows across many nodes by **partition key** and stores each partition's rows sorted by **clustering columns**. Writes go to memory and an append-only log (an [LSM tree](/topics/internals#b-trees-and-lsm-trees)), so it takes very many writes per second, and adding nodes adds capacity.

You make one table per query. For "a sensor's readings for a day, newest first":

```sql norun
-- CQL (Cassandra Query Language), not Postgres
CREATE TABLE readings_by_sensor_day (
  sensor_id  text,
  day        date,
  reading_at timestamp,
  value      double,
  PRIMARY KEY ((sensor_id, day), reading_at)   -- partition key (sensor, day); sorted by time
) WITH CLUSTERING ORDER BY (reading_at DESC);
```

- `(sensor_id, day)` is the partition key: each sensor-day is one partition on one node, so a day's readings are read in one place, already sorted.
- Putting `day` in the key keeps partitions from growing forever (a sensor reporting every second makes 86,400 rows a day).
- A query must give the whole partition key. "All sensors over 40°C" isn't possible without another table built for it.

## Data structures as a database (Redis)

**Redis** keeps everything in memory and gives you data structures, each with fast operations:

| Structure | Example use | Commands |
| --- | --- | --- |
| String | a cached page, a counter | `SET`, `GET`, `INCR` |
| Hash | a user session (field → value) | `HSET`, `HGET` |
| List | a queue of jobs | `LPUSH`, `BRPOP` |
| Set | who liked a post | `SADD`, `SISMEMBER` |
| Sorted set | a leaderboard: members ordered by score | `ZADD`, `ZRANGE` |
| Stream | an append-only event log with consumer groups | `XADD`, `XREADGROUP` |

Every key can have a TTL (it expires on its own). Redis is fast because it's in memory, which is also its limit: data must fit in RAM, and durability depends on its snapshot and log settings. It's usually a cache or a helper next to a main database.

## Graph databases (Neo4j)

A **graph database** stores **nodes** (people, products) and **relationships** between them (FOLLOWS, BOUGHT) as first-class data, so following links is fast however many hops you go. Neo4j's language, Cypher, draws the pattern:

```text
MATCH (me:Customer {id: 125})-[:REFERRED_BY*1..3]->(r:Customer)
RETURN r.id
```

That's "who referred me, up to 3 steps back". In Postgres the same is a [recursive CTE](/topics/subqueries#with-recursive-walking-trees) over `customers.referred_by`. Postgres handles a few hops on modest data well; graph databases win when queries go many hops through millions of links (recommendations, fraud rings, network paths).

## Search engines: inverted indexes (Elasticsearch)

Searching text with `LIKE '%data%'` reads every row and doesn't understand words. A search engine builds an **inverted index**: for each word, the list of documents that contain it, like the index at the back of a book. Words are first cut to their root (**stemming**: "designing" → "design"), and common words ("the", "of") are dropped.

Postgres has the same idea built in:

```sql
SELECT name, to_tsvector('english', name) AS words
FROM products
WHERE id IN (6, 7, 8);
```

```sql
SELECT name
FROM products
WHERE to_tsvector('english', name) @@ to_tsquery('english', 'database | data')
ORDER BY name;
```

"Designing Data-Intensive Applications" becomes `'design'`, `'data'`, `'intens'`, `'applic'`…; the search finds both data books. A GIN index on the `tsvector` makes it fast. **Elasticsearch** (and OpenSearch) add relevance ranking, typo tolerance, facets ("Books (4), Electronics (5)") and spread the index over many servers: use them when search is a main feature, not a filter box.

## Column stores and analytics (ClickHouse, DuckDB)

Postgres stores data **row by row**: all of an order's columns together on one page. That's ideal for "fetch order 618" and for updates. Analytics asks the opposite: "total revenue per month over 2 billion lines", reading 2 columns out of 20 from every row.

A **column store** keeps each column together on disk. A query reads only the columns it names, and a column of similar values (dates, statuses) compresses very well, often 10 times or more. **ClickHouse** (a server) and **DuckDB** (a library, like SQLite for analytics) answer such questions in seconds over billions of rows. They're poor at single-row updates and at many small transactions.

This split has names: **OLTP** (online transaction processing: many small reads and writes, like the shop) and **OLAP** (online analytical processing: few huge scans). Most companies copy OLTP data into an OLAP store for reporting.

> 💡 Storage engines underneath: B-trees update pages in place (good reads); **LSM trees** (log-structured merge trees, used by Cassandra and RocksDB) write to memory and append sorted files, merging them later (very fast writes). The [internals lesson](/topics/internals#b-trees-and-lsm-trees) compares them.

## Vector search

A **vector embedding** is a list of numbers that a machine-learning model produces for a piece of text, an image or a product, such that similar things get nearby lists. **Vector search** finds the items whose vectors are closest to a query's vector: "find products like this", or the documents an AI assistant should read before answering.

Closeness is usually **cosine similarity**: 1 means pointing the same way, 0 unrelated. This computes it by hand on tiny 3-number vectors (real embeddings have hundreds or thousands of numbers):

```sql
WITH items(title, v) AS (VALUES
  ('Keyboard',  ARRAY[0.9, 0.1, 0.0]),
  ('Mouse',     ARRAY[0.8, 0.3, 0.1]),
  ('Coffee',    ARRAY[0.0, 0.2, 0.95]),
  ('Green tea', ARRAY[0.1, 0.1, 0.9])),
query(v) AS (SELECT ARRAY[0.05, 0.15, 0.92])     -- "something to drink"
SELECT i.title,
       ROUND(
         (SELECT SUM(a * b) FROM unnest(i.v, q.v) AS t(a, b))
         / (sqrt((SELECT SUM(a * a) FROM unnest(i.v) AS a))
          * sqrt((SELECT SUM(b * b) FROM unnest(q.v) AS b))), 3) AS cosine_similarity
FROM items i, query q
ORDER BY 2 DESC;
```

Coffee (0.998) and green tea (0.997) come first; the keyboard is last (0.071). Real systems use the **pgvector** extension for Postgres, or a vector database, with approximate indexes (HNSW, IVF) that find near neighbours among millions of vectors without comparing every one.

## How to choose

| Your main need | Reach for |
| --- | --- |
| Correct data, relations, transactions, queries you haven't thought of yet | **Postgres** (with JSONB for the flexible parts) |
| Key lookups at any scale with steady latency; you know every query upfront | DynamoDB |
| Huge write volume, time-ordered, many nodes | Cassandra |
| Cache, counters, sessions, leaderboards, queues | Redis |
| Questions that follow many links | Neo4j |
| Full-text search with ranking and facets | Elasticsearch / OpenSearch |
| Analytics over billions of rows | ClickHouse, DuckDB |
| Similarity search over embeddings | pgvector, or a vector database |

Most systems use Postgres as the source of truth and add one of these for the one job it can't do well, fed from Postgres.

## Mistakes to avoid

> ⚠️ **Choosing NoSQL to "scale" before you have the load**: you lose joins, constraints and transactions on day one, for a problem you may never have.

> ⚠️ **Relational modelling in a key-value store**: normalized tables and "joins in the app" make many slow round trips. Design the keys around the queries.

> ⚠️ **Unbounded embedded lists** (every login inside the user document): documents grow until they hit the size limit and every read gets slower.

> ⚠️ **Treating a cache or search index as the source of truth**: it's a copy. Rebuild it from the database when it's wrong.

## Interview questions

**Q: When would you pick DynamoDB over Postgres?**

When the access patterns are known and simple (get by key, query a partition by range), the scale is very large or spiky, and you want no servers to manage. Not when you need ad-hoc queries, joins, or transactions across many items.

**Q: Embed or reference in MongoDB?**

Embed small, bounded data that's read with its parent and belongs only to it (order lines). Reference data that's shared, large, unbounded or updated on its own (products, a user's activity log).

**Q: Why are column stores fast for analytics?**

They read only the columns a query uses, and columns of similar values compress very well, so far less data comes off disk. They also process values in batches. Row stores are better for single-row reads and updates.

**Q: How does full-text search find documents quickly?**

An inverted index maps each (stemmed) word to the documents containing it, so a search looks up the words and combines their lists instead of scanning every document.
