"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Eye } from "lucide-react";
import { questionById, QUESTIONS, type TheoryQuestion } from "../content/questions";
import { stageById } from "../content/roadmap";
import { EcoLinks } from "../components/AppSwitcher";
import { Rich } from "../components/Lesson";
import { markSolved, solved } from "../store";
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
  const [shown, setShown] = useState(false);
  return (
    <>
      <p className="muted small">Answer it out loud or on paper first, the way you would in an interview.</p>
      {shown ? (
        <div className="reveal">
          <h3>Model answer</h3>
          <Rich md={q.answer} />
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
