"use client";
import { useState } from "react";
import { CheckCircle2, Eye, Lightbulb, Network, Play, XCircle } from "lucide-react";
import type { SqlQuestion } from "../content/questions";
import { SqlEditor } from "../editor/SqlEditor";
import { CodeBlock } from "../components/CodeBlock";
import { ResultsPanel } from "../components/Results";
import { SchemaBrowser } from "../components/SchemaBrowser";
import { Markdown } from "../components/Markdown";
import { SchemaDiagram } from "../erd/SchemaDiagram";
import { tablesInSql } from "../erd/model";
import { runAndRollback, type QueryResult } from "../db/engine";
import { compare, type Verdict } from "../db/check";
import { answers, markSolved, saveAnswer } from "../store";

export function SqlSolve({ q }: { q: SqlQuestion }) {
  const [sql, setSql] = useState(() => answers.get()[q.id] ?? "-- Write your query on the shop dataset, then Check.\n");
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hint, setHint] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diagram, setDiagram] = useState(false);

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
            <button className={diagram ? "btn ghost is-on" : "btn ghost"} onClick={() => setDiagram((d) => !d)} aria-pressed={diagram} title="The shop's tables and how they connect">
              <Network size={16} /> Diagram
            </button>
            <button className="btn ghost" onClick={() => setReveal((r) => !r)}>
              <Eye size={16} /> {reveal ? "Hide solution" : "Solution"}
            </button>
            <span className="muted small grow-right">Runs in a transaction that's rolled back: the data never changes.</span>
          </div>
          {diagram && (
            <div className="diagram-panel">
              {hint && <p className="small muted">The tables this question needs are highlighted.</p>}
              <SchemaDiagram schema="shop" highlight={hint ? tablesInSql(q.solution) : undefined} height={440} />
            </div>
          )}
          <SqlEditor value={sql} onChange={change} onRun={runIt} height={220} />
          {hint && (
            <div className="hint">
              <span className="note-label">
                <Lightbulb size={14} aria-hidden /> Hint
              </span>
              <Markdown text={q.hint} />
            </div>
          )}
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

