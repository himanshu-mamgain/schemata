# Schemata

Learn databases by running them. A real PostgreSQL runs in your browser tab ([PGlite](https://github.com/electric-sql/pglite)), so there is no backend: Netlify only serves static files.

Part of the same family as [DSA Atlas](https://dsa-atz.netlify.app) and [Structura](https://structura-web.netlify.app). See [docs/ecosystem.md](docs/ecosystem.md).

## What's inside

- **SQL editor**: Monaco with completions for the open dataset's tables and columns, `EXPLAIN ANALYZE`, saved queries, and results tables. Ctrl+Enter runs the query, or only the selected part.
- **Datasets**: a built-in `shop` schema (customers, orders, products, employees, logins), plus [Chinook](https://github.com/lerocha/chinook-database) and [Northwind](https://github.com/pthom/northwind_psql), downloaded from GitHub the first time you open them and then kept in the browser (IndexedDB).
- **Interview questions**: SQL questions, easy to hard, checked against the expected result inside a rolled-back transaction, plus theory questions (ACID, isolation, MVCC, sharding, CAP, LSM vs B-tree…).
- **Schema diagrams**: write [DBML](https://dbml.dbdiagram.io/docs) and see the ER diagram as you type (parsed with `@dbml/parse`, drawn with React Flow). Any dataset in the SQL editor can be drawn too, and a schema can be shared as a link (`/erd#dbml=…`).
- **Design problems**: schema-design questions (blog tags, order history, library loans, followers, cinema seats). You write DBML, and automatic checks look at your tables, keys and relationships; then compare with a model answer.
- **Themes**: Paper (the default, Structura's Warm Paper look), Blueprint and Chalkboard.
- **Installable and offline**: a PWA with an Install button (as in Structura). After the first visit every page, Postgres and the editor work offline.
- **Roadmap**: 11 stages in 4 phases, from SELECT to database internals, each with a query to try.
- **Database guide**: PostgreSQL, MySQL, SQLite, MongoDB, Redis, Cassandra, DynamoDB, Neo4j, Elasticsearch, ClickHouse/DuckDB and vector databases. Each has when to use it and when not to, who uses it, a roadmap, interview questions and open-source repos.

Progress, drafts and saved queries are kept on your device (localStorage), and with a Studia account they follow you to every device. Loaded datasets stay in IndexedDB.

## Develop

```bash
npm install
npm run dev        # Next.js dev server, http://localhost:3000
npm test           # every SQL solution on the shop data, every design answer against its checks, the DBML diagrams
npm run build      # typecheck + static export into out/ + service worker
```

## Deploy (Netlify)

Schemata is a Next.js app exported as static files (`output: "export"`): every topic and question is its own prerendered page, and Postgres runs in the browser, so there is no server. `netlify.toml` has everything: build `npm run build`, publish `out`. Name the site `schemata-web` so the URL matches the ecosystem list (`https://schemata-web.netlify.app`).

After `next build`, `scripts/flatten-segments.mjs` copies Next's prefetch files to the names its client requests, and `scripts/service-worker.mjs` writes `out/sw.js` (Workbox) to precache the site. PGlite's WebAssembly is copied to `public/pglite/` (`scripts/pglite-assets.mjs`) and loaded from there. App icons are generated from `public/favicon.svg` with `npm run icons`.

Older query-string links (`/?topic=…`, `/?q=…`, `/?page=…`) redirect to the new addresses (`netlify.toml`, and in the browser `src/routes.ts`).

The build refreshes `src/data/structura-topics.json` from Structura (if that fails, the saved copy is used), and publishes `/topics.json` with a CORS header so the other apps can link here.

## Studia account

Schemata shares one account with Structura and DSA Atlas: **Studia**. You sign in with GitHub on
the Studia site (`studia-hub.netlify.app`), and your progress is kept in Supabase (a hosted
Postgres database with sign-in built in), one row per app in the `app_progress` table. The table,
its security rules and the setup steps live in the `studia` repo (`docs/accounts.md`).

What syncs: the questions you solved, your answer to each SQL question, your DBML for each design
question, and your saved queries. The playground and diagram drafts, the theme and loaded
datasets stay on the device.

How it syncs (`src/account/`):

- **Read, merge, write.** After you sign in, and 4 seconds after each change, the app fetches the
  account's copy, merges it with this device's (`merge.ts`) and saves the result in both places.
- **Merging.** A solved question stays solved (with the first time). An answer or design comes
  from the copy changed last (`schemata:edited` keeps the times). Saved queries from both devices
  are kept; a deleted one is remembered for 180 days, so another device doesn't bring it back.
- **Signing in first.** With `NEXT_PUBLIC_REQUIRE_SIGN_IN=true`, a script in `<head>`
  (`accountBootScript`) sends a signed-out visitor to Studia's login before the page paints, then
  Studia sends them back. Offline, after a failed sign-in, and for search engines, it doesn't.
- The Supabase code is a separate chunk, loaded only when this browser is signed in or signing in.

Netlify environment variables (read at build time):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | the Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key: public by design (row-level security decides what each user may read or write). Leave "Contains secret values" unticked, or Netlify's secrets scan stops the build |
| `NEXT_PUBLIC_STUDIA_URL` | `https://studia-hub.netlify.app`: sign in and out there |
| `NEXT_PUBLIC_REQUIRE_SIGN_IN` | `true` to send signed-out visitors to Studia's login first |

Without the first two the account button is hidden and nothing is loaded. Tests: `npm test`
(`src/account/sync.test.ts`).

## Adding content

- Questions: `src/content/questions.ts`. A SQL question needs a `solution`; `npm test` checks that it runs on the shop data.
- Design problems: `src/content/design.ts`, with checks from `src/erd/checks.ts`. `npm test` makes sure each model answer passes every check and the starter doesn't.
- Roadmap stages: `src/content/roadmap.ts`. Databases: `src/content/databases.ts`.
- **Lessons** (the Learn pages): `src/content/lessons/<stage-id>.md`, one per roadmap stage, read when the page is built. The Markdown they use is listed in `src/content/lessonFormat.ts`: ```` ```sql ```` blocks get **Run** (on the shop data, rolled back) and **Open in the editor**; ```` ```sql error ```` fails on purpose; ```` ```sql norun ```` is shown only. Write them in Simple English, explain every term where it first appears, and compute every number by running the query. `npm test` runs every example and checks every link.
- **Step-throughs**: `src/content/steps.ts` builds the Next/Back players (a JOIN matching rows, GROUP BY making groups, a window sliding) from a few real rows. Put one in a lesson with ```` ```steps <id> ````. Each one's `sql` must return exactly its last table on the shop data; `npm test` checks it.
- **Questions** say exactly what to return: the columns in order, which rows count, how to sort and break ties, NULLs and rounding. The question page also shows the expected result's shape, worked out from the model answer.
- Datasets: `src/db/datasets.ts`. Any Postgres script made of plain SQL statements works (not `COPY … FROM stdin`).
