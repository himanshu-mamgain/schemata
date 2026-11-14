import type { EcoRef } from "../ecosystem";

export type DbFamily = "Relational" | "Document" | "Key-value" | "Wide-column" | "Graph" | "Search" | "Analytical" | "Vector";

export interface Company {
  name: string;
  /** What they use it for. Public, well-documented uses only (engineering blogs, talks). */
  use: string;
}

export interface DatabaseGuide {
  id: string;
  name: string;
  family: DbFamily;
  tagline: string;
  /** Data model in one paragraph. */
  model: string;
  useWhen: string[];
  avoidWhen: string[];
  companies: Company[];
  /** The query language, as Monaco calls it, and a taste of it. */
  language: string;
  example: string;
  /** What to learn, basic → advanced. */
  roadmap: { basic: string[]; intermediate: string[]; advanced: string[] };
  interview: string[];
  /** Open-source repos worth reading or using as data. */
  repos: { repo: string; why: string }[];
  related?: EcoRef[];
  /** Playground dataset to open for hands-on practice, when there is one in the browser. */
  practice?: string;
}

export const DATABASES: DatabaseGuide[] = [
  {
    id: "postgresql", name: "PostgreSQL", family: "Relational",
    tagline: "The default choice: correct, extensible, and good at almost everything.",
    model: "Tables with rows and typed columns, related by keys, queried with SQL. Strong transactions (MVCC), rich types (JSONB, arrays, ranges) and extensions (PostGIS, pgvector, TimescaleDB).",
    useWhen: ["You're starting a new product and don't yet know every query", "Data is relational and correctness matters (money, orders, users)", "You want one database for relational, JSON, full-text, geo and vectors", "Complex reporting with joins and window functions"],
    avoidWhen: ["Write throughput beyond one primary even after partitioning (shard with Citus, or use Cassandra)", "Sub-millisecond key-value caching (put Redis in front)", "Analytics scanning billions of rows (ClickHouse, BigQuery)"],
    companies: [
      { name: "Instagram", use: "Sharded Postgres for core user and media data" },
      { name: "Notion", use: "Blocks stored in sharded Postgres" },
      { name: "Reddit", use: "Core data (posts, comments, votes) in Postgres" },
      { name: "Apple", use: "Many internal services" },
    ],
    language: "pgsql",
    example: "SELECT c.name, COUNT(*) AS orders\nFROM customers c JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY orders DESC\nLIMIT 5;",
    roadmap: {
      basic: ["psql basics, types, constraints", "SELECT / JOIN / GROUP BY", "INSERT … RETURNING, ON CONFLICT (upsert)"],
      intermediate: ["Window functions, CTEs, JSONB", "EXPLAIN ANALYZE, B-tree / GIN / partial indexes", "Transactions, isolation levels, row locks"],
      advanced: ["MVCC, VACUUM, bloat, WAL", "Streaming replication, logical replication, failover (Patroni)", "Partitioning, Citus sharding, PgBouncer", "Extensions: pgvector, PostGIS, pg_stat_statements"],
    },
    interview: ["How does MVCC work and why do you need VACUUM?", "How would you find and fix a slow query?", "Explain read committed vs repeatable read in Postgres.", "When would you use a GIN index?", "How would you add a column to a 500M-row table without downtime?"],
    repos: [
      { repo: "postgres/postgres", why: "The source. Read src/backend/access/nbtree for B-trees" },
      { repo: "electric-sql/pglite", why: "Postgres in WebAssembly. It powers this app's editor" },
      { repo: "devrimgunduz/pagila", why: "DVD-rental sample database for Postgres" },
      { repo: "neondatabase/postgres-sample-dbs", why: "Several sample databases ready to load" },
    ],
    related: [{ app: "structura", topic: "database-sharding" }],
    practice: "shop",
  },
  {
    id: "mysql", name: "MySQL", family: "Relational",
    tagline: "The web's workhorse: simple, fast reads, huge operational know-how.",
    model: "Relational SQL like Postgres. InnoDB stores each table as a B+ tree clustered on the primary key, so secondary indexes point to the primary key.",
    useWhen: ["Read-heavy web apps with simple queries", "Your team or hosting already runs MySQL", "Massive horizontal scale with Vitess", "Ecosystems built around it (WordPress, many PHP/Rails stacks)"],
    avoidWhen: ["You need advanced SQL features, rich types or extensions (Postgres is stronger)", "Heavy analytics"],
    companies: [
      { name: "Meta (Facebook)", use: "The social graph's storage tier (MyRocks engine)" },
      { name: "YouTube", use: "Created Vitess to shard MySQL" },
      { name: "GitHub", use: "Primary datastore, sharded with Vitess" },
      { name: "Uber", use: "Schemaless and Docstore, built on MySQL" },
    ],
    language: "mysql",
    example: "SELECT department_id, AVG(salary) AS avg_salary\nFROM employees\nGROUP BY department_id\nHAVING AVG(salary) > 100000;",
    roadmap: {
      basic: ["SQL basics, InnoDB vs MyISAM", "AUTO_INCREMENT, character sets (utf8mb4)"],
      intermediate: ["Clustered primary key and its effect on secondary indexes", "EXPLAIN, covering indexes", "Gap locks and next-key locking"],
      advanced: ["Binlog replication, GTIDs, semi-sync", "Online schema change (gh-ost, pt-osc)", "Vitess sharding"],
    },
    interview: ["Why should an InnoDB primary key be short and increasing?", "What are gap locks?", "MySQL vs Postgres for a new project?", "How does replication lag affect reads?"],
    repos: [
      { repo: "datacharmer/test_db", why: "Employees sample database, about 4M rows" },
      { repo: "vitessio/vitess", why: "Sharding layer from YouTube" },
      { repo: "github/gh-ost", why: "GitHub's online schema migration tool" },
      { repo: "jOOQ/sakila", why: "Sakila sample database, ported to many databases" },
    ],
    related: [{ app: "structura", topic: "database-sharding" }],
    practice: "shop",
  },
  {
    id: "sqlite", name: "SQLite", family: "Relational",
    tagline: "A whole SQL database in one file, inside your app.",
    model: "An embedded library, not a server: the database is a single file the app opens directly. Full SQL with transactions; one writer at a time.",
    useWhen: ["Mobile and desktop apps, browsers, devices", "Local-first apps, caches, test databases", "Small-to-medium websites with mostly reads", "Shipping data as a file (a better CSV)"],
    avoidWhen: ["Many concurrent writers across machines", "You need a network database server"],
    companies: [
      { name: "Every iPhone and Android phone", use: "System and app data" },
      { name: "Web browsers (Chrome, Firefox, Safari)", use: "History, cookies, bookmarks" },
      { name: "Airbus", use: "Flight software (per the SQLite site)" },
      { name: "Expensify", use: "Bedrock, a distributed SQLite" },
    ],
    language: "sql",
    example: "SELECT category, COUNT(*), ROUND(AVG(price), 2)\nFROM products\nGROUP BY category;",
    roadmap: {
      basic: ["The sqlite3 CLI, type affinity, rowid"],
      intermediate: ["WAL mode, PRAGMAs, FTS5 full-text search", "Indexes and EXPLAIN QUERY PLAN"],
      advanced: ["Replication with Litestream or LiteFS", "Edge SQLite (Turso / libSQL, Cloudflare D1)"],
    },
    interview: ["When is SQLite the right production database?", "What does WAL mode change?", "Why only one writer?"],
    repos: [
      { repo: "sqlite/sqlite", why: "The source (mirror)" },
      { repo: "jpwhite3/northwind-SQLite3", why: "Northwind as a SQLite file" },
      { repo: "benbjohnson/litestream", why: "Streams SQLite to S3" },
      { repo: "sql-js/sql.js", why: "SQLite compiled to WebAssembly" },
    ],
    practice: "shop",
  },
  {
    id: "mongodb", name: "MongoDB", family: "Document",
    tagline: "JSON-like documents that match your objects.",
    model: "Collections of BSON documents with flexible shape. Related data is usually embedded in one document; queries use a JSON filter language and aggregation pipelines. Multi-document transactions exist but are the exception.",
    useWhen: ["Data is naturally a tree read as a whole (product catalogue, CMS content, user profiles)", "Fields vary a lot between records", "Fast iteration on the schema early on", "Horizontal scaling with built-in sharding"],
    avoidWhen: ["Highly relational data with many-to-many joins", "Strict cross-entity invariants (ledgers)"],
    companies: [
      { name: "eBay", use: "Metadata and catalogue services" },
      { name: "Adobe", use: "Experience Manager content" },
    ],
    language: "javascript",
    example: "db.orders.aggregate([\n  { $match: { status: \"delivered\" } },\n  { $group: { _id: \"$customerId\", orders: { $sum: 1 } } },\n  { $sort: { orders: -1 } },\n  { $limit: 5 }\n])",
    roadmap: {
      basic: ["CRUD, filters and projections", "Embedding vs referencing"],
      intermediate: ["Aggregation pipeline ($match, $group, $lookup, $unwind)", "Compound, multikey and text indexes; explain()", "Schema validation"],
      advanced: ["Replica sets and read/write concerns", "Sharding and shard keys", "Change streams, transactions"],
    },
    interview: ["When do you embed and when do you reference?", "How do you pick a shard key?", "What do write concern and read concern control?", "How would you model a many-to-many relationship?"],
    repos: [
      { repo: "neelabalan/mongodb-sample-dataset", why: "MongoDB's sample datasets (mflix, airbnb…) as JSON" },
      { repo: "mongodb/mongo", why: "The source" },
      { repo: "kofrasa/mingo", why: "MongoDB query language in JavaScript" },
    ],
    related: [{ app: "structura", topic: "key-value-store" }],
  },
  {
    id: "redis", name: "Redis", family: "Key-value",
    tagline: "In-memory data structures with sub-millisecond latency.",
    model: "Keys mapped to data structures (strings, hashes, lists, sets, sorted sets, streams) kept in memory. Single-threaded command execution makes each command atomic. Optional persistence with RDB snapshots or an append-only file.",
    useWhen: ["Caching database results and sessions", "Rate limiting, counters, distributed locks", "Leaderboards (sorted sets), queues, pub/sub", "Anything that must answer in under a millisecond"],
    avoidWhen: ["As the only copy of data you can't lose", "Data larger than memory", "Complex queries"],
    companies: [
      { name: "X (Twitter)", use: "Home timelines cached in Redis" },
      { name: "GitHub", use: "Queues and caching" },
      { name: "Stack Overflow", use: "Caching layer" },
    ],
    language: "redis",
    example: "ZADD leaderboard 4200 \"asha\" 3100 \"vikram\"\nZINCRBY leaderboard 500 \"vikram\"\nZREVRANGE leaderboard 0 9 WITHSCORES\nSET session:42 \"{...}\" EX 3600",
    roadmap: {
      basic: ["Strings, hashes, lists, sets, sorted sets", "TTL and eviction policies"],
      intermediate: ["Cache-aside and invalidation", "Pipelining, Lua scripts, transactions (MULTI)", "Persistence: RDB vs AOF"],
      advanced: ["Replication and Sentinel", "Redis Cluster and hash slots", "Distributed locks and their limits"],
    },
    interview: ["Why is Redis fast despite being single-threaded?", "How would you build a rate limiter with Redis?", "How do you keep the cache consistent with the database?", "What happens on a cache stampede?"],
    repos: [
      { repo: "redis/redis", why: "Very readable C source" },
      { repo: "valkey-io/valkey", why: "The open-source fork" },
      { repo: "codecrafters-io/build-your-own-x", why: "Includes 'build your own Redis'" },
    ],
    related: [{ app: "structura", topic: "redis-basics" }, { app: "structura", topic: "redis-persistence" }, { app: "structura", topic: "rate-limiter" }, { app: "dsa-atlas", pattern: "Heap / Priority Queue" }],
  },
  {
    id: "cassandra", name: "Cassandra / ScyllaDB", family: "Wide-column",
    tagline: "Huge write throughput across data centres, with no single leader.",
    model: "Tables partitioned by a partition key across a ring of nodes (consistent hashing), sorted within a partition by clustering columns. LSM-tree storage. Tunable consistency per query. Model one table per query.",
    useWhen: ["Massive write volumes: messages, events, IoT, time series", "Multi-region active-active", "Access by known keys and time ranges"],
    avoidWhen: ["Ad-hoc queries, joins, aggregations", "Strong transactions across rows"],
    companies: [
      { name: "Netflix", use: "Viewing history and many services" },
      { name: "Apple", use: "One of the largest Cassandra deployments" },
      { name: "Discord", use: "Messages: moved from Cassandra to ScyllaDB" },
    ],
    language: "sql",
    example: "CREATE TABLE messages (\n  channel_id bigint,\n  bucket int,\n  message_id timeuuid,\n  author text,\n  body text,\n  PRIMARY KEY ((channel_id, bucket), message_id)\n) WITH CLUSTERING ORDER BY (message_id DESC);",
    roadmap: {
      basic: ["CQL, keyspaces, partition and clustering keys"],
      intermediate: ["Query-first modelling, denormalization", "Consistency levels and quorum (R + W > N)"],
      advanced: ["LSM trees, compaction strategies, tombstones", "Repairs, hinted handoff, gossip"],
    },
    interview: ["How would you store chat messages in Cassandra?", "What is a hot partition and how do you avoid one?", "Why are deletes expensive (tombstones)?"],
    repos: [
      { repo: "apache/cassandra", why: "The source" },
      { repo: "scylladb/scylladb", why: "C++ rewrite, compatible with Cassandra" },
    ],
    related: [{ app: "structura", topic: "consistent-hashing" }, { app: "structura", topic: "chat-system" }],
  },
  {
    id: "dynamodb", name: "DynamoDB", family: "Key-value",
    tagline: "Serverless key-value at any scale, with predictable latency.",
    model: "Items in tables, addressed by a partition key (plus an optional sort key). Fully managed by AWS; you pay per request or for provisioned capacity. Secondary indexes for other access patterns.",
    useWhen: ["Known access patterns at very large scale", "Serverless apps on AWS", "Single-digit-millisecond latency without running servers"],
    avoidWhen: ["Ad-hoc queries and analytics", "Access patterns you can't predict"],
    companies: [
      { name: "Amazon", use: "Shopping cart and Prime Day traffic" },
      { name: "Lyft", use: "Ride and location data" },
      { name: "Duolingo", use: "Learning progress at scale" },
    ],
    language: "javascript",
    example: "// Single-table design: one query returns a customer and their orders\nquery({\n  TableName: \"shop\",\n  KeyConditionExpression: \"PK = :pk AND begins_with(SK, :o)\",\n  ExpressionAttributeValues: { \":pk\": \"CUSTOMER#7\", \":o\": \"ORDER#\" }\n})",
    roadmap: {
      basic: ["Partition key, sort key, items", "GetItem / Query / Scan"],
      intermediate: ["GSIs and LSIs", "Single-table design", "Conditional writes"],
      advanced: ["Hot partitions and adaptive capacity", "Streams and event-driven design", "Transactions and their limits"],
    },
    interview: ["Why is Scan bad?", "Design the tables for an e-commerce app.", "How do you avoid hot partitions?"],
    repos: [{ repo: "aws-samples/aws-dynamodb-examples", why: "Official examples, including single-table design patterns" }],
    related: [{ app: "structura", topic: "key-value-store" }],
  },
  {
    id: "neo4j", name: "Neo4j", family: "Graph",
    tagline: "Relationships are first-class: traverse them instead of joining them.",
    model: "Nodes and relationships, both with properties. Traversals follow pointers between nodes, so a 5-hop query costs about the same as a 1-hop one. Queried with Cypher.",
    useWhen: ["Highly connected data: social networks, fraud rings, recommendations", "Variable-depth traversals (friends of friends of friends)", "Knowledge graphs"],
    avoidWhen: ["Simple tabular data", "Bulk aggregations over everything"],
    companies: [
      { name: "NASA", use: "Lessons-learned knowledge graph" },
      { name: "Walmart", use: "Recommendations" },
      { name: "eBay", use: "ShopBot conversational commerce" },
    ],
    language: "cypher",
    example: "MATCH (me:Person {name: 'Asha'})-[:FOLLOWS*2]->(fof:Person)\nWHERE NOT (me)-[:FOLLOWS]->(fof) AND me <> fof\nRETURN fof.name, count(*) AS mutuals\nORDER BY mutuals DESC LIMIT 10;",
    roadmap: {
      basic: ["Nodes, relationships, properties; Cypher MATCH / CREATE"],
      intermediate: ["Variable-length paths, shortest path", "Indexes and constraints"],
      advanced: ["Graph algorithms (PageRank, community detection)", "Modelling time and versions in graphs"],
    },
    interview: ["When would a graph database beat SQL?", "Model 'people you may know'.", "How does index-free adjacency work?"],
    repos: [
      { repo: "neo4j-graph-examples/movies", why: "The classic movies graph" },
      { repo: "neo4j/neo4j", why: "The source" },
    ],
    related: [{ app: "structura", topic: "social-graph" }, { app: "dsa-atlas", pattern: "Graphs" }, { app: "dsa-atlas", pattern: "Advanced Graph" }],
  },
  {
    id: "elasticsearch", name: "Elasticsearch / OpenSearch", family: "Search",
    tagline: "Full-text search and log analytics on an inverted index.",
    model: "JSON documents indexed into an inverted index (term → documents), split into shards. Relevance scoring with BM25, fuzzy matching, aggregations.",
    useWhen: ["Search boxes: typo tolerance, relevance ranking, facets", "Logs and observability (the ELK stack)", "Autocomplete"],
    avoidWhen: ["As the primary source of truth", "Transactions or frequent updates to the same document"],
    companies: [
      { name: "Wikipedia", use: "Site search (CirrusSearch)" },
      { name: "Uber", use: "Marketplace and logs" },
      { name: "GitHub", use: "Code and issue search (before its own engine)" },
    ],
    language: "javascript",
    example: "GET products/_search\n{\n  \"query\": { \"match\": { \"name\": { \"query\": \"keybord\", \"fuzziness\": \"AUTO\" } } },\n  \"aggs\": { \"by_category\": { \"terms\": { \"field\": \"category\" } } }\n}",
    roadmap: {
      basic: ["Documents, indexes, mappings", "match vs term queries"],
      intermediate: ["Analyzers and tokenizers", "Aggregations, relevance (BM25)"],
      advanced: ["Shards and replicas, cluster sizing", "Keeping search in sync with the database (CDC)"],
    },
    interview: ["How does an inverted index work?", "How do you keep Elasticsearch in sync with Postgres?", "How would you build autocomplete?"],
    repos: [
      { repo: "elastic/elasticsearch", why: "The source" },
      { repo: "opensearch-project/OpenSearch", why: "The Apache-2.0 fork" },
      { repo: "meilisearch/meilisearch", why: "A lighter search engine, easy to run" },
    ],
    related: [{ app: "structura", topic: "search-autocomplete" }, { app: "dsa-atlas", pattern: "Trie" }],
  },
  {
    id: "clickhouse", name: "ClickHouse / DuckDB", family: "Analytical",
    tagline: "Columnar engines that scan billions of rows in seconds.",
    model: "Data is stored by column, compressed, and processed in vectorised batches, so aggregations read only the columns they need. ClickHouse is a server for huge datasets; DuckDB is embedded, like SQLite for analytics.",
    useWhen: ["Dashboards and analytics over events and logs", "Aggregations over many rows, few columns", "DuckDB: analysing CSV or Parquet files on a laptop"],
    avoidWhen: ["Transactional workloads with many single-row updates (OLTP)"],
    companies: [
      { name: "Cloudflare", use: "HTTP analytics over trillions of rows (ClickHouse)" },
      { name: "Uber", use: "Logging platform (ClickHouse)" },
      { name: "eBay", use: "Monitoring and analytics (ClickHouse)" },
    ],
    language: "sql",
    example: "SELECT toStartOfHour(ts) AS hour, count() AS requests, quantile(0.99)(latency_ms) AS p99\nFROM http_logs\nWHERE ts > now() - INTERVAL 1 DAY\nGROUP BY hour ORDER BY hour;",
    roadmap: {
      basic: ["OLTP vs OLAP, row vs column storage"],
      intermediate: ["MergeTree engines, ORDER BY keys, partitions", "Materialized views"],
      advanced: ["Vectorised execution, compression codecs", "Star schemas and data warehouses"],
    },
    interview: ["Why is columnar storage faster for analytics?", "OLTP vs OLAP?", "Design a schema for clickstream analytics."],
    repos: [
      { repo: "ClickHouse/ClickHouse", why: "The source" },
      { repo: "duckdb/duckdb", why: "Embedded analytics database" },
      { repo: "duckdb/duckdb-wasm", why: "DuckDB in the browser" },
    ],
  },
  {
    id: "pgvector", name: "Vector databases (pgvector)", family: "Vector",
    tagline: "Nearest-neighbour search over embeddings for AI apps.",
    model: "Rows store high-dimensional vectors (embeddings). Approximate nearest-neighbour indexes (HNSW, IVFFlat) find the closest vectors by cosine or L2 distance. pgvector adds this to Postgres; Pinecone, Weaviate and Qdrant are dedicated options.",
    useWhen: ["Semantic search and RAG for LLM apps", "Recommendations by similarity", "Deduplicating similar content"],
    avoidWhen: ["Exact keyword lookups (use full-text search)", "Tiny datasets (brute force is fine)"],
    companies: [
      { name: "Supabase", use: "pgvector as a built-in for AI apps" },
      { name: "Spotify", use: "Annoy and Voyager for music similarity (open source)" },
    ],
    language: "pgsql",
    example: "CREATE EXTENSION vector;\nCREATE TABLE docs (id bigserial PRIMARY KEY, body text, embedding vector(1536));\nCREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops);\nSELECT body FROM docs ORDER BY embedding <=> $1 LIMIT 5;",
    roadmap: {
      basic: ["Embeddings and distance metrics"],
      intermediate: ["HNSW vs IVFFlat, recall vs speed", "Hybrid search (vector + keyword)"],
      advanced: ["Filtering with ANN, quantization, sharding vectors"],
    },
    interview: ["How does HNSW work?", "Design a RAG pipeline's storage.", "When would you use pgvector instead of a dedicated vector DB?"],
    repos: [
      { repo: "pgvector/pgvector", why: "Vector search for Postgres" },
      { repo: "qdrant/qdrant", why: "Dedicated vector database in Rust" },
    ],
    related: [{ app: "structura", topic: "vector-database" }, { app: "structura", topic: "rag-pipeline" }],
  },
];

export const databaseById = (id: string) => DATABASES.find((d) => d.id === id);
