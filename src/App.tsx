import { lazy, Suspense, useEffect } from "react";
import { Code2, Database, FolderGit2, Home as HomeIcon, Map, MessageSquareCode, Moon, Sun } from "lucide-react";
import { useRoute, onLinkClick, type Route } from "./router";
import { setThemeChoice, useTheme } from "./theme";
import { AppSwitcher } from "./components/AppSwitcher";
import { Home, Roadmap, Questions, Databases, TopicPage } from "./pages/Learn";
import { stageById } from "./content/roadmap";
import { databaseById } from "./content/databases";
import { questionById } from "./content/questions";
import { Sources } from "./pages/Sources";

// The editor pages pull in Monaco and Postgres (WASM): load them only when needed.
const Playground = lazy(() => import("./pages/Playground").then((m) => ({ default: m.Playground })));
const QuestionPage = lazy(() => import("./pages/QuestionPage").then((m) => ({ default: m.QuestionPage })));

const NAV: { to: string; label: string; icon: typeof HomeIcon; match: Route["name"][] }[] = [
  { to: "/", label: "Home", icon: HomeIcon, match: ["home"] },
  { to: "/?page=playground", label: "SQL editor", icon: Code2, match: ["playground"] },
  { to: "/?page=roadmap", label: "Roadmap", icon: Map, match: ["roadmap"] },
  { to: "/?page=questions", label: "Questions", icon: MessageSquareCode, match: ["questions", "question"] },
  { to: "/?page=databases", label: "Databases", icon: Database, match: ["databases"] },
  { to: "/?page=sources", label: "Data sources", icon: FolderGit2, match: ["sources"] },
];

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "home":
      return <Home />;
    case "playground":
      return <Playground dataset={route.dataset} />;
    case "roadmap":
      return <Roadmap />;
    case "questions":
      return <Questions stage={route.stage} />;
    case "question":
      return <QuestionPage id={route.id} />;
    case "databases":
      return <Databases />;
    case "sources":
      return <Sources />;
    case "topic":
      return <TopicPage id={route.id} />;
  }
}

const TITLES: Partial<Record<Route["name"], string>> = {
  playground: "SQL editor",
  roadmap: "Roadmap",
  questions: "Interview questions",
  databases: "Database guide",
  sources: "Data sources",
};

export function App() {
  const route = useRoute();
  const theme = useTheme();
  useEffect(() => {
    const t =
      route.name === "question" ? questionById(route.id)?.title : route.name === "topic" ? (stageById(route.id)?.title ?? databaseById(route.id)?.name) : TITLES[route.name];
    document.title = t ? `${t} · Schemata` : "Schemata";
  }, [route]);

  // Topic pages are either a roadmap stage or a database guide; highlight the right section.
  const section: Route["name"] = route.name === "topic" ? (stageById(route.id) ? "roadmap" : "databases") : route.name;
  const active = (m: Route["name"][]) => m.includes(section);

  return (
    <div className="shell">
      <header className="top">
        <a href="/" onClick={onLinkClick} className="brand">
          <span className="logo" aria-hidden>
            <Database size={18} />
          </span>
          Schemata
        </a>
        <nav className="nav" aria-label="Sections">
          {NAV.map(({ to, label, icon: Icon, match }) => (
            <a key={to} href={to} onClick={onLinkClick} className={active(match) ? "active" : undefined} aria-current={active(match) ? "page" : undefined}>
              <Icon size={16} aria-hidden /> <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="top-actions">
          <button
            className="btn ghost icon"
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            onClick={() => setThemeChoice(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <AppSwitcher />
        </div>
      </header>
      <main className={route.name === "playground" ? "content wide" : "content"}>
        <Suspense fallback={<p className="muted">Starting Postgres…</p>}>
          <Page route={route} />
        </Suspense>
      </main>
    </div>
  );
}
