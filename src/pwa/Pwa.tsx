"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Registers the service worker (production only: scripts/service-worker.mjs writes it
 * after the build), so Schemata works offline: pages, Postgres and Monaco are precached.
 *
 * A deploy reaches you on your next visit. If the new version takes over before you've
 * touched the page, it reloads straight away; otherwise a small notice offers to.
 */
export function Pwa() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (process.env.NODE_ENV !== "production" || !sw) return;
    const hadController = !!sw.controller;
    let touched = false;
    const touch = () => {
      touched = true;
    };
    for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(type, touch, { once: true, passive: true });
    const onChange = () => {
      // On a first visit nothing old is on screen, so there is nothing to swap.
      if (!hadController) return;
      if (!touched) location.reload();
      else setReady(true);
    };
    sw.addEventListener("controllerchange", onChange);
    sw.register("/sw.js").catch(() => {});

    // An installed app can stay open for days: look for a new version when it comes back.
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30 * 60_000) return;
      last = Date.now();
      sw.getRegistration().then((r) => r?.update()).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sw.removeEventListener("controllerchange", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!ready) return null;
  return (
    <div className="update-toast" role="status">
      A new version of Schemata is ready.
      <button className="btn small primary" onClick={() => location.reload()}>
        <RefreshCw size={14} aria-hidden /> Reload
      </button>
    </div>
  );
}
