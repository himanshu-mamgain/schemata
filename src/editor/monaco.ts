/**
 * Monaco bundled locally (works offline), trimmed to the editor features and the
 * query languages Schemata shows. Only the base editor worker: we need highlighting
 * and our own SQL completions, not language servers.
 */
import * as monaco from "monaco-esm/editor/editor.api.js";
import "./monaco-features";
import type { Column } from "../db/engine";
import type { Theme } from "../theme";

self.MonacoEnvironment = { getWorker: () => new Worker(new URL("./editor.worker.ts", import.meta.url), { type: "module" }) };

/** One editor theme per app theme. */
const EDITOR_THEMES: Record<Theme, { base: "vs" | "vs-dark"; bg: string; line: string; rules: { token: string; foreground: string; fontStyle?: string }[] }> = {
  paper: {
    base: "vs",
    bg: "#fffdf8",
    line: "#f4efe3",
    rules: [
      { token: "keyword", foreground: "2f6f9f", fontStyle: "bold" },
      { token: "string", foreground: "8a5a14" },
      { token: "number", foreground: "2f7a55" },
      { token: "comment", foreground: "8f8a7e", fontStyle: "italic" },
      { token: "predefined", foreground: "8b4c9e" },
    ],
  },
  blueprint: {
    base: "vs-dark",
    bg: "#0c2138",
    line: "#13304f",
    rules: [
      { token: "keyword", foreground: "7cc4f0", fontStyle: "bold" },
      { token: "string", foreground: "f5d491" },
      { token: "number", foreground: "9be0b8" },
      { token: "comment", foreground: "6f8db0", fontStyle: "italic" },
      { token: "predefined", foreground: "d0b4ff" },
    ],
  },
  chalkboard: {
    base: "vs-dark",
    bg: "#1a2521",
    line: "#24332d",
    rules: [
      { token: "keyword", foreground: "f2d879", fontStyle: "bold" },
      { token: "string", foreground: "f3a7b8" },
      { token: "number", foreground: "a6e3c4" },
      { token: "comment", foreground: "8ca196", fontStyle: "italic" },
      { token: "predefined", foreground: "9fd3f5" },
    ],
  },
};
for (const [id, t] of Object.entries(EDITOR_THEMES)) {
  monaco.editor.defineTheme(`schemata-${id}`, {
    base: t.base,
    inherit: true,
    rules: t.rules,
    colors: { "editor.background": t.bg, "editor.lineHighlightBackground": t.line, "editorGutter.background": t.bg },
  });
}
export const editorTheme = (t: Theme) => `schemata-${t}`;

const KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN",
  "CROSS JOIN", "ON", "AS", "DISTINCT", "WITH", "WITH RECURSIVE", "UNION ALL", "UNION", "INTERSECT", "EXCEPT", "CASE", "WHEN",
  "THEN", "ELSE", "END", "AND", "OR", "NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "ILIKE", "IS NULL", "IS NOT NULL", "INSERT INTO",
  "VALUES", "UPDATE", "SET", "DELETE FROM", "RETURNING", "CREATE TABLE", "CREATE INDEX", "DROP TABLE", "ALTER TABLE", "BEGIN",
  "COMMIT", "ROLLBACK", "EXPLAIN", "EXPLAIN ANALYZE", "OVER", "PARTITION BY", "ROWS BETWEEN", "UNBOUNDED PRECEDING", "CURRENT ROW",
];
const FUNCTIONS = [
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "ROUND", "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD",
  "FIRST_VALUE", "LAST_VALUE", "date_trunc", "extract", "now", "string_agg", "array_agg", "jsonb_agg", "jsonb_build_object",
  "PERCENTILE_CONT", "generate_series", "length", "lower", "upper", "substring", "concat",
];

/** Tables and columns of the dataset open in the editor, for completions. */
let schemaColumns: Column[] = [];
export const setCompletionSchema = (cols: Column[]) => {
  schemaColumns = cols;
};

monaco.languages.registerCompletionItemProvider("pgsql", {
  triggerCharacters: ["."],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const K = monaco.languages.CompletionItemKind;
    const before = model.getValueInRange(new monaco.Range(position.lineNumber, 1, position.lineNumber, word.startColumn));
    const dotted = /(\w+)\.$/.exec(before);
    const tables = [...new Set(schemaColumns.map((c) => c.table))];

    if (dotted) {
      // After "x.": columns of table x, or of the table aliased x in the query.
      const alias = dotted[1];
      const text = model.getValue();
      const aliased = new RegExp(`\\b(\\w+)\\s+(?:AS\\s+)?${alias}\\b`, "i").exec(text)?.[1];
      const table = tables.includes(alias) ? alias : aliased;
      return {
        suggestions: schemaColumns
          .filter((c) => c.table === table)
          .map((c) => ({ label: c.column, kind: K.Field, detail: c.type, insertText: c.column, range })),
      };
    }
    return {
      suggestions: [
        ...tables.map((t) => ({ label: t, kind: K.Class, detail: "table", insertText: t, range, sortText: "0" + t })),
        ...[...new Set(schemaColumns.map((c) => c.column))].map((c) => ({ label: c, kind: K.Field, detail: "column", insertText: c, range, sortText: "1" + c })),
        ...KEYWORDS.map((k) => ({ label: k, kind: K.Keyword, insertText: k, range, sortText: "2" + k })),
        ...FUNCTIONS.map((f) => ({ label: f, kind: K.Function, insertText: f + "($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "3" + f })),
      ],
    };
  },
});

export { monaco };
