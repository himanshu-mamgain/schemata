"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Download, Network, Play, RotateCcw, Trash2 } from "lucide-react";
import { SqlEditor } from "../editor/SqlEditor";
import { SchemaBrowser } from "../components/SchemaBrowser";
import { ResultsPanel } from "../components/Results";
import { isLoaded, loadDataset, resetDataset, run, type QueryResult } from "../db/engine";
import { DATASETS } from "../db/datasets";
import { draft, savedQueries } from "../store";
import { routes } from "../routes";
import { SchemaDiagram } from "../erd/SchemaDiagram";

export function Playground() {
  const fromUrl = useSearchParams().get("dataset") ?? undefined;
  const router = useRouter();
  const d = draft.use();
  const dataset = fromUrl && DATASETS.some((x) => x.id === fromUrl) ? fromUrl : d.dataset;
  const info = DATASETS.find((x) => x.id === dataset)!;
  const saved = savedQueries.use();

  const [sql, setSql] = useState(d.sql);
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [diagram, setDiagram] = useState(false);

  // The draft follows the editor, so leaving the page keeps your query.
  useEffect(() => {
    const t = setTimeout(() => draft.set({ dataset, sql }), 300);
    return () => clearTimeout(t);
  }, [dataset, sql]);

  useEffect(() => {
    setLoaded(null);
    isLoaded(dataset).then(setLoaded);
  }, [dataset, version]);

  const pickDataset = (id: string) => {
    draft.set({ dataset: id, sql });
    setResults(null);
    setError(null);
    router.replace(routes.playground(id));
  };

  const exec = async (text = sql) => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await run(text, dataset));
      // DDL may have changed the tables.
      if (/\b(create|drop|alter)\b/i.test(text)) setVersion((v) => v + 1);
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setLoadError(null);
    try {
      await loadDataset(dataset);
      setVersion((v) => v + 1);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const msg = info.url
      ? `Remove ${info.name} from this browser? You can download it again any time.`
      : `Reset ${info.name} to its original data? Your changes to its tables will be lost.`;
    if (!confirm(msg)) return;
    await resetDataset(dataset);
    setResults(null);
    setVersion((v) => v + 1);
  };

  const save = () => {
    const name = prompt("Name this query", sql.split("\n").find((l) => l.trim() && !l.startsWith("--"))?.slice(0, 40) ?? "My query");
    if (!name) return;
    savedQueries.set([{ id: crypto.randomUUID(), name, dataset, sql, savedAt: new Date().toISOString() }, ...saved]);
  };

  return (
    <div className="playground">
      <aside className="pg-side panel">
        <label className="field">
          <span className="picker-label">Dataset</span>
          <select value={dataset} onChange={(e) => pickDataset(e.target.value)}>
            {DATASETS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">{info.blurb}</p>
        {info.repo && (
          <p className="small">
            Source:{" "}
            <a href={`https://github.com/${info.repo}`} target="_blank" rel="noreferrer">
              {info.repo}
            </a>{" "}
            ({info.license})
          </p>
        )}
        {loaded === false ? (
          <div className="stack">
            <button className="btn primary" onClick={download} disabled={busy}>
              <Download size={16} /> {busy ? "Loading…" : `Download ${info.name}`}
            </button>
            <p className="muted small">Fetched once from GitHub, then kept in this browser and available offline.</p>
            {loadError && <p className="error small">{loadError}</p>}
          </div>
        ) : (
          <>
            <h4>Tables</h4>
            <SchemaBrowser schema={dataset} version={version} onPick={(q) => (setSql(q), exec(q))} />
            <button className="btn ghost small" onClick={reset}>
              <RotateCcw size={14} /> {info.url ? "Remove dataset" : "Reset data"}
            </button>
          </>
        )}
        {saved.length > 0 && (
          <>
            <h4>Saved queries</h4>
            <ul className="saved">
              {saved.map((q) => (
                <li key={q.id}>
                  <button
                    className="link-btn"
                    onClick={() => {
                      setSql(q.sql);
                      if (q.dataset !== dataset) pickDataset(q.dataset);
                    }}
                    title={q.sql}
                  >
                    {q.name}
                  </button>
                  <span className="muted small">{q.dataset}</span>
                  <button className="icon-btn" aria-label={`Delete ${q.name}`} onClick={() => savedQueries.set(saved.filter((s) => s.id !== q.id))}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <section className="pg-main">
        <div className="toolbar">
          <button className="btn primary" onClick={() => exec()} disabled={busy || loaded === false}>
            <Play size={16} /> Run <kbd>Ctrl ↵</kbd>
          </button>
          <button className="btn" onClick={() => exec(`EXPLAIN ANALYZE ${sql.trim().replace(/;$/, "")}`)} disabled={busy || loaded === false} title="Show how Postgres runs this query">
            Explain
          </button>
          <button className="btn ghost" onClick={save}>
            <Bookmark size={16} /> Save
          </button>
          <button className={diagram ? "btn ghost is-on" : "btn ghost"} onClick={() => setDiagram((v) => !v)} aria-pressed={diagram} disabled={loaded === false} title="Draw this dataset's tables and foreign keys">
            <Network size={16} /> Diagram
          </button>
          <span className="muted small grow-right">Real PostgreSQL in your browser · changes are kept</span>
        </div>
        {diagram && loaded && <SchemaDiagram schema={dataset} version={version} height={380} />}
        <SqlEditor value={sql} onChange={setSql} onRun={exec} height={300} />
        <ResultsPanel results={results} error={error} />
      </section>
    </div>
  );
}
