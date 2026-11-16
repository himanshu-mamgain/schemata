"use client";
import { useEffect, useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import { ErdWorkbench } from "../erd/ErdWorkbench";
import { fromHash, shareHash } from "../erd/share";
import { isLoaded, schemaDbml } from "../db/engine";
import { DATASETS } from "../db/datasets";
import { erdDraft } from "../store";

const EXAMPLE = `// DBML: a table per block, a column per line, settings in [brackets].
// Docs: https://dbml.dbdiagram.io/docs

Table users {
  id int [pk]
  email varchar [not null, unique]
  created_at timestamptz [not null]
}

Table courses {
  id int [pk]
  title varchar [not null]
  author_id int [ref: > users.id] // many courses, one author
}

Table enrollments {
  user_id int [ref: > users.id]
  course_id int [ref: > courses.id]
  progress int [note: 'Lessons finished']

  indexes {
    (user_id, course_id) [pk]
  }
}
`;

export function ErdPage() {
  const [dbml, setDbml] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A shared link (#dbml=…) wins over your saved draft; the example is the fallback.
  useEffect(() => {
    const load = () => {
      const shared = fromHash(location.hash);
      if (shared !== null) {
        setDbml(shared);
        erdDraft.set(shared);
        history.replaceState(null, "", location.pathname);
      } else setDbml((cur) => cur ?? (erdDraft.get() || EXAMPLE));
    };
    load();
    addEventListener("hashchange", load);
    return () => removeEventListener("hashchange", load);
  }, []);

  const change = (v: string) => {
    setDbml(v);
    erdDraft.set(v);
  };

  const startFrom = async (what: string) => {
    if (!what) return;
    if (dbml && dbml !== EXAMPLE && !confirm("Replace what's in the editor?")) return;
    if (what === "example") return change(EXAMPLE);
    if (what === "blank") return change("Table my_table {\n  id int [pk]\n}\n");
    setStatus("Reading the tables from Postgres…");
    try {
      if (!(await isLoaded(what))) {
        setStatus(`${DATASETS.find((d) => d.id === what)?.name} isn't downloaded yet: open it once in the SQL editor.`);
        return;
      }
      change(await schemaDbml(what));
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const share = async () => {
    if (!dbml) return;
    const url = location.origin + location.pathname + shareHash(dbml);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link", url);
    }
  };

  const download = () => {
    if (!dbml) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([dbml], { type: "text/plain" }));
    a.download = "schema.dbml";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="erd-page">
      <h1>Schema diagrams</h1>
      <p className="lead">
        Write <a href="https://dbml.dbdiagram.io/docs" target="_blank" rel="noreferrer">DBML</a> and see the ER diagram as you type. Draw any dataset
        from the SQL editor, or share a schema as a link to set someone a problem.
      </p>
      <div className="toolbar">
        <label className="field inline">
          <span className="picker-label">Start from</span>
          <select value="" onChange={(e) => void startFrom(e.target.value)}>
            <option value="">Choose…</option>
            <option value="example">The example (courses)</option>
            <option value="blank">A blank table</option>
            {DATASETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} dataset
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={share} disabled={!dbml}>
          {copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? "Link copied" : "Copy share link"}
        </button>
        <button className="btn ghost" onClick={download} disabled={!dbml}>
          <Download size={16} /> .dbml
        </button>
        {status && <span className="small muted grow-right">{status}</span>}
      </div>
      {dbml !== null ? <ErdWorkbench value={dbml} onChange={change} height={560} /> : <div className="erd-empty" style={{ height: 560 }} />}
      <section className="dbml-cheats">
        <h3>DBML in one minute</h3>
        <div className="three-col">
          <div className="panel">
            <h4>Columns</h4>
            <pre className="code">{"id int [pk, increment]\nemail varchar [not null, unique]\nbio text [note: 'optional']"}</pre>
          </div>
          <div className="panel">
            <h4>Relationships</h4>
            <pre className="code">{"author_id int [ref: > users.id]\n// >  many-to-one\n// <  one-to-many\n// -  one-to-one\n// <> many-to-many"}</pre>
          </div>
          <div className="panel">
            <h4>Composite keys</h4>
            <pre className="code">{"indexes {\n  (user_id, course_id) [pk]\n  (email, org_id) [unique]\n}"}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
