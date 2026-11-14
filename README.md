# Schemata

Learn databases by running them. A real PostgreSQL runs in your browser tab ([PGlite](https://github.com/electric-sql/pglite)), so there is no backend: Netlify only serves static files.

Part of the same family as [DSA Atlas](https://dsa-atz.netlify.app) and [Structura](https://structura-web.netlify.app). See [docs/ecosystem.md](docs/ecosystem.md).

## What's inside

- **SQL editor**: Monaco with completions for the open dataset's tables and columns, `EXPLAIN ANALYZE`, saved queries, and results tables. Ctrl+Enter runs the query, or only the selected part.
- **Datasets**: a built-in `shop` schema (customers, orders, products, employees, logins), plus [Chinook](https://github.com/lerocha/chinook-database) and [Northwind](https://github.com/pthom/northwind_psql), downloaded from GitHub the first time you open them and then kept in the browser (IndexedDB).
- **Interview questions**: SQL questions, easy to hard, checked against the expected result inside a rolled-back transaction, plus theory questions (ACID, isolation, MVCC, sharding, CAP, LSM vs B-tree…).
- **Roadmap**: 11 stages in 4 phases, from SELECT to database internals, each with a query to try.
- **Database guide**: PostgreSQL, MySQL, SQLite, MongoDB, Redis, Cassandra, DynamoDB, Neo4j, Elasticsearch, ClickHouse/DuckDB and vector databases. Each has when to use it and when not to, who uses it, a roadmap, interview questions and open-source repos.

Progress, drafts and saved queries stay on your device (localStorage). Loaded datasets stay in IndexedDB.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # runs every question's solution against the shop data
npm run build      # typecheck + production build into dist/
```

## Deploy (Netlify)

`netlify.toml` has everything: build `npm run build`, publish `dist`. Name the site `schemata-web` so the URL matches the ecosystem list (`https://schemata-web.netlify.app`).

The build refreshes `src/data/structura-topics.json` from Structura (if that fails, the saved copy is used), and publishes `/topics.json` with a CORS header so the other apps can link here.

## Adding content

- Questions: `src/content/questions.ts`. A SQL question needs a `solution`; `npm test` checks that it runs on the shop data.
- Roadmap stages: `src/content/roadmap.ts`. Databases: `src/content/databases.ts`.
- Datasets: `src/db/datasets.ts`. Any Postgres script made of plain SQL statements works (not `COPY … FROM stdin`).
