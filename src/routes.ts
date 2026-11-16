/**
 * Page addresses. Each topic and question has its own page, written at build time.
 * The older query links (?topic=, ?q=, ?page=…) that DSA Atlas and Structura build
 * still work: netlify.toml redirects them, and legacyPath() does the same in the browser.
 */
export const routes = {
  home: "/",
  playground: (dataset?: string) => (dataset ? `/playground?dataset=${encodeURIComponent(dataset)}` : "/playground"),
  roadmap: "/roadmap",
  questions: (stage?: string) => (stage ? `/questions?stage=${encodeURIComponent(stage)}` : "/questions"),
  question: (id: string) => `/questions/${encodeURIComponent(id)}`,
  topic: (id: string) => `/topics/${encodeURIComponent(id)}`,
  databases: "/databases",
  sources: "/sources",
  erd: "/erd",
};

/** Where an old query-string link now lives, or null when it isn't one. */
export function legacyPath(search: string): string | null {
  const p = new URLSearchParams(search);
  const q = p.get("q");
  if (q) return routes.question(q);
  const topic = p.get("topic");
  if (topic) return routes.topic(topic);
  switch (p.get("page")) {
    case "playground":
      return routes.playground(p.get("dataset") ?? undefined);
    case "questions":
      return routes.questions(p.get("stage") ?? undefined);
    case "roadmap":
      return routes.roadmap;
    case "databases":
      return routes.databases;
    case "sources":
      return routes.sources;
    case "erd":
      return routes.erd;
    default:
      return null;
  }
}
