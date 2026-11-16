"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { schemaDbml } from "../db/engine";
import { routes } from "../routes";
import { ErdDiagram } from "./ErdDiagram";
import { parseDbml, type ErdModel } from "./model";
import { shareHash } from "./share";

/** The diagram of a loaded dataset, drawn from its live tables and foreign keys. */
export function SchemaDiagram({ schema, version = 0, highlight, height = 420 }: { schema: string; version?: number; highlight?: string[]; height?: number }) {
  const [state, setState] = useState<{ dbml: string; model: ErdModel | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    schemaDbml(schema)
      .then((dbml) => live && setState({ dbml, model: parseDbml(dbml).model }))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [schema, version]);

  if (error) return <p className="error small">{error}</p>;
  if (!state) return <div className="erd-empty" style={{ height }}>Drawing the tables…</div>;
  return (
    <div className="schema-diagram">
      <ErdDiagram model={state.model} highlight={highlight} height={height} empty="This dataset has no tables yet." />
      <Link className="small" href={routes.erd + shareHash(state.dbml)}>
        <ExternalLink size={13} aria-hidden /> Open as DBML in the diagram editor
      </Link>
    </div>
  );
}
