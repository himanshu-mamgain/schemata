"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ClipboardCheck, Eye, RotateCcw, Share2, XCircle } from "lucide-react";
import type { DesignQuestion } from "../content/questions";
import { ErdWorkbench, useDbml } from "../erd/ErdWorkbench";
import { ErdDiagram } from "../erd/ErdDiagram";
import { parseDbml } from "../erd/model";
import { shareHash } from "../erd/share";
import { CodeBlock } from "../components/CodeBlock";
import { designs, markSolved, saveDesign } from "../store";
import { routes } from "../routes";

type Result = { label: string; hint: string; ok: boolean };

export function DesignSolve({ q }: { q: DesignQuestion }) {
  const [dbml, setDbml] = useState(() => designs.get()[q.id] ?? q.starter);
  const [results, setResults] = useState<Result[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const { model, errors } = useDbml(dbml);

  const change = (v: string) => {
    setDbml(v);
    saveDesign(q.id, v);
    setResults(null);
  };

  const checkIt = () => {
    // Check the text as it is now, not the debounced diagram.
    const parsed = parseDbml(dbml);
    if (!parsed.model) {
      setResults([{ label: "The DBML parses", hint: `Fix line ${parsed.errors[0]?.line}: ${parsed.errors[0]?.message}`, ok: false }]);
      return;
    }
    const r = q.checks.map((c) => ({ label: c.label, hint: c.hint, ok: c.test(parsed.model!) }));
    setResults(r);
    if (r.every((x) => x.ok)) markSolved(q.id);
  };

  const passed = results?.filter((r) => r.ok).length ?? 0;
  const allOk = !!results && passed === results.length;

  return (
    <>
      <section className="requirements">
        <span className="note-label">Requirements</span>
        <ul>
          {q.requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <div className="toolbar">
        <button className="btn primary" onClick={checkIt}>
          <ClipboardCheck size={16} /> Check my design
        </button>
        <button className="btn ghost" onClick={() => setReveal((v) => !v)}>
          <Eye size={16} /> {reveal ? "Hide model answer" : "Model answer"}
        </button>
        <Link className="btn ghost" href={routes.erd + shareHash(dbml)} title="Open your design in the diagram editor, with a link you can share">
          <Share2 size={16} /> Open in diagram editor
        </Link>
        <button
          className="btn ghost"
          onClick={() => confirm("Start again from the starter DBML? Your design for this question will be replaced.") && change(q.starter)}
        >
          <RotateCcw size={16} /> Start again
        </button>
        <span className="muted small grow-right">
          {model ? `${model.tables.length} table${model.tables.length === 1 ? "" : "s"}, ${model.refs.length} relationship${model.refs.length === 1 ? "" : "s"}` : ""}
          {errors.length > 0 ? ` · ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <ErdWorkbench value={dbml} onChange={change} height={460} />

      {results && (
        <section className={`checks ${allOk ? "is-ok" : ""}`} aria-live="polite">
          <h3>
            {allOk ? <CheckCircle2 size={18} className="ok" aria-hidden /> : <ClipboardCheck size={18} aria-hidden />} {passed} of {results.length} checks pass
            {allOk && <span className="stamp">Solved</span>}
          </h3>
          <ul>
            {results.map((r) => (
              <li key={r.label} className={r.ok ? "ok-row" : "bad-row"}>
                {r.ok ? <CheckCircle2 size={16} aria-label="Passes" /> : <XCircle size={16} aria-label="Fails" />}
                <span>
                  {r.label}
                  {!r.ok && <span className="check-hint">{r.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
          {!allOk && (
            <p className="small muted">
              <Circle size={10} aria-hidden /> The checks look at tables, keys and relationships, not exact names: there&apos;s more than one good design.
            </p>
          )}
        </section>
      )}

      {reveal && <ModelAnswer q={q} />}
    </>
  );
}

function ModelAnswer({ q }: { q: DesignQuestion }) {
  const [model] = useState(() => parseDbml(q.solution).model);
  return (
    <div className="reveal">
      <h3>Model answer</h3>
      <p>{q.explanation}</p>
      <ErdDiagram model={model} height={420} />
      <details>
        <summary>Its DBML</summary>
        <CodeBlock code={q.solution} language="dbml" />
      </details>
    </div>
  );
}
