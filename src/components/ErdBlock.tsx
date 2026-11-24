"use client";
import dynamic from "next/dynamic";

// React Flow and the DBML parser only load on pages that draw a diagram, and only in the browser.
const Inner = dynamic(() => import("./ErdBlockInner"), {
  ssr: false,
  loading: () => <div className="erd-empty" style={{ height: 260 }} />,
});

/** A small ER diagram inside a lesson or an answer, from a ```erd block of DBML. */
export function ErdBlock({ dbml, highlight }: { dbml: string; highlight: string[] }) {
  return (
    <figure className="erd-block">
      <Inner dbml={dbml} highlight={highlight} />
    </figure>
  );
}
