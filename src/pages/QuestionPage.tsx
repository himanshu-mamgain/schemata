import { useState } from "react";
import { CheckCircle2, Eye, Lightbulb, Play, XCircle } from "lucide-react";
import { questionById, QUESTIONS, type SqlQuestion, type TheoryQuestion } from "../content/questions";
import { stageById } from "../content/roadmap";
import { SqlEditor, CodeBlock } from "../editor/SqlEditor";
import { ResultsPanel } from "../components/Results";
import { EcoLinks } from "../components/AppSwitcher";
import { SchemaBrowser } from "../components/SchemaBrowser";
import { runAndRollback, type QueryResult } from "../db/engine";
import { compare, type Verdict } from "../db/check";
import { answers, markSolved, saveAnswer, solved } from "../store";
import { href, onLinkClick } from "../router";
import { Markdown } from "../components/Markdown";

export function QuestionPage({ id }: { id: string }) {
  const q = questionById(id);
  if (!q) return <p>That question doesn't exist. <a href="/?page=questions" onClick={onLinkClick}>All questions</a></p>;
  const i = QUESTIONS.indexOf(q);
  const next = QUESTIONS[i + 1];
  const stage = stageById(q.stage);
  return (
    <article className="question">
      <p className="crumbs">
        <a href="/?page=questions" onClick={onLinkClick}>Questions</a> ·{" "}
        {stage && (
          <a href={href({ name: "topic", id: stage.id })} onClick={onLinkClick}>
            {stage.title}
          </a>
        )}
      </p>
      <h1>
        {q.title} <span className={`level ${q.level}`}>{q.level}</span>
      </h1>
      <div className="tags">
        {q.tags.map((t) => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
      {q.kind === "sql" ? <SqlSolve key={q.id} q={q} /> : <TheoryReveal key={q.id} q={q} />}
      <EcoLinks refs={q.related} />
      {next && (
        <p className="next">
          Next: <a href={href({ name: "question", id: next.id })} onClick={onLinkClick}>{next.title}</a>
        </p>
      )}
    </article>
  );
}

function SqlSolve({ q }: { q: SqlQuestion }) {
  const isSolved = !!solved.use()[q.id];
  const [sql, setSql] = useState(() => answers.get()[q.id] ?? "-- Write your query on the shop dataset, then Check.\n");
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hint, setHint] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  const change = (v: string) => {
    setSql(v);
    saveAnswer(q.id, v);
  };

  const runIt = async (text = sql) => {
    setBusy(true);
    setError(null);
    setVerdict(null);
    try {
      setResults(await runAndRollback(text, "shop"));
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      const mine = await runAndRollback(sql, "shop");
      const expected = await runAndRollback(q.solution, "shop");
      setResults(mine);
      const v = compare(mine.filter((r) => r.fields.length > 0).at(-1), expected.at(-1)!, q.ordered);
      setVerdict(v);
      if (v.ok) markSolved(q.id);
    } catch (e) {
      setResults(null);
      setVerdict(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="prompt">{q.prompt}</p>
      {isSolved && (
        <p className="ok small">
          <CheckCircle2 size={14} /> You've solved this one.
        </p>
      )}
      <div className="solve">
        <aside className="panel solve-schema">
          <h4>shop tables</h4>
          <SchemaBrowser schema="shop" version={0} onPick={(s) => runIt(s)} />
        </aside>
        <div className="solve-main">
          <div className="toolbar">
            <button className="btn" onClick={() => runIt()} disabled={busy}>
              <Play size={16} /> Run <kbd>Ctrl ↵</kbd>
            </button>
            <button className="btn primary" onClick={check} disabled={busy}>
              <CheckCircle2 size={16} /> Check
            </button>
            <button className="btn ghost" onClick={() => setHint((h) => !h)}>
              <Lightbulb size={16} /> Hint
            </button>
            <button className="btn ghost" onClick={() => setReveal((r) => !r)}>
              <Eye size={16} /> {reveal ? "Hide solution" : "Solution"}
            </button>
            <span className="muted small grow-right">Runs in a transaction that's rolled back: the data never changes.</span>
          </div>
          <SqlEditor value={sql} onChange={change} onRun={runIt} height={220} />
          {hint && <div className="hint"><Lightbulb size={14} /> <Markdown text={q.hint} /></div>}
          {verdict && (
            <p className={verdict.ok ? "verdict ok" : "verdict bad"}>
              {verdict.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {verdict.message}
            </p>
          )}
          <ResultsPanel results={results} error={error} />
          {reveal && (
            <div className="reveal">
              <h3>Solution</h3>
              <CodeBlock code={q.solution} />
              <p>{q.explanation}</p>
              <button className="btn ghost small" onClick={() => change(q.solution)}>Copy into the editor</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TheoryReveal({ q }: { q: TheoryQuestion }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <p className="prompt">{q.prompt}</p>
      <p className="muted small">Answer it out loud or on paper first, the way you would in an interview.</p>
      {shown ? (
        <div className="reveal">
          <h3>Model answer</h3>
          <Markdown text={q.answer} />
        </div>
      ) : (
        <button
          className="btn primary"
          onClick={() => {
            setShown(true);
            markSolved(q.id);
          }}
        >
          <Eye size={16} /> Show the answer
        </button>
      )}
    </>
  );
}
