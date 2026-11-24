"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Check, Eye } from "lucide-react";
import { questionById, QUESTIONS, type TheoryQuestion } from "../content/questions";
import { stageById } from "../content/roadmap";
import { EcoLinks } from "../components/AppSwitcher";
import { Rich } from "../components/Lesson";
import { CopyLink } from "../components/CopyLink";
import { ReadAloud } from "../components/ReadAloud";
import { answers, markSolved, saveAnswer, solved } from "../store";
import { routes } from "../routes";

// The solvers need Postgres (WebAssembly) and Monaco, which only run in the browser.
const Loading = () => <div className="solve-loading muted">Starting Postgres and the editor…</div>;
const SqlSolve = dynamic(() => import("./SqlSolve").then((m) => m.SqlSolve), { ssr: false, loading: Loading });
const DesignSolve = dynamic(() => import("./DesignSolve").then((m) => m.DesignSolve), { ssr: false, loading: Loading });

export function QuestionPage({ id }: { id: string }) {
  const q = questionById(id);
  const done = !!solved.use()[id];
  if (!q) return <p>That question doesn&apos;t exist. <Link href={routes.questions()}>All questions</Link></p>;
  const i = QUESTIONS.indexOf(q);
  const next = QUESTIONS[i + 1];
  const stage = stageById(q.stage);
  return (
    <article className="question">
      <p className="crumbs">
        <Link href={routes.questions()}>Practice</Link> ·{" "}
        {stage && <Link href={routes.topic(stage.id)}>{stage.title}</Link>}
      </p>
      <h1>
        {q.title} <span className={`level ${q.level}`}>{q.level}</span>
        {done && <span className="stamp" title="You've solved this one">Solved</span>}
      </h1>
      <div className="tags">
        <span className={`kind kind-${q.kind}`}>{q.kind === "sql" ? "SQL" : q.kind === "design" ? "Design" : "Theory"}</span>
        {q.tags.map((t) => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
      <div className="page-actions">
        {q.kind === "theory" && <ReadAloud />}
        <CopyLink />
      </div>
      <div className="prompt"><Rich md={q.prompt} /></div>
      {q.kind === "sql" ? <SqlSolve key={q.id} q={q} /> : q.kind === "design" ? <DesignSolve key={q.id} q={q} /> : <TheoryReveal key={q.id} q={q} />}
      <EcoLinks refs={q.related} />
      {next && (
        <p className="next">
          Next: <Link href={routes.question(next.id)}>{next.title}</Link>
        </p>
      )}
    </article>
  );
}

function TheoryReveal({ q }: { q: TheoryQuestion }) {
  const saved = answers.use()[q.id] ?? "";
  const [text, setText] = useState(saved);
  const [shown, setShown] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const typed = useRef(false);
  // The saved answer arrives after the first render (storage, or your account): show it until you type.
  useEffect(() => {
    if (!typed.current) setText(saved);
  }, [saved]);
  // Save a moment after you stop typing, so every key doesn't trigger a sync.
  useEffect(() => {
    if (!typed.current || text === saved) return;
    const t = setTimeout(() => {
      saveAnswer(q.id, text);
      setSavedAt(Date.now());
    }, 600);
    return () => clearTimeout(t);
  }, [text, saved, q.id]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <>
      <label className="theory-answer">
        <span className="theory-answer-label">Your answer</span>
        <textarea
          value={text}
          onChange={(e) => {
            typed.current = true;
            setText(e.target.value);
          }}
          rows={8}
          placeholder="Answer it the way you would in an interview: say what each thing is, give an example, and when you'd use it. It's saved as you type."
        />
        <span className="muted small">
          {words} {words === 1 ? "word" : "words"}
          {savedAt ? (
            <>
              {" · "}
              <Check size={12} aria-hidden /> saved
            </>
          ) : saved ? " · saved" : ""}
        </span>
      </label>
      {shown ? (
        <div className="reveal">
          {text.trim() && (
            <details className="your-answer" open>
              <summary>Your answer</summary>
              <p className="your-answer-text">{text}</p>
            </details>
          )}
          <h3>Model answer</h3>
          <p className="muted small">Compare: did you define each term, give an example, and say when to use it?</p>
          <Rich md={q.answer} />
        </div>
      ) : (
        <button
          className="btn primary"
          onClick={() => {
            if (text !== saved) saveAnswer(q.id, text);
            setShown(true);
            markSolved(q.id);
          }}
        >
          <Eye size={16} /> {text.trim() ? "Compare with the model answer" : "Show the answer"}
        </button>
      )}
    </>
  );
}
