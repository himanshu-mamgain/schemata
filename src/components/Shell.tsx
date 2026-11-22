"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Check, Code2, Database, GraduationCap, House, Network, Palette, type LucideIcon } from "lucide-react";
import { AppSwitcher } from "./AppSwitcher";
import { AccountButton } from "../account/AccountButton";
import { startAccount } from "../account/account";
import { InstallButton } from "../pwa/InstallButton";
import { Pwa } from "../pwa/Pwa";
import { setTheme, THEMES, useTheme } from "../theme";
import { routes } from "../routes";

type Tab = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

// Five tabs, like Structura's: along the bottom on phones, in the top bar on desktop.
const TABS: Tab[] = [
  { href: routes.home, label: "Home", icon: House, match: (p) => p === "/" },
  { href: routes.roadmap, label: "Learn", icon: BookOpen, match: (p) => /^\/(roadmap|databases|sources|topics)/.test(p) },
  { href: routes.questions(), label: "Practice", icon: GraduationCap, match: (p) => p.startsWith("/questions") },
  { href: routes.playground(), label: "SQL", icon: Code2, match: (p) => p.startsWith("/playground") },
  { href: routes.erd, label: "Diagrams", icon: Network, match: (p) => p.startsWith("/erd") },
];

function Tabs({ className }: { className: string }) {
  const path = usePathname();
  return (
    <nav className={className} aria-label="Sections">
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const on = match(path);
        return (
          <Link key={label} href={href} className={on ? "tab is-active" : "tab"} aria-current={on ? "page" : undefined}>
            <Icon size={22} strokeWidth={on ? 2.4 : 1.8} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ThemePicker() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="theme-picker" ref={ref}>
      <button type="button" className="icon-btn" aria-label="Theme" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Palette size={18} />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Theme">
          <p className="menu-title">Theme</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.id}
              className="theme-option"
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
            >
              <span className="theme-swatch" style={{ background: t.swatch[0], color: t.swatch[1] }} aria-hidden>
                Aa
              </span>
              <span>
                <strong>{t.name}</strong>
                <span className="muted small">{t.blurb}</span>
              </span>
              {theme === t.id && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Loads Supabase only if this browser is signed in to Studia, or is coming back from signing in.
  useEffect(() => void startAccount(), []);
  const wide = path.startsWith("/playground") || path.startsWith("/erd");
  return (
    <div className="shell">
      <header className="appbar">
        <Link href="/" className="brand" aria-label="Schemata, home">
          <span className="brand-mark" aria-hidden>
            <Database size={19} />
          </span>
          <span className="brand-name">Schemata</span>
        </Link>
        <Tabs className="appbar-tabs" />
        <span className="appbar-gap" />
        <InstallButton />
        <ThemePicker />
        <AccountButton />
        <AppSwitcher />
      </header>
      <main className={wide ? "content wide" : "content"}>{children}</main>
      <Tabs className="tabbar" />
      <Pwa />
    </div>
  );
}
