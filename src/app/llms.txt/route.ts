import { llmsTxt } from "../../content/llms";

/** /llms.txt: what Schemata is, for AI assistants (src/content/llms.ts). */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
