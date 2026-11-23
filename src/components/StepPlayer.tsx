"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { walkthroughById, type Cell, type StepTable } from "../content/steps";

// Numbers as Postgres prints them (250000, not 2,50,000), so they match the SQL and the text.
const show = (v: Cell) => (v === null ? "NULL" : String(v));

/** The query, with the part this step is about lit up. */
function Query({ sql, clause }: { sql: string; clause?: string }) {
  const at = clause ? sql.indexOf(clause) : -1;
  if (at < 0) return <pre className="code steps-sql">{sql}</pre>;
  return (
    <pre className="code steps-sql">
      {sql.slice(0, at)}
      <mark>{clause}</mark>
      {sql.slice(at + clause!.length)}
    </pre>
  );
}

function Table({ t }: { t: StepTable }) {
  return (
    <div className="steps-table">
      <p className="steps-table-title">{t.title}</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {t.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.length === 0 && (
              <tr>
                <td colSpan={t.columns.length} className="muted">
                  (no rows yet)
                </td>
              </tr>
            )}
            {t.rows.map((r, i) => (
              <Fragment key={i}>
                <tr className={`st-${r.state ?? "idle"}${r.group ? ` g${((r.group - 1) % 5) + 1}` : ""}`}>
                  {r.cells.map((c, j) => (
                    <td key={j} className={c === null ? "null" : undefined}>
                      {show(c)}
                    </td>
                  ))}
                </tr>
                {r.note && (
                  <tr className={`st-note st-${r.state ?? "idle"}`}>
                    <td colSpan={t.columns.length}>{r.note}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A query, played one step at a time: Next and Back, or Play to run through on its own.
 * Arrow keys work while the player has focus.
 */
export function StepPlayer({ id }: { id: string }) {
  const w = walkthroughById(id);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const n = w?.frames.length ?? 0;

  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((x) => Math.min(x + 1, n - 1)), 2600);
    return () => clearTimeout(t);
  }, [playing, i, n]);

  if (!w) return null;
  const f = w.frames[i];
  const go = (to: number) => {
    setPlaying(false);
    setI(Math.max(0, Math.min(n - 1, to)));
  };
  return (
    <section
      className="steps"
      ref={box}
      tabIndex={0}
      aria-label={`Step-through: ${w.title}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        else if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      <div className="steps-head">
        <p className="note-label">Step through: {w.title}</p>
        <span className="muted small">
          {i + 1} / {n}
        </span>
      </div>
      <div className="steps-progress" aria-hidden>
        {w.frames.map((_, k) => (
          <button key={k} className={k === i ? "on" : k < i ? "done" : undefined} onClick={() => go(k)} tabIndex={-1} aria-label={`Step ${k + 1}`} />
        ))}
      </div>
      <Query sql={w.sql} clause={f.clause} />
      <p className="steps-caption" aria-live="polite">
        {f.caption}
      </p>
      <div className="steps-tables">
        {f.tables.map((t, k) => (
          <Table key={`${i}-${k}`} t={t} />
        ))}
      </div>
      <div className="steps-bar">
        <button className="btn small" onClick={() => go(i - 1)} disabled={i === 0}>
          <ChevronLeft size={15} aria-hidden /> Back
        </button>
        {i < n - 1 ? (
          <button className="btn small primary" onClick={() => go(i + 1)}>
            Next <ChevronRight size={15} aria-hidden />
          </button>
        ) : (
          <button className="btn small primary" onClick={() => go(0)}>
            <RotateCcw size={14} aria-hidden /> Replay
          </button>
        )}
        <button
          className="btn small ghost"
          onClick={() => {
            if (i >= n - 1) setI(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {playing ? "Pause" : "Play"}
        </button>
      </div>
    </section>
  );
}
