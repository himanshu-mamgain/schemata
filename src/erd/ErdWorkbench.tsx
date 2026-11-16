"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Code2, Network } from "lucide-react";
import { SqlEditor } from "../editor/SqlEditor";
import "./dbml-language";
import { ErdDiagram } from "./ErdDiagram";
import { parseDbml, type ErdModel } from "./model";

/** Parses as you type (debounced), keeping the last good diagram while the DBML has errors. */
export function useDbml(src: string) {
  const [state, setState] = useState(() => parseDbml(src));
  const [lastGood, setLastGood] = useState<ErdModel | null>(state.model);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = parseDbml(src);
      setState(next);
      if (next.model) setLastGood(next.model);
    }, 220);
    return () => clearTimeout(t);
  }, [src]);
  return { model: state.model ?? lastGood, errors: state.errors, stale: !state.model && !!lastGood };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  highlight?: string[];
}

/** DBML on the left, the diagram on the right (stacked behind tabs on phones). */
export function ErdWorkbench({ value, onChange, height = 520, highlight }: Props) {
  const { model, errors, stale } = useDbml(value);
  const [tab, setTab] = useState<"code" | "diagram">("code");
  const markers = useMemo(() => errors.map((e) => ({ ...e })), [errors]);

  return (
    <div className="workbench" data-tab={tab}>
      <div className="seg workbench-tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={tab === "code"} onClick={() => setTab("code")}>
          <Code2 size={15} aria-hidden /> DBML
        </button>
        <button type="button" aria-pressed={tab === "diagram"} onClick={() => setTab("diagram")}>
          <Network size={15} aria-hidden /> Diagram
        </button>
      </div>
      <div className="workbench-code">
        <SqlEditor value={value} onChange={onChange} language="dbml" height={height} markers={markers} />
        {errors.length > 0 && (
          <ul className="dbml-errors" aria-live="polite">
            {errors.slice(0, 4).map((e, i) => (
              <li key={i}>
                <AlertTriangle size={14} aria-hidden /> Line {e.line}: {e.message}
              </li>
            ))}
            {errors.length > 4 && <li className="muted">…and {errors.length - 4} more</li>}
          </ul>
        )}
      </div>
      <div className={`workbench-diagram${stale ? " is-stale" : ""}`}>
        <ErdDiagram model={model} highlight={highlight} height={height} empty="Add a Table to see it here." />
        {stale && <p className="stale-note small">Showing the last version without errors.</p>}
      </div>
    </div>
  );
}
