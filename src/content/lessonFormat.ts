/**
 * The small part of Markdown the lessons (src/content/lessons/<stage>.md) are written in,
 * turned into blocks. Kept free of React so the tests can read the lessons too.
 *
 *   ## Section               a section, listed in "In this lesson"
 *   ### Sub-heading
 *   > 💡 text                a callout (any emoji first); "> text" without one is a quote
 *   - item / 1. item         lists; indent two spaces to nest one level
 *   | a | b |                a table (the first row is the header)
 *   ```sql                   an example you can run on the shop data
 *   ```sql norun             SQL shown only (it changes things for good, or needs other tables)
 *   ```sql error             an example that fails on purpose; Run shows the error
 *   ```steps join-left      a step-through player (content/steps.ts), with an empty body
 *   ```erd a,b               DBML drawn as an ER diagram (tables a and b highlighted)
 *   ```text, ```json …       plain code
 *   **bold**, *italic*, `code`, [text](/questions/x)
 */

export type Block =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; ordered: boolean; items: { text: string; children: string[] }[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "callout"; emoji: string; lines: string[] }
  | { type: "code"; lang: string; code: string; run: "yes" | "no" | "error" }
  | { type: "steps"; id: string }
  | { type: "erd"; dbml: string; highlight: string[] };

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

export function parseLesson(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    const fence = t.match(/^```(\w*)\s*([\w-]*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i]);
      const lang = fence[1] || "text";
      const flag = fence[2];
      if (lang === "steps") {
        blocks.push({ type: "steps", id: flag });
        continue;
      }
      if (lang === "erd") {
        // ```erd orders,customers  draws the DBML below as an ER diagram, those tables highlighted.
        const highlight = t.replace(/^```erd\s*/, "").split(",").map((x) => x.trim()).filter(Boolean);
        blocks.push({ type: "erd", dbml: body.join("\n"), highlight });
        continue;
      }
      blocks.push({ type: "code", lang, code: body.join("\n"), run: lang !== "sql" || flag === "norun" ? "no" : flag === "error" ? "error" : "yes" });
      continue;
    }
    if (!t) {
      flush();
      continue;
    }
    if (t.startsWith("## ")) {
      flush();
      const text = t.slice(3).trim();
      blocks.push({ type: "h2", id: slug(text), text });
      continue;
    }
    if (t.startsWith("### ")) {
      flush();
      blocks.push({ type: "h3", text: t.slice(4).trim() });
      continue;
    }
    if (t.startsWith(">")) {
      flush();
      const quote: string[] = [];
      for (; i < lines.length && lines[i].trim().startsWith(">"); i++) quote.push(lines[i].trim().replace(/^>\s?/, ""));
      i--;
      const m = quote[0]?.match(EMOJI);
      const emoji = m ? m[1] : "";
      if (m) quote[0] = quote[0].slice(m[0].length);
      // Lines in a callout join into paragraphs; an empty "> " line starts a new one.
      const paras = quote.join("\n").split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
      blocks.push({ type: "callout", emoji, lines: paras });
      continue;
    }
    if (t.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        if (/^\|?\s*:?-{2,}/.test(lines[i].trim())) continue; // the |---|---| line
        rows.push(cells(lines[i]));
      }
      i--;
      blocks.push({ type: "table", head: rows[0] ?? [], rows: rows.slice(1) });
      continue;
    }
    const item = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (item && item[1].length === 0) {
      flush();
      const ordered = /\d/.test(item[2]);
      const items: { text: string; children: string[] }[] = [];
      for (; i < lines.length; i++) {
        const l = lines[i];
        const top = l.match(/^([-*]|\d+\.)\s+(.*)$/);
        const nested = l.match(/^\s{2,}([-*]|\d+\.)\s+(.*)$/);
        if (top && /\d/.test(top[1]) === ordered) items.push({ text: top[2], children: [] });
        else if (nested && items.length) items.at(-1)!.children.push(nested[2]);
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) {
          const last = items.at(-1)!;
          if (last.children.length) last.children[last.children.length - 1] += " " + l.trim();
          else last.text += " " + l.trim();
        } else break;
      }
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    para.push(t);
  }
  flush();
  return blocks;
}

/** The lesson's sections, for "In this lesson". */
export const sections = (blocks: Block[]) => blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");

/** Every step-through, for the tests. */
export const walkthroughs = (blocks: Block[]) => blocks.filter((b): b is Extract<Block, { type: "steps" }> => b.type === "steps");

/** Every example, for the tests. */
export const examples = (blocks: Block[]) => blocks.filter((b): b is Extract<Block, { type: "code" }> => b.type === "code" && b.lang === "sql");
