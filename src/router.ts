import { useSyncExternalStore } from "react";

/**
 * Query-string router, like DSA Atlas and Structura:
 *   ?page=playground[&dataset=<id>]   SQL editor
 *   ?page=roadmap | questions | databases | sources
 *   ?page=questions&stage=<stage id>   questions for one roadmap stage
 *   ?topic=<id>                        a roadmap stage or a database guide (the id other apps link to)
 *   ?q=<question id>                   one interview question
 */
export type Route =
  | { name: "home" }
  | { name: "playground"; dataset?: string }
  | { name: "roadmap" }
  | { name: "questions"; stage?: string }
  | { name: "question"; id: string }
  | { name: "databases" }
  | { name: "sources" }
  | { name: "topic"; id: string };

function parse(): Route {
  const p = new URLSearchParams(location.search);
  const q = p.get("q");
  if (q) return { name: "question", id: q };
  const topic = p.get("topic");
  if (topic) return { name: "topic", id: topic };
  switch (p.get("page")) {
    case "playground":
      return { name: "playground", dataset: p.get("dataset") ?? undefined };
    case "roadmap":
      return { name: "roadmap" };
    case "questions":
      return { name: "questions", stage: p.get("stage") ?? undefined };
    case "databases":
      return { name: "databases" };
    case "sources":
      return { name: "sources" };
    default:
      return { name: "home" };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case "home":
      return "/";
    case "question":
      return `/?q=${encodeURIComponent(r.id)}`;
    case "topic":
      return `/?topic=${encodeURIComponent(r.id)}`;
    case "playground":
      return r.dataset ? `/?page=playground&dataset=${encodeURIComponent(r.dataset)}` : "/?page=playground";
    case "questions":
      return r.stage ? `/?page=questions&stage=${encodeURIComponent(r.stage)}` : "/?page=questions";
    default:
      return `/?page=${r.name}`;
  }
}

let current = parse();
const listeners = new Set<() => void>();
const emit = () => {
  current = parse();
  listeners.forEach((l) => l());
};
window.addEventListener("popstate", emit);

export function navigate(r: Route | string) {
  const url = typeof r === "string" ? r : href(r);
  if (url === location.pathname + location.search) return;
  history.pushState(null, "", url);
  window.scrollTo(0, 0);
  emit();
}

/** Plain left-clicks on internal links navigate without a reload. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.currentTarget;
  if (a.target || a.origin !== location.origin) return;
  e.preventDefault();
  navigate(a.pathname + a.search);
}

export const useRoute = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
