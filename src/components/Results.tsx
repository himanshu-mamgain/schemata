import type { QueryResult } from "../db/engine";

const MAX_ROWS = 500;

function show(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return v.toISOString().replace("T00:00:00.000Z", "").replace("T", " ").replace(".000Z", "");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** One result set: a table, a row count for writes, or a query plan. */
export function ResultTable({ result }: { result: QueryResult }) {
  if (result.fields.length === 0) {
    return <p className="muted small result-note">Done{result.affectedRows ? `: ${result.affectedRows} row(s) affected` : ""}.</p>;
  }
  // EXPLAIN output: a single text column, shown as a plan.
  if (result.fields.length === 1 && result.fields[0] === "QUERY PLAN") {
    return <pre className="plan">{result.rows.map((r) => String(r[0])).join("\n")}</pre>;
  }
  const rows = result.rows.slice(0, MAX_ROWS);
  return (
    <div className="result">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {result.fields.map((f, i) => (
                <th key={i}>{f}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j} className={v === null ? "null" : typeof v === "number" ? "num" : undefined}>
                    {show(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small result-note">
        {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
        {result.rows.length > MAX_ROWS ? `, first ${MAX_ROWS} shown` : ""} · {result.ms.toFixed(1)} ms
      </p>
    </div>
  );
}

export function ResultsPanel({ results, error }: { results: QueryResult[] | null; error: string | null }) {
  if (error) return <pre className="error-box">{error}</pre>;
  if (!results) return <p className="muted small">Run a query to see results here.</p>;
  // Show the result sets that carry data; with several statements, label each.
  const shown = results.filter((r, i) => r.fields.length > 0 || i === results.length - 1);
  return (
    <div className="results">
      {shown.map((r, i) => (
        <div key={i}>
          {shown.length > 1 && <p className="result-label">Result {i + 1}</p>}
          <ResultTable result={r} />
        </div>
      ))}
    </div>
  );
}
