/**
 * Monaco bundled locally (works offline), trimmed to the editor features and the
 * query languages Schemata shows. Only the base editor worker: we need highlighting
 * and our own SQL completions, not language servers.
 */
import * as monaco from "monaco-esm/editor/editor.api.js";
import "./monaco-features";
import EditorWorker from "monaco-esm/editor/editor.worker.js?worker";
import type { Column } from "../db/engine";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

monaco.editor.defineTheme("schemata-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: { "editor.background": "#0f1522", "editor.lineHighlightBackground": "#161e30", "editorGutter.background": "#0f1522" },
});
monaco.editor.defineTheme("schemata-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: { "editor.background": "#f8f9fc", "editor.lineHighlightBackground": "#eef1f7", "editorGutter.background": "#f8f9fc" },
});

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
