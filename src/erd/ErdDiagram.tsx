"use client";
/**
 * The ER diagram: one card per table, one line per foreign key, drawn with crow's
 * feet (many) and bars (one). Laid out left to right with dagre, so parent tables
 * sit left of the tables that point at them. Tables can be dragged; "Tidy" lays
 * them out again.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Graph, layout } from "@dagrejs/dagre";
import { KeyRound, Link2, Sparkles } from "lucide-react";
import type { ErdModel, ErdTable } from "./model";

const WIDTH = 236;
const HEAD = 40;
const ROW = 26;
// Fit the diagram, but never blow one table up past full size, nor shrink a big
// schema until it can't be read (pan or zoom out to see the rest).
const FIT = { padding: 0.12, maxZoom: 1, minZoom: 0.55 };
const heightOf = (t: ErdTable) => HEAD + Math.max(1, t.fields.length) * ROW + 8;

type TableData = { table: ErdTable; fks: Set<string>; state: "normal" | "highlight" | "dim" };
type TableNode = Node<TableData, "table">;

const TableCard = memo(function TableCard({ data }: NodeProps<TableNode>) {
  const { table, fks, state } = data;
  return (
    <div className={`erd-table is-${state}`} style={{ width: WIDTH }} title={table.note}>
      <div className="erd-head" style={table.color ? { borderTopColor: table.color } : undefined}>
        <span>{table.name}</span>
        {table.note && <span className="erd-note-dot" aria-label={`Note: ${table.note}`} />}
      </div>
      <ul>
        {table.fields.map((f) => (
          <li key={f.name} title={f.note}>
            {/* A source and a target on each side, so a line can leave or enter from either. */}
            <Handle type="source" position={Position.Left} id={`${f.name}:L:s`} className="erd-handle" />
            <Handle type="target" position={Position.Left} id={`${f.name}:L:t`} className="erd-handle" />
            <span className="erd-icon">
              {f.pk ? <KeyRound size={12} aria-label="Primary key" /> : fks.has(f.name) ? <Link2 size={12} aria-label="Foreign key" /> : null}
            </span>
            <span className={f.pk ? "erd-col is-pk" : "erd-col"}>{f.name}</span>
            {f.unique && !f.pk && <span className="erd-badge" title="Unique">U</span>}
            <span className="erd-type">
              {f.type}
              {!f.notNull && <span className="erd-null">?</span>}
            </span>
            <Handle type="source" position={Position.Right} id={`${f.name}:R:s`} className="erd-handle" />
            <Handle type="target" position={Position.Right} id={`${f.name}:R:t`} className="erd-handle" />
          </li>
        ))}
      </ul>
    </div>
  );
});

const nodeTypes = { table: TableCard };

/** Left-to-right layout: the table a foreign key points at goes left of the table holding it. */
function autoLayout(model: ErdModel): Map<string, { x: number; y: number }> {
  const g = new Graph();
  g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 64, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const t of model.tables) g.setNode(t.id, { width: WIDTH, height: heightOf(t) });
  for (const r of model.refs) if (r.from.table !== r.to.table && g.hasNode(r.from.table) && g.hasNode(r.to.table)) g.setEdge(r.to.table, r.from.table);
  layout(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const t of model.tables) {
    const n = g.node(t.id);
    out.set(t.id, { x: n.x - WIDTH / 2, y: n.y - heightOf(t) / 2 });
  }
  return out;
}

const shape = (m: ErdModel) => m.tables.map((t) => `${t.id}:${t.fields.length}`).join("|") + "#" + m.refs.map((r) => `${r.from.table}>${r.to.table}`).join("|");

interface Props {
  model: ErdModel | null;
  /** Tables to emphasise (e.g. the ones a question needs); the rest fade. */
  highlight?: string[];
  height?: number | string;
  /** Shown when there is nothing to draw. */
  empty?: string;
}

