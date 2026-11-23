> 💡 **In one line:** when one database server can't keep up, you first make it bigger and stop wasting it (pooling, indexes, caching), then copy it for reads (replicas), split big tables (partitions), and only last split the data across servers (shards). Each step buys capacity and adds a new way for things to go wrong.

## Vertical and horizontal scaling

| | Vertical ("scale up") | Horizontal ("scale out") |
| --- | --- | --- |
| What | a bigger server: more CPU, memory, faster disks | more servers sharing the work |
| Effort | change the server size; the app doesn't change | replicas, sharding, routing: the app has to know |
| Limit | the biggest machine you can buy, and one machine can still fail | in theory none; in practice, cross-server queries and consistency get hard |

Scale up first: one well-tuned Postgres server with enough memory handles far more than most apps need, and it keeps joins and transactions simple. Scale out the part that runs out: reads, writes or storage.

## Connection pooling

Each Postgres connection is a separate process on the server, using several megabytes of memory, and the default limit is 100 connections (`max_connections`). Web apps open many short connections: 50 app servers × 20 connections each would be 1,000, far past what the database handles well.

A **connection pooler** such as **PgBouncer** sits between the app and Postgres. Thousands of app connections share a few dozen real ones: a real connection is lent to a request only while its transaction runs. It's often the first scaling fix, and it costs nothing in the data model.

## Read replicas and replication lag

A **replica** is a copy of the database that follows the main server (the **primary**). The primary streams its write-ahead log (the record of every change) to the replicas, which replay it.

- Reads can go to any replica, so read capacity grows with each copy.
- Writes still all go to the primary: replicas add **no** write capacity.
- If the primary fails, a replica can be promoted to take over (**failover**).

With **asynchronous** replication (the usual), the primary doesn't wait for the replicas, so they're slightly behind: **replication lag**, usually milliseconds, sometimes seconds. The classic bug: a user saves their profile (written to the primary), the page reloads from a replica that hasn't caught up, and their change seems lost. Fixes: read a user's own data from the primary for a short time after they write (**read-your-writes**), or wait until the replica has reached the write's position in the log.

**Synchronous** replication waits for a replica to confirm before `COMMIT` returns: no data lost if the primary dies, but every write is slower.

## Partitioning: one big table split into smaller ones

**Partitioning** splits one table into pieces inside the same server; queries still use the one table name. Postgres sends each row to the right piece, and a query that filters on the **partition key** reads only the pieces it needs (**partition pruning**).

```sql
CREATE TABLE events (id bigint, at date, payload text) PARTITION BY RANGE (at);
CREATE TABLE events_2025_h1 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-07-01');
CREATE TABLE events_2025_h2 PARTITION OF events FOR VALUES FROM ('2025-07-01') TO ('2026-01-01');

INSERT INTO events
SELECT i, DATE '2025-01-01' + i % 365, 'e' FROM generate_series(1, 1000) AS i;

SELECT tableoid::regclass AS partition, COUNT(*) FROM events GROUP BY 1 ORDER BY 1;
EXPLAIN (COSTS OFF) SELECT * FROM events WHERE at >= '2025-09-01';
EXPLAIN (COSTS OFF) SELECT * FROM events WHERE id = 7;
```

- The 1,000 rows split 542 / 458 between the two halves of the year.
- The query on September onwards scans **only** `events_2025_h2`: the first half can't contain those dates.
- The query on `id` must scan **both** (`Append` of two scans): it doesn't filter on the partition key.

A row with no matching partition is refused:

```sql error
CREATE TABLE events (id bigint, at date) PARTITION BY RANGE (at);
CREATE TABLE events_2025_h1 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-07-01');
INSERT INTO events VALUES (1, '2026-02-01');
```

| Kind | Splits by | Good for |
| --- | --- | --- |
| `RANGE` | value ranges, usually time | logs and events: drop a whole old month in an instant with `DROP TABLE` instead of a slow `DELETE` |
| `LIST` | listed values | per region or per country |
| `HASH` | a hash of the key, into N even pieces | spreading rows evenly when there's no natural range |

Partitioning helps when tables are huge and queries filter on the key; it doesn't add servers.

## Sharding and choosing a shard key

**Sharding** splits the data across several **servers** (shards), each holding part of the rows. Unlike replicas, each shard has different data, so writes and storage scale too. Unlike partitions, the pieces are on different machines, so the application (or a layer such as Citus or Vitess) must know where each row lives.

The **shard key** decides which shard a row goes to, and it's the most important choice:

| A good shard key… | Good | Bad |
| --- | --- | --- |
| has many distinct values | `customer_id` | `country` (one huge India shard) |
| spreads writes evenly | a hash of `user_id` | `created_at` (every new row goes to the newest shard: a **hot shard**) |
| keeps common queries on one shard | `tenant_id` in a business app: one company's data together | `order_id` when every page shows one customer's orders across shards |

The costs: queries that need several shards (reports, joins across tenants) must ask all of them and combine the answers; a transaction across shards needs two-phase commit (see [internals](/topics/internals)); and moving data when you add shards is slow. Shard as late as you can.

## Consistent hashing: adding a shard without moving everything

The simple way to pick a shard is `id % N`. Watch what happens when N changes:

```steps shard-moves
```

Going from 3 to 4 shards moves 75% of the shop's customers. On a real system that's most of your data crossing the network.

