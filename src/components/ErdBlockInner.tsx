"use client";
import { useMemo } from "react";
import { ErdDiagram } from "../erd/ErdDiagram";
import { parseDbml } from "../erd/model";

/** Parses the DBML and draws it. Loaded only when a page has a diagram (the parser is big). */
export default function ErdBlockInner({ dbml, highlight }: { dbml: string; highlight: string[] }) {
  const { model, errors } = useMemo(() => parseDbml(dbml), [dbml]);
  if (!model) return <pre className="code">{errors[0]?.message ?? dbml}</pre>;
  const rows = Math.max(...model.tables.map((t) => t.fields.length));
  return <ErdDiagram model={model} highlight={highlight.length ? highlight : undefined} height={Math.min(420, 150 + rows * 26)} />;
}
