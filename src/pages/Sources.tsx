import { DATASETS } from "../db/datasets";
import { RepoList } from "./Learn";
import { href, onLinkClick } from "../router";

/** Open-source datasets and repos. Every repo here was checked to exist on GitHub. */
const MORE_DATA = [
  { repo: "jOOQ/sakila", why: "Sakila DVD rental, ported to many databases (BSD-2)" },
  { repo: "devrimgunduz/pagila", why: "Sakila for Postgres (PostgreSQL licence)" },
  { repo: "datacharmer/test_db", why: "MySQL employees database, about 4M rows" },
  { repo: "microsoft/sql-server-samples", why: "AdventureWorks, WideWorldImporters, Northwind" },
  { repo: "neondatabase/postgres-sample-dbs", why: "A dozen sample databases for Postgres (MIT)" },
  { repo: "jpwhite3/northwind-SQLite3", why: "Northwind as a SQLite file (MIT)" },
  { repo: "neelabalan/mongodb-sample-dataset", why: "MongoDB sample datasets as JSON" },
  { repo: "neo4j-graph-examples/movies", why: "The Neo4j movies graph" },
];

const LEARN_INTERNALS = [
  { repo: "cmu-db/bustub", why: "Build a database in CMU's course (MIT)" },
  { repo: "electric-sql/pglite", why: "Postgres compiled to WebAssembly: the engine behind this app" },
  { repo: "duckdb/duckdb-wasm", why: "DuckDB in the browser" },
  { repo: "sql-js/sql.js", why: "SQLite in the browser" },
  { repo: "kofrasa/mingo", why: "The MongoDB query language in JavaScript" },
];

export function Sources() {
  return (
    <div>
      <h1>Data sources</h1>
      <p className="lead">The datasets behind the editor, and more open-source ones to practise on.</p>
      <h2>In the editor</h2>
      <ul className="repos">
        {DATASETS.map((d) => (
          <li key={d.id}>
            <a href={href({ name: "playground", dataset: d.id })} onClick={onLinkClick}>
              <strong>{d.name}</strong>
            </a>{" "}
            <span className="muted">{d.blurb}</span>{" "}
            {d.repo ? (
              <a href={`https://github.com/${d.repo}`} target="_blank" rel="noreferrer">
                {d.repo}
              </a>
            ) : (
              <span className="muted small">(generated for Schemata)</span>
            )}{" "}
            {d.license && <span className="tag">{d.license}</span>}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Downloaded datasets come straight from their GitHub repos the first time you open them, and are then kept in your browser. Schemata doesn't
        bundle or change them.
      </p>
      <h2>More sample databases</h2>
      <RepoList repos={MORE_DATA} />
      <h2>Learn how databases are built</h2>
      <RepoList repos={LEARN_INTERNALS} />
    </div>
  );
}
