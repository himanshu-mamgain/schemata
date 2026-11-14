import { CheckCircle2, Circle, Code2, Database, Map, MessageSquareCode } from "lucide-react";
import { PHASES, ROADMAP, stageById, type Stage } from "../content/roadmap";
import { QUESTIONS, type Level } from "../content/questions";
import { DATABASES, databaseById, type DatabaseGuide } from "../content/databases";
import { CodeBlock } from "../editor/SqlEditor";
import { EcoLinks } from "../components/AppSwitcher";
import { draft, solved } from "../store";
import { href, navigate, onLinkClick } from "../router";

const openInPlayground = (sql: string, dataset = "shop") => {
  draft.set({ dataset, sql });
  navigate({ name: "playground", dataset });
};

const A = ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
  <a href={to} onClick={onLinkClick} className={className}>
    {children}
  </a>
);

// ---------- Home ----------
export function Home() {
  const done = solved.use();
  const count = QUESTIONS.filter((q) => done[q.id]).length;
  return (
    <div className="home">
      <section className="hero">
        <h1>
          Learn databases <span className="grad">by running them</span>
        </h1>
        <p className="lead">
          A real PostgreSQL runs in this tab. Follow the roadmap from your first SELECT to MVCC, practise the interview questions that keep coming
          up, and learn when to pick Postgres, MongoDB, Redis, Cassandra and the rest.
        </p>
        <div className="row">
          <A to="/?page=playground" className="btn primary">
            <Code2 size={16} /> Open the SQL editor
          </A>
          <A to="/?page=roadmap" className="btn">
            <Map size={16} /> Start the roadmap
          </A>
        </div>
      </section>
      <section className="cards3">
        <A to="/?page=roadmap" className="card">
          <Map size={20} />
          <h3>Roadmap</h3>
          <p className="muted">{ROADMAP.length} stages in 4 phases, each with a query to try.</p>
        </A>
        <A to="/?page=questions" className="card">
          <MessageSquareCode size={20} />
          <h3>Interview questions</h3>
          <p className="muted">
            {QUESTIONS.length} questions, checked automatically. You've done {count}.
          </p>
        </A>
        <A to="/?page=databases" className="card">
          <Database size={20} />
          <h3>Database guide</h3>
          <p className="muted">{DATABASES.length} databases: when to use them, who does, and what to learn.</p>
        </A>
      </section>
    </div>
  );
}

