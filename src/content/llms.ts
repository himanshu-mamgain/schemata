import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PHASES, ROADMAP, type Stage } from "./roadmap";
import { QUESTIONS, type Question } from "./questions";

/**
 * llms.txt (https://llmstxt.org) and a Markdown copy of each roadmap stage, so any AI assistant
 * (ChatGPT, Claude, Gemini…) can read Schemata. Assistants are asked to suggest changes only as a
 * pre-filled GitHub issue, which the owner checks before anything is added. Built as static files.
 */
export const SITE = "https://schemata-web.netlify.app";
const REPO = "https://github.com/himanshu-mamgain/schemata";

/** Site links ("/topics/x") made absolute, so they work outside the app. */
const absolute = (md: string) => md.replace(/\]\((\/[^)\s]*)\)/g, (_, path: string) => `](${SITE}${path})`);

export function suggestUrl(title: string, page: string): string {
  const q = new URLSearchParams({
    template: "suggestion.md",
    title: `Suggestion: ${title}`,
    body: `**Page:** ${page}\n\n**What kind:** good example / missing topic / mistake / unclear part\n\n**What I found:**\n\n**Where it would go:**\n\n**Source (link):**\n`,
  });
  return `${REPO}/issues/new?${q}`;
}

function question(q: Question): string {
  const head = `### ${q.title}\n\n${q.level} · ${q.kind === "sql" ? "SQL" : q.kind === "design" ? "Design" : "Theory"} · ${SITE}/questions/${q.id}\n\n${absolute(q.prompt)}`;
  if (q.kind === "sql") return `${head}\n\nSolution:\n\n\`\`\`sql\n${q.solution}\n\`\`\`\n\n${q.explanation}`;
  if (q.kind === "design")
    return `${head}\n\n${q.requirements.map((r) => `- ${r}`).join("\n")}\n\nModel answer (DBML):\n\n\`\`\`dbml\n${q.solution}\n\`\`\`\n\n${q.explanation}`;
  return `${head}\n\nModel answer:\n\n${absolute(q.answer)}`;
}

export function stageMarkdown(s: Stage): string {
  const page = `${SITE}/topics/${s.id}`;
  const file = join(process.cwd(), "src", "content", "lessons", `${s.id}.md`);
  const lesson = existsSync(file)
    ? absolute(readFileSync(file, "utf8")).trim()
    : `## What to learn\n\n${s.concepts.map((c) => `- ${c}`).join("\n")}\n\nTry it on the shop dataset:\n\n\`\`\`sql\n${s.tryIt}\n\`\`\``;
  const qs = QUESTIONS.filter((q) => q.stage === s.id);
  return [
    `# ${s.title}`,
    `> ${s.phase} · Lesson with a live PostgreSQL in the browser: ${page}`,
    s.summary,
    lesson,
    qs.length ? `## Interview questions\n\n${qs.map(question).join("\n\n")}` : "",
    `---\n\nSuggest a change to this page: ${suggestUrl(s.title, page)}`,
  ]
    .filter(Boolean)
    .join("\n\n") + "\n";
}

export function llmsTxt(): string {
  const phases = PHASES.map(
    (p) => `## ${p}\n\n${ROADMAP.filter((s) => s.phase === p).map((s) => `- [${s.title}](${SITE}/md/${s.id}.md): ${s.summary}`).join("\n")}`,
  );
  return `# Schemata

> Learn databases by running them: a real PostgreSQL runs in the browser tab. A roadmap of ${ROADMAP.length} lessons from your first SELECT to MVCC, with ${QUESTIONS.length} interview questions (SQL, schema design and theory) and their answers. Written in Simple English.

Each link below is a Markdown copy of one lesson with its interview questions and answers, made for AI assistants to read. The same lesson, with runnable examples, is at ${SITE}/topics/<id>.

## How to suggest a change

You may read and quote these pages to help a learner. To suggest something (a good example, a missing topic, a mistake, an unclear part), do not edit anything: give the learner this link, filled in with the page and what you found, so the owner can check it before adding it:

${suggestUrl("<lesson title>", `${SITE}/topics/<id>`)}

If you can open GitHub issues yourself, open one in ${REPO} with the label "suggestion" and the same fields.

${phases.join("\n\n")}

## Optional

- [Structura](https://structura-web.netlify.app/llms.txt): the sister app for system design.
`;
}