**Consistent hashing** places both shards and keys on a ring of hash values (picture a clock face). A key belongs to the first shard clockwise from it. A new shard takes over only the keys between it and the shard before it: about 1/N of the data, a quarter when going to 4 shards. Real systems put each shard at many points on the ring (**virtual nodes**) so the pieces stay even. Cassandra, DynamoDB and many caches use it; Structura's [consistent hashing](https://structura-web.netlify.app/topic/consistent-hashing/) topic animates it.

## CAP and PACELC

Once data lives on several servers, the network between them can fail. During a **partition** (servers can't reach each other), each side must choose:

- **Consistency**: refuse requests it can't answer with the latest data, or
- **Availability**: answer anyway, possibly with old data.

That's the **CAP theorem**: consistency, availability, partition tolerance; during a partition you get only one of the first two. **PACELC** adds the normal case: **E**lse (no partition), choose between **L**atency (answer from the nearest copy) and **C**onsistency (wait for copies to agree).

| System | Partition: A or C? | Else: L or C? |
| --- | --- | --- |
| Postgres with a synchronous replica | C | C |
| Postgres with async replicas, reading replicas | A (replicas answer with old data) | L |
| Cassandra, DynamoDB (default settings) | A | L |
| Google Spanner | C | C |

Cassandra lets you pick per query with **quorums**: with N copies, write to W and read from R; if R + W > N, every read overlaps the latest write. With N = 3: W = 2 and R = 2 gives 4 > 3 (consistent); W = 1 and R = 1 gives 2 (fast, may be stale).

## Caching

A cache keeps hot data in memory (Redis, Memcached, or the app's own memory) so most reads never reach the database.

**Cache-aside**, the usual pattern:

1. Read: look in the cache. On a miss, read the database and store the value with a **TTL** (time to live: when it expires).
2. Write: update the database, then **delete** the cache key. The next read fills it with the new value.

Delete rather than update the key: two writes racing can leave the older value in the cache.

| Problem | What happens | Fix |
| --- | --- | --- |
| Stale data | the cache serves a value the database has changed | delete on write; short TTLs for data that must be fresh |
| Thundering herd | a hot key expires and thousands of requests hit the database together | let one request refill it (a lock), or refresh hot keys before they expire |
| Cache penetration | requests for ids that don't exist always miss and reach the database | cache "not found" briefly too |

Before adding a cache, check that the query itself is fast (an index is cheaper than a cache) and that the database's own memory, which already caches pages, is big enough.

## Unique IDs across many servers

One database hands out 1, 2, 3 … with an identity column. With many shards or services, each needs to make ids without asking the others, and they must never clash. Two common answers:

- **UUIDs**: 128 random bits; clashes are practically impossible. They're 16 bytes and random ones don't sort by time (UUIDv7 starts with a timestamp and does).
- **Snowflake IDs** (from Twitter): a 64-bit number built from parts: 41 bits of milliseconds since a chosen start date, 10 bits of machine number, and 12 bits of sequence within the millisecond.

This builds one in SQL, for machine 7, sequence 42, at 10:00 UTC on 1 March 2025, then takes it apart again:

```sql
WITH made AS (
  SELECT (((EXTRACT(EPOCH FROM TIMESTAMPTZ '2025-03-01 10:00:00+00') * 1000)::bigint
            - 1288834974657) << 22)   -- milliseconds since Twitter's start date, moved left 22 bits
         | (7 << 12)                    -- machine 7, in the next 10 bits
         | 42                           -- sequence 42, in the last 12 bits
         AS id
)
SELECT id,
       to_timestamp(((id >> 22) + 1288834974657) / 1000.0) AS made_at,
       (id >> 12) & 1023 AS machine,
       id & 4095 AS sequence
FROM made;
```

- `<<` shifts bits left; `|` combines them; `>>` and `&` take them apart.
- 41 bits of milliseconds last 2^41 ms ≈ 69.7 years from the start date.
- 10 bits allow 2^10 = 1,024 machines; 12 bits allow 4,096 ids per machine per millisecond.
- Ids made later are bigger, so they sort by time and keep index inserts in order.

## Mistakes to avoid

> ⚠️ **Sharding before you need it**: you give up joins and transactions across the data. Indexes, pooling, a bigger server and read replicas come first.

> ⚠️ **Reading your own write from a replica**: replication lag makes the change seem lost. Read the user's own recent data from the primary.

> ⚠️ **A shard key that concentrates writes** (time, or a few big customers): one shard melts while the others idle.

> ⚠️ **`id % N` for shards you'll add to**: most data moves. Use consistent hashing, or many small fixed shards mapped to servers.

## Interview questions

**Q: Replication or sharding: which solves what?**

Replication copies all data to more servers: more read capacity and failover, but every write still goes to every copy. Sharding splits data across servers: more write capacity and storage, at the cost of cross-shard queries and transactions.

**Q: How would you choose a shard key for a multi-tenant SaaS app?**

`tenant_id`: it has many values, and almost every query is about one tenant, so it stays on one shard. Watch for one giant tenant: give it its own shard, or shard it further by another key.

**Q: Why does `id % N` hurt when you add a server?**

Changing N changes the remainder of most ids: going from 3 to 4 shards moved 75% of the shop's customers. Consistent hashing moves only the keys the new server takes over, about 1/N of them.

**Q: Design ids for a system that writes from many servers.**

Snowflake-style: a timestamp, a machine number and a per-millisecond counter packed into 64 bits. Unique without coordination, sortable by time, and 8 bytes. Or UUIDv7 if 16 bytes is fine.