// ---------- Roadmap ----------
export function Roadmap() {
  const done = solved.use();
  return (
    <div>
      <h1>Roadmap</h1>
      <p className="lead">From your first query to how databases work inside. Each stage links to its interview questions.</p>
      {PHASES.map((phase) => (
        <section key={phase} className="phase">
          <h2>{phase}</h2>
          <ol className="stages">
            {ROADMAP.filter((s) => s.phase === phase).map((s) => {
              const qs = QUESTIONS.filter((q) => q.stage === s.id);
              const n = qs.filter((q) => done[q.id]).length;
              return (
                <li key={s.id}>
                  <A to={href({ name: "topic", id: s.id })} className="stage-card">
                    <strong>{s.title}</strong>
                    <span className="muted small">{s.summary}</span>
                    {qs.length > 0 && (
                      <span className="small progress">
                        {n}/{qs.length} questions
                      </span>
                    )}
                  </A>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function StagePage({ s }: { s: Stage }) {
  const done = solved.use();
  const qs = QUESTIONS.filter((q) => q.stage === s.id);
  const i = ROADMAP.indexOf(s);
  return (
    <article>
      <p className="crumbs">
        <A to="/?page=roadmap">Roadmap</A> · {s.phase}
      </p>
      <h1>{s.title}</h1>
      <p className="lead">{s.summary}</p>
      <h3>What to learn</h3>
      <ol className="concepts">
        {s.concepts.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <h3>Try it</h3>
      <CodeBlock code={s.tryIt} />
      <button className="btn primary" onClick={() => openInPlayground(s.tryIt)}>
        <Code2 size={16} /> Open in the editor
      </button>
      {qs.length > 0 && (
        <>
          <h3>Practise</h3>
          <QuestionList list={qs} done={done} />
        </>
      )}
      <EcoLinks refs={s.related} />
      <p className="next">
        {i > 0 && <A to={href({ name: "topic", id: ROADMAP[i - 1].id })}>← {ROADMAP[i - 1].title}</A>}
        {i < ROADMAP.length - 1 && <A to={href({ name: "topic", id: ROADMAP[i + 1].id })}>{ROADMAP[i + 1].title} →</A>}
      </p>
    </article>
  );
}

// ---------- Questions ----------
const LEVELS: Level[] = ["easy", "medium", "hard"];

function QuestionList({ list, done }: { list: typeof QUESTIONS; done: Record<string, string> }) {
  return (
    <ul className="qlist">
      {list.map((q) => (
        <li key={q.id}>
          <A to={href({ name: "question", id: q.id })} className="qrow">
            {done[q.id] ? <CheckCircle2 size={16} className="ok" /> : <Circle size={16} className="muted" />}
            <span className="grow">{q.title}</span>
            <span className="muted small">{q.kind === "sql" ? "SQL" : "Theory"}</span>
            <span className={`level ${q.level}`}>{q.level}</span>
          </A>
        </li>
      ))}
    </ul>
  );
}

export function Questions({ stage }: { stage?: string }) {
  const done = solved.use();
  const list = stage ? QUESTIONS.filter((q) => q.stage === stage) : QUESTIONS;
  const s = stage ? stageById(stage) : undefined;
  return (
    <div>
      <h1>Interview questions{s ? `: ${s.title}` : ""}</h1>
      <p className="lead">
        SQL questions run on the built-in shop dataset and are checked against the expected result. Theory questions are the ones interviewers ask out loud.
        {s && (
          <>
            {" "}
            <A to="/?page=questions">Show all</A>
          </>
        )}
      </p>
      {LEVELS.map((lvl) => {
        const qs = list.filter((q) => q.level === lvl);
        if (!qs.length) return null;
        return (
          <section key={lvl}>
            <h2 className="cap">
              {lvl} <span className="muted small">{qs.filter((q) => done[q.id]).length}/{qs.length}</span>
            </h2>
            <QuestionList list={qs} done={done} />
          </section>
        );
      })}
    </div>
  );
}

// ---------- Databases ----------
export function Databases() {
  return (
    <div>
      <h1>Database guide</h1>
      <p className="lead">Every database is a set of trade-offs. Start with Postgres; reach for the others when an access pattern demands it.</p>
      <div className="db-grid">
        {DATABASES.map((d) => (
          <A key={d.id} to={href({ name: "topic", id: d.id })} className="card">
            <span className="tag">{d.family}</span>
            <h3>{d.name}</h3>
            <p className="muted small">{d.tagline}</p>
            <p className="small">{d.companies.map((c) => c.name).join(" · ")}</p>
          </A>
        ))}
      </div>
      <h2>Quick picker</h2>
      <div className="table-scroll">
        <table className="picker-table">
          <thead>
            <tr>
              <th>You need…</th>
              <th>Reach for</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["A general-purpose app database", "PostgreSQL"],
              ["A cache, sessions, rate limits, leaderboards", "Redis"],
              ["Flexible JSON documents read as a whole", "MongoDB (or Postgres JSONB)"],
              ["Huge write volume, time-ordered, multi-region", "Cassandra / ScyllaDB"],
              ["Serverless key-value with known access patterns", "DynamoDB"],
              ["Deeply connected data, multi-hop queries", "Neo4j"],
              ["Full-text search, typo tolerance, logs", "Elasticsearch / OpenSearch"],
              ["Dashboards over billions of rows", "ClickHouse (server) or DuckDB (embedded)"],
              ["On-device or embedded storage", "SQLite"],
              ["Semantic search for AI apps", "pgvector or a vector database"],
            ].map(([need, pick]) => (
              <tr key={need}>
                <td>{need}</td>
                <td>{pick}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DatabasePage({ d }: { d: DatabaseGuide }) {
  return (
    <article>
      <p className="crumbs">
        <A to="/?page=databases">Databases</A> · {d.family}
      </p>
      <h1>{d.name}</h1>
      <p className="lead">{d.tagline}</p>
      <p>{d.model}</p>
      <div className="two-col">
        <section className="panel">
          <h3 className="ok">Use it when</h3>
          <ul>
            {d.useWhen.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h3 className="bad">Avoid it when</h3>
          <ul>
            {d.avoidWhen.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>
      <h3>Who uses it</h3>
      <ul className="companies">
        {d.companies.map((c) => (
          <li key={c.name}>
            <strong>{c.name}</strong> <span className="muted">{c.use}</span>
          </li>
        ))}
      </ul>
      <h3>What it looks like</h3>
      <CodeBlock code={d.example} language={d.language} />
      {d.practice && (
        <button className="btn" onClick={() => openInPlayground(d.example, d.practice)}>
          <Code2 size={16} /> Try it in the editor
        </button>
      )}
      <h3>Roadmap</h3>
      <div className="three-col">
        {(["basic", "intermediate", "advanced"] as const).map((lvl) => (
          <section key={lvl} className="panel">
            <h4 className="cap">{lvl}</h4>
            <ul>
              {d.roadmap[lvl].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <h3>Interview questions</h3>
      <ul>
        {d.interview.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h3>Open-source repos</h3>
      <RepoList repos={d.repos} />
      <EcoLinks refs={d.related} />
    </article>
  );
}

export function RepoList({ repos }: { repos: { repo: string; why: string }[] }) {
  return (
    <ul className="repos">
      {repos.map((r) => (
        <li key={r.repo}>
          <a href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer">
            {r.repo}
          </a>{" "}
          <span className="muted">{r.why}</span>
        </li>
      ))}
    </ul>
  );
}

export function TopicPage({ id }: { id: string }) {
  const s = stageById(id);
  if (s) return <StagePage s={s} />;
  const d = databaseById(id);
  if (d) return <DatabasePage d={d} />;
  return (
    <p>
      No topic called “{id}”. <A to="/?page=roadmap">See the roadmap</A>
    </p>
  );
}
