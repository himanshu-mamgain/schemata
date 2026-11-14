/**
 * Schemata's public topic list, published as /topics.json (with a CORS header) so
 * DSA Atlas and Structura can link here: https://schemata-web.netlify.app/?topic=<id>.
 * Ids are roadmap stage ids and database ids. Keep them stable.
 */
import { ROADMAP } from "./roadmap.ts";
import { DATABASES } from "./databases.ts";

export interface Topic {
  id: string;
  title: string;
  blurb: string;
}

export const TOPICS: Topic[] = [
  ...ROADMAP.map((s) => ({ id: s.id, title: s.title, blurb: s.summary })),
  ...DATABASES.map((d) => ({ id: d.id, title: d.name, blurb: d.tagline })),
];
