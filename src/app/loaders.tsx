"use client";
/** Pages that need Postgres (WebAssembly) or Monaco render in the browser only. */
import dynamic from "next/dynamic";

const Loading = ({ text }: { text: string }) => <p className="muted page-loading">{text}</p>;

export const PlaygroundLoader = dynamic(() => import("../views/Playground").then((m) => m.Playground), {
  ssr: false,
  loading: () => <Loading text="Starting Postgres…" />,
});

export const ErdLoader = dynamic(() => import("../views/Erd").then((m) => m.ErdPage), {
  ssr: false,
  loading: () => <Loading text="Opening the diagram editor…" />,
});
