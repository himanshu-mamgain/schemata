import { ROADMAP } from "../../content/roadmap";
import { QUESTIONS } from "../../content/questions";

/**
 * /plan.json: the roadmap's lessons and every interview question, in order, for the Studia
 * site's daily plan (a lesson, then its questions). Titles only: no answers, nobody's progress.
 * netlify.toml adds the CORS header.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    lessons: ROADMAP.map((s) => ({ id: s.id, title: s.title, phase: s.phase })),
    questions: QUESTIONS.map((q) => ({ id: q.id, title: q.title, stage: q.stage, level: q.level, kind: q.kind })),
  });
}
