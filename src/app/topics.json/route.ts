import { TOPICS } from "../../content/topics";

/**
 * /topics.json: Schemata's topic ids, for DSA Atlas and Structura to link to
 * (https://schemata-web.netlify.app/topics/<id>). netlify.toml adds the CORS header.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(TOPICS);
}
