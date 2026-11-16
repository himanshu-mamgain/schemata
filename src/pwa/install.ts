// Whether the app can be installed, and an install action (the same as Structura's).
// Chrome, Edge and Samsung Internet fire `beforeinstallprompt`, which we keep so the
// Install button can open the browser's dialog later. It can fire before React starts,
// so a script in layout.tsx catches it first (window.__installPrompt). iOS Safari has
// no such event: there the button explains Share → Add to Home Screen.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
}

export type InstallKind = "installed" | "available" | "ios" | "unavailable";

let installed = false;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS reports itself as a Mac, so also check for touch.
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function start() {
  if (started) return;
  started = true;
  window.addEventListener("schemata:installable", notify);
  window.addEventListener("appinstalled", () => {
    installed = true;
    window.__installPrompt = null;
    notify();
  });
}

export function getInstallKind(): InstallKind {
  if (installed || isStandalone()) return "installed";
  if (window.__installPrompt) return "available";
  if (isIos()) return "ios";
  return "unavailable";
}

export function subscribeInstall(fn: () => void) {
  start();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Shows the browser's install dialog. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = window.__installPrompt;
  if (!event) return false;
  window.__installPrompt = null; // a prompt event can only be used once
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === "accepted";
}

/** Runs in <head>, before React: keeps the install event for the Install button. */
export const installBootScript = `window.__installPrompt=null;addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;dispatchEvent(new Event("schemata:installable"))});`;
