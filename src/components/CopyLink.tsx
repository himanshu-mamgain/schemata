"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";

/** This page's address, without a sign-in fragment (#access_token=…); a section link (#…) is kept. */
function hereUrl(): string {
  const { origin, pathname, search, hash } = window.location;
  return origin + pathname + search + (hash && !hash.includes("token=") ? hash : "");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page that isn't served over HTTPS: copy through a hidden text box.
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  }
}

/** Copies the address of the page you are on, and says "Copied" for 2 seconds. */
export function CopyLink({ className = "btn" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    if (!(await copyText(hereUrl()))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className={`${className} copy-link${copied ? " is-copied" : ""}`} onClick={copy} title="Copy the link to this page">
      {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}
