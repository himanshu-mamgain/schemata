"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Play } from "lucide-react";
import { parseLesson, sections, type Block } from "../content/lessonFormat";
import { CodeBlock } from "./CodeBlock";
import { StepPlayer } from "./StepPlayer";
import type { QueryResult } from "../db/engine";
import { ResultsPanel } from "./Results";
import { draft } from "../store";
import { routes } from "../routes";

/** **bold**, *italic*, `code` and [links](/questions/x): enough for the lessons. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length > 1) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}><Inline text={p.slice(2, -2)} /></strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          const [, label, href] = link;
          return href.startsWith("/") || href.startsWith("#") ? (
            <Link key={i} href={href}><Inline text={label} /></Link>
          ) : (
            <a key={i} href={href} target="_blank" rel="noreferrer"><Inline text={label} /></a>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** An example on the shop data: run it right here (in a transaction that's rolled back), or open it in the editor. */
function SqlExample({ code, fails }: { code: string; fails: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; results?: QueryResult[] | null; error?: string | null }>({});
  const run = async () => {
    setState({ busy: true });
    try {
      const { runAndRollback } = await import("../db/engine");
      setState({ results: await runAndRollback(code, "shop"), error: null });
    } catch (e) {
      setState({ results: null, error: e instanceof Error ? e.message : String(e) });
    }
  };
  const open = () => {
    draft.set({ dataset: "shop", sql: code });
    router.push(routes.playground("shop"));
  };
  return (
    <div className="example">
      <CodeBlock code={code} />
      <div className="example-bar">
        <button className="btn small primary" onClick={run} disabled={state.busy}>
          <Play size={14} aria-hidden /> {state.busy ? "Running…" : "Run"}
        </button>
        <button className="btn small ghost" onClick={open}>
          <Code2 size={14} aria-hidden /> Open in the editor
        </button>
        {fails && <span className="muted small">This one fails on purpose: run it to read the error.</span>}
      </div>
      {(state.results || state.error) && <ResultsPanel results={state.results ?? null} error={state.error ?? null} />}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "h2":
      return <h2 id={b.id}><Inline text={b.text} /></h2>;
    case "h3":
      return <h3><Inline text={b.text} /></h3>;
    case "p":
      return <p><Inline text={b.text} /></p>;
    case "list": {
      const L = b.ordered ? "ol" : "ul";
      return (
        <L>
          {b.items.map((it, i) => (
            <li key={i}>
              <Inline text={it.text} />
              {it.children.length > 0 && (
                <ul>
                  {it.children.map((c, j) => (
                    <li key={j}><Inline text={c} /></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </L>
      );
    }
    case "table":
      return (
        <div className="table-scroll lesson-table">
          <table>
            <thead>
              <tr>{b.head.map((h, i) => <th key={i}><Inline text={h} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <aside className={`callout${b.emoji === "⚠️" ? " warn" : ""}`}>
          {b.emoji && <span className="callout-emoji" aria-hidden>{b.emoji}</span>}
          <div>{b.lines.map((l, i) => <p key={i}><Inline text={l} /></p>)}</div>
        </aside>
      );
    case "steps":
      return <StepPlayer id={b.id} />;
    case "code":
      return b.run === "no" ? <CodeBlock code={b.code} language={b.lang === "sql" ? "pgsql" : b.lang} /> : <SqlExample code={b.code} fails={b.run === "error"} />;
  }
}

/** A roadmap stage's lesson: "In this lesson", then the sections. */
export function Lesson({ md }: { md: string }) {
  const blocks = useMemo(() => parseLesson(md), [md]);
  const toc = sections(blocks);
  // What comes before the first section (the "in one line" callout) goes above the list of sections.
  const first = blocks.findIndex((b) => b.type === "h2");
  const intro = first < 0 ? blocks : blocks.slice(0, first);
  const rest = first < 0 ? [] : blocks.slice(first);
  return (
    <div className="lesson">
      {intro.map((b, i) => <BlockView key={`i${i}`} b={b} />)}
      {toc.length > 2 && (
        <nav className="lesson-toc" aria-label="In this lesson">
          <p className="note-label">In this lesson</p>
          <ol>
            {toc.map((s) => (
              <li key={s.id}><a href={`#${s.id}`}><Inline text={s.text} /></a></li>
            ))}
          </ol>
        </nav>
      )}
      {rest.map((b, i) => <BlockView key={i} b={b} />)}
    </div>
  );
}

/** A model answer or explanation written in the lesson format (lists, tables, examples). */
export function Rich({ md }: { md: string }) {
  const blocks = useMemo(() => parseLesson(md), [md]);
  return <div className="lesson rich">{blocks.map((b, i) => <BlockView key={i} b={b} />)}</div>;
}
