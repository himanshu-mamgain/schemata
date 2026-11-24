"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Code2, Database, FolderGit2, Map as MapIcon, MessageSquareCode, Network, PenTool } from "lucide-react";
import { PHASES, ROADMAP, stageById, type Stage } from "../content/roadmap";
import { QUESTIONS, type Level } from "../content/questions";
import { DATABASES, databaseById, type DatabaseGuide } from "../content/databases";
import { CodeBlock } from "../components/CodeBlock";
import { CopyLink } from "../components/CopyLink";
import { ReadAloud } from "../components/ReadAloud";
import { Lesson } from "../components/Lesson";
import { EcoLinks } from "../components/AppSwitcher";
import { draft, solved } from "../store";
import { routes } from "../routes";

/** Opens a query in the SQL editor (the editor reads it from the saved draft). */
function useOpenInPlayground() {
  const router = useRouter();
  return (sql: string, dataset = "shop") => {
    draft.set({ dataset, sql });
    router.push(routes.playground(dataset));
  };
}

const A = ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
  <Link href={to} className={className}>
    {children}
  </Link>
);

/** Roadmap · Databases · Data sources: the three pages of the Learn tab. */
export function LearnSwitch() {
  const path = usePathname();
  const items: [string, string, typeof MapIcon][] = [
    [routes.roadmap, "Roadmap", MapIcon],
    [routes.databases, "Databases", Database],
    [routes.sources, "Data sources", FolderGit2],
  ];
  return (
    <nav className="seg learn-switch" aria-label="Learn">
      {items.map(([to, label, Icon]) => (
        <Link key={to} href={to} aria-current={path === to ? "page" : undefined}>
          <Icon size={15} aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );
}

// ---------- Home ----------
export function Home() {
  const done = solved.use();
  const count = QUESTIONS.filter((q) => done[q.id]).length;
  // The next question in roadmap order that you haven't done yet.
  const order = new Map(ROADMAP.map((s, i) => [s.id, i]));
  const next = [...QUESTIONS].sort((a, b) => (order.get(a.stage) ?? 99) - (order.get(b.stage) ?? 99)).find((q) => !done[q.id]);
  const nextStage = next ? stageById(next.stage) : undefined;
  const designs = QUESTIONS.filter((q) => q.kind === "design");

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">Your database notebook</p>
        <h1>
          Learn databases <span className="hl">by running them</span>
        </h1>
        <p className="lead">
          A real PostgreSQL runs in this tab. Follow the roadmap from your first SELECT to MVCC, draw schemas as diagrams, and practise the interview
          questions that keep coming up.
        </p>
        <div className="row">
          <A to={next ? routes.question(next.id) : routes.questions()} className="btn primary">
            <MessageSquareCode size={16} /> {count === 0 ? "Start practising" : "Continue practising"}
          </A>
          <A to={routes.roadmap} className="btn">
            <MapIcon size={16} /> The roadmap
          </A>
          <CopyLink />
        </div>
      </section>

      {next && (
        <A to={routes.question(next.id)} className="card up-next">
          <span className="note-label">Up next</span>
          <strong>{next.title}</strong>
          <span className="muted small">
            {nextStage?.title} · <span className={`level ${next.level}`}>{next.level}</span>
          </span>
        </A>
      )}

      <section className="phase-progress" aria-label="Progress by phase">
        {PHASES.map((phase) => {
          const qs = QUESTIONS.filter((q) => stageById(q.stage)?.phase === phase);
          const n = qs.filter((q) => done[q.id]).length;
          return (
            <div key={phase} className="phase-meter">
              <span className="small">{phase}</span>
              <span className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={n} aria-label={`${phase}: ${n} of ${qs.length}`}>
                <span style={{ width: qs.length ? `${(n / qs.length) * 100}%` : 0 }} />
              </span>
              <span className="small muted">
                {n}/{qs.length}
              </span>
            </div>
          );
        })}
      </section>

      <section className="cards4">
        <A to={routes.playground()} className="card">
          <Code2 size={20} />
          <h3>SQL editor</h3>
          <p className="muted">Real Postgres with three datasets, query plans and saved queries.</p>
        </A>
        <A to={routes.questions()} className="card">
          <MessageSquareCode size={20} />
          <h3>Practice</h3>
          <p className="muted">
            {QUESTIONS.length} questions, checked automatically. You&apos;ve done {count}.
          </p>
        </A>
        <A to={routes.erd} className="card">
          <Network size={20} />
          <h3>Schema diagrams</h3>
          <p className="muted">Write DBML and see the ER diagram, or draw any dataset.</p>
        </A>
        <A to={designs[0] ? routes.question(designs[0].id) : routes.questions()} className="card">
          <PenTool size={20} />
          <h3>Design problems</h3>
          <p className="muted">{designs.length} schemas to design, from blog tags to cinema seats, checked as you go.</p>
        </A>
        <A to={routes.databases} className="card">
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
      <LearnSwitch />
      <h1>Roadmap</h1>
      <CopyLink className="btn page-copy" />
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
                  <A to={routes.topic(s.id)} className="stage-card">
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

function StagePage({ s, lesson }: { s: Stage; lesson?: string }) {
  const done = solved.use();
  const openIn = useOpenInPlayground();
  const qs = QUESTIONS.filter((q) => q.stage === s.id);
  const i = ROADMAP.indexOf(s);
  return (
    <article>
      <p className="crumbs">
        <A to={routes.roadmap}>Roadmap</A> · {s.phase}
      </p>
      <h1>{s.title}</h1>
      <p className="lead">{s.summary}</p>
      <div className="page-actions">
        <ReadAloud />
        <CopyLink />
      </div>
      {lesson ? (
        <Lesson md={lesson} />
      ) : (
        <>
          <h3>What to learn</h3>
          <ol className="concepts">
            {s.concepts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <h3>Try it</h3>
          <CodeBlock code={s.tryIt} />
          <button className="btn primary" onClick={() => openIn(s.tryIt)}>
            <Code2 size={16} /> Open in the editor
          </button>
        </>
      )}
      {qs.length > 0 && (
        <>
          <h2 id="practise">Practise</h2>
          <QuestionList list={qs} done={done} />
        </>
      )}
      <EcoLinks refs={s.related} />
      <p className="next">
        {i > 0 && <A to={routes.topic(ROADMAP[i - 1].id)}>← {ROADMAP[i - 1].title}</A>}
        {i < ROADMAP.length - 1 && <A to={routes.topic(ROADMAP[i + 1].id)}>{ROADMAP[i + 1].title} →</A>}
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
          <A to={routes.question(q.id)} className="qrow">
            {done[q.id] ? <CheckCircle2 size={16} className="ok" /> : <Circle size={16} className="muted" />}
            <span className="grow">{q.title}</span>
            <span className={`kind kind-${q.kind}`}>{q.kind === "sql" ? "SQL" : q.kind === "design" ? "Design" : "Theory"}</span>
            <span className={`level ${q.level}`}>{q.level}</span>
          </A>
        </li>
      ))}
    </ul>
  );
}

export function Questions() {
  const stage = useSearchParams().get("stage") ?? undefined;
  const done = solved.use();
  const list = stage ? QUESTIONS.filter((q) => q.stage === stage) : QUESTIONS;
  const s = stage ? stageById(stage) : undefined;
  return (
    <div>
      <h1>Interview questions{s ? `: ${s.title}` : ""}</h1>
      <CopyLink className="btn page-copy" />
      <p className="lead">
        SQL questions run on the built-in shop dataset and are checked against the expected result. Design questions are schemas you draw in DBML.
        Theory questions are the ones interviewers ask out loud.
        {s && (
          <>
            {" "}
            <A to={routes.questions()}>Show all</A>
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
      <LearnSwitch />
      <h1>Database guide</h1>
      <CopyLink className="btn page-copy" />
      <p className="lead">Every database is a set of trade-offs. Start with Postgres; reach for the others when an access pattern demands it.</p>
      <div className="db-grid">
        {DATABASES.map((d) => (
          <A key={d.id} to={routes.topic(d.id)} className="card">
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
  const openIn = useOpenInPlayground();
  return (
    <article>
      <p className="crumbs">
        <A to={routes.databases}>Databases</A> · {d.family}
      </p>
      <h1>{d.name}</h1>
      <CopyLink className="btn page-copy" />
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
        <button className="btn" onClick={() => openIn(d.example, d.practice)}>
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

export function TopicPage({ id, lesson }: { id: string; lesson?: string }) {
  const s = stageById(id);
  if (s) return <StagePage s={s} lesson={lesson} />;
  const d = databaseById(id);
  if (d) return <DatabasePage d={d} />;
  return (
    <p>
      No topic called “{id}”. <A to={routes.roadmap}>See the roadmap</A>
    </p>
  );
}
