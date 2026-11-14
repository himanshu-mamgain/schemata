import { useEffect, useState } from "react";
import { ChevronRight, Table2 } from "lucide-react";
import { columns, type Column } from "../db/engine";
import { setCompletionSchema } from "../editor/monaco";

/** Tables and columns of one dataset. Clicking a table name inserts a preview query. */
export function SchemaBrowser({ schema, version, onPick }: { schema: string; version: number; onPick?: (sql: string) => void }) {
  const [cols, setCols] = useState<Column[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    columns(schema).then((c) => {
      if (!live) return;
      setCols(c);
      setCompletionSchema(c);
    });
    return () => {
      live = false;
    };
  }, [schema, version]);

  if (!cols) return <p className="muted small">Loading tables…</p>;
  const tables = [...new Set(cols.map((c) => c.table))];
  if (tables.length === 0) return <p className="muted small">No tables yet.</p>;

  const toggle = (t: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  return (
    <ul className="schema">
      {tables.map((t) => (
        <li key={t}>
          <div className="schema-table">
            <button className="icon-btn" aria-label={`Show columns of ${t}`} aria-expanded={open.has(t)} onClick={() => toggle(t)}>
              <ChevronRight size={14} className={open.has(t) ? "rot" : undefined} />
            </button>
            <button className="schema-name" onClick={() => onPick?.(`SELECT * FROM ${t} LIMIT 20;`)} title="Preview this table">
              <Table2 size={14} aria-hidden /> {t}
            </button>
          </div>
          {open.has(t) && (
            <ul className="schema-cols">
              {cols
                .filter((c) => c.table === t)
                .map((c) => (
                  <li key={c.column}>
                    <span>{c.column}</span>
                    <span className="muted">{c.type}</span>
                  </li>
                ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
