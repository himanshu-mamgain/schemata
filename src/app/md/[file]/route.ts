import { ROADMAP } from "../../../content/roadmap";
import { stageMarkdown } from "../../../content/llms";

/** /md/<stage>.md: a lesson and its interview questions as Markdown, for AI assistants. */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ROADMAP.map((s) => ({ file: `${s.id}.md` }));
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const stage = ROADMAP.find((s) => `${s.id}.md` === file);
  if (!stage) return new Response("Not found", { status: 404 });
  return new Response(stageMarkdown(stage), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
