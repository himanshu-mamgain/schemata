"use client";
import { useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { ECOSYSTEM, THIS_APP, ecoRef, type EcoRef } from "../ecosystem";

/** Switch between the apps in the ecosystem. Same list as DSA Atlas and Structura. */
export function AppSwitcher() {
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
    <div className="switcher" ref={ref}>
      <button className="btn ghost switcher-btn" aria-label="Your apps" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <LayoutGrid size={16} /> Your apps
      </button>
      {open && (
        <div className="switcher-menu" role="menu">
          <p className="switcher-title">Your apps</p>
          {ECOSYSTEM.map((app) => {
            const here = app.id === THIS_APP;
            return (
              <a key={app.id} role="menuitem" className="switcher-app" href={here ? "/" : app.url} aria-current={here ? "page" : undefined}>
                <span className="switcher-dot" style={{ background: app.color }} aria-hidden>
                  {app.name[0]}
                </span>
                <span>
                  <strong>{app.name}</strong>
                  <span className="muted small">{here ? "You're here" : app.tagline}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** "See it in Structura" / "Practise in DSA Atlas" cards. */
export function EcoLinks({ refs, title = "Related in your other apps" }: { refs?: EcoRef[]; title?: string }) {
  if (!refs?.length) return null;
  return (
    <section className="eco">
      <h3>{title}</h3>
      <div className="eco-grid">
        {refs.map((r) => {
          const { href, title: t, app } = ecoRef(r);
          return (
            <a key={href} className="eco-card" href={href} target="_blank" rel="noreferrer">
              <span className="switcher-dot" style={{ background: app.color }} aria-hidden>
                {app.name[0]}
              </span>
              <span>
                <span className="muted small">{app.name}</span>
                <strong>{t}</strong>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