function Diagram({ model, highlight, height = 460, empty = "Nothing to draw yet." }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>([]);
  const [hover, setHover] = useState<string | null>(null);
  const moved = useRef(new Map<string, { x: number; y: number }>());
  const lastShape = useRef("");
  const flow = useReactFlow();

  const fksByTable = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of model?.refs ?? []) {
      const s = m.get(r.from.table) ?? new Set();
      r.from.fields.forEach((f) => s.add(f));
      m.set(r.from.table, s);
    }
    return m;
  }, [model]);

  const stateOf = useCallback(
    (id: string): TableData["state"] => {
      const hl = new Set((highlight ?? []).map((h) => h.toLowerCase()));
      if (hover) {
        const near = new Set([hover, ...(model?.refs ?? []).flatMap((r) => (r.from.table === hover ? [r.to.table] : r.to.table === hover ? [r.from.table] : []))]);
        return near.has(id) ? "highlight" : "dim";
      }
      if (!hl.size) return "normal";
      return hl.has(id.toLowerCase()) ? "highlight" : "dim";
    },
    [highlight, hover, model],
  );

  const relayout = useCallback(
    (keepMoved: boolean) => {
      if (!model) return;
      if (!keepMoved) moved.current.clear();
      const pos = autoLayout(model);
      setNodes(
        model.tables.map((t) => ({
          id: t.id,
          type: "table",
          position: moved.current.get(t.id) ?? pos.get(t.id)!,
          data: { table: t, fks: fksByTable.get(t.id) ?? new Set(), state: stateOf(t.id) },
        })),
      );
    },
    [model, fksByTable, setNodes, stateOf],
  );

  // A new or removed table or relationship lays the diagram out again (keeping tables you moved);
  // editing a column only updates the cards.
  useEffect(() => {
    if (!model) return;
    const s = shape(model);
    if (s !== lastShape.current) {
      const first = lastShape.current === "";
      lastShape.current = s;
      relayout(true);
      if (first) requestAnimationFrame(() => flow.fitView({ ...FIT, duration: 0 }));
      return;
    }
    setNodes((ns) =>
      ns.map((n) => {
        const t = model.tables.find((x) => x.id === n.id);
        return t ? { ...n, data: { table: t, fks: fksByTable.get(t.id) ?? new Set(), state: stateOf(t.id) } } : n;
      }),
    );
  }, [model, relayout, setNodes, fksByTable, stateOf, flow]);

  const edges = useMemo<Edge[]>(() => {
    if (!model) return [];
    const at = new Map(nodes.map((n) => [n.id, n.position.x]));
    return model.refs.flatMap((r) => {
      const sx = at.get(r.from.table);
      const tx = at.get(r.to.table);
      if (sx === undefined || tx === undefined) return [];
      // Leave from the side facing the other table; a table pointing at itself loops on the right.
      const self = r.from.table === r.to.table;
      const right = self || sx + WIDTH / 2 < tx;
      const sSide = self ? "R" : right ? "R" : "L";
      const tSide = self ? "R" : right ? "L" : "R";
      const lit = hover ? r.from.table === hover || r.to.table === hover : false;
      return [
        {
          id: r.id,
          source: r.from.table,
          target: r.to.table,
          sourceHandle: `${r.from.fields[0]}:${sSide}:s`,
          targetHandle: `${r.to.fields[0]}:${tSide}:t`,
          type: "smoothstep",
          markerStart: r.from.many ? "erd-many" : "erd-one",
          markerEnd: r.to.many ? "erd-many" : "erd-one",
          className: lit ? "erd-edge is-lit" : "erd-edge",
          ariaLabel: `${r.from.table}.${r.from.fields.join(", ")} references ${r.to.table}.${r.to.fields.join(", ")}`,
        },
      ];
    });
  }, [model, nodes, hover]);

  if (!model || model.tables.length === 0) return <div className="erd-empty" style={{ height }}>{empty}</div>;

  return (
    <div className="erd" style={{ height }}>
      <svg className="erd-defs" aria-hidden>
        <defs>
          {/* Crow's foot: the many side. Drawn for the end of a line; auto-start-reverse flips it for the start. */}
          <marker id="erd-many" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="16" markerHeight="16" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M1 7 H13 M5 7 L13 1 M5 7 L13 13" fill="none" stroke="var(--erd-line)" strokeWidth="1.5" />
          </marker>
          {/* Two bars: exactly one. */}
          <marker id="erd-one" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="16" markerHeight="16" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M1 7 H13 M7 2 V12 M10 2 V12" fill="none" stroke="var(--erd-line)" strokeWidth="1.5" />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, n) => moved.current.set(n.id, n.position)}
        onNodeMouseEnter={(_, n) => setHover(n.id)}
        onNodeMouseLeave={() => setHover(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={FIT}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} color="var(--erd-grid)" />
        <Controls showInteractive={false} position="bottom-left" />
        {model.tables.length > 8 && <MiniMap pannable zoomable nodeColor="var(--primary-soft)" maskColor="var(--erd-mask)" position="bottom-right" />}
        <div className="erd-toolbar">
          <button
            type="button"
            className="btn small"
            onClick={() => {
              relayout(false);
              requestAnimationFrame(() => flow.fitView({ ...FIT, duration: 250 }));
            }}
            title="Lay the tables out again"
          >
            <Sparkles size={14} aria-hidden /> Tidy
          </button>
        </div>
      </ReactFlow>
      <p className="erd-legend small muted" aria-hidden>
        <KeyRound size={11} /> primary key · <Link2 size={11} /> foreign key · <b>?</b> nullable · crow&apos;s foot = many
      </p>
    </div>
  );
}

export function ErdDiagram(props: Props) {
  return (
    <ReactFlowProvider>
      <Diagram {...props} />
    </ReactFlowProvider>
  );
}
