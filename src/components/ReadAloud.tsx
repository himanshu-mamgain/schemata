"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";

// Reads the page aloud with the phone's own voices (the Web Speech API): free, offline on most
// phones, and nothing leaves the device.

const SKIP =
  'pre, code, table, svg, canvas, button, nav, figure, details, textarea, .crumbs, .tags, .read-aloud, .page-actions, .copy-link, .qlist, .next, .eco, .erd-block, .react-flow, .steps, .cm-editor, .monaco-editor, [aria-hidden="true"], [data-no-read]';
const READ = "h1, h2, h3, h4, p, li, blockquote, dt, dd";

export function readableText(root: HTMLElement): string {
  const parts: string[] = [];
  root.querySelectorAll<HTMLElement>(READ).forEach((el) => {
    if (el.closest(SKIP)) return;
    const clone = el.cloneNode(true) as HTMLElement;
    // Blocks inside this one (a nested list, a quote's paragraphs) are read on their own turn.
    clone.querySelectorAll(READ).forEach((c) => c.remove());
    clone.querySelectorAll("ul, ol").forEach((c) => c.remove());
    clone.querySelectorAll(SKIP).forEach((c) => {
      // Inline code is part of the sentence ("add an index on `email`"): keep its words.
      if (c.tagName === "CODE" && !c.closest("pre")) c.replaceWith(c.textContent ?? "");
      else c.remove();
    });
    let text = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!/[.!?:;]$/.test(text)) text += ".";
    parts.push(text);
  });
  return parts.join(" ");
}

// Chrome on Android stops long utterances part-way, so speak a sentence or two at a time.
function chunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 220 && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const lang = navigator.language || "en-US";
  return (
    voices.find((v) => v.lang === lang && v.localService) ??
    voices.find((v) => v.lang.startsWith("en") && v.localService) ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

type State = "idle" | "playing" | "paused";

export function ReadAloud({ target }: { target?: string }) {
  const [state, setState] = useState<State>("idle");
  const [supported, setSupported] = useState(false);
  const self = useRef<HTMLDivElement>(null);
  const run = useRef(0);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (run.current) window.speechSynthesis.cancel();
      run.current = 0;
    };
  }, []);

  if (!supported) return null;

  const stop = () => {
    run.current = 0;
    window.speechSynthesis.cancel();
    setState("idle");
  };

  const start = () => {
    const root = (target ? document.querySelector<HTMLElement>(target) : null) ?? self.current?.closest("article");
    if (!root) return;
    const parts = chunks(readableText(root));
    if (!parts.length) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = Date.now();
    run.current = id;
    const voice = pickVoice();
    let i = 0;
    const next = () => {
      if (run.current !== id) return;
      if (i >= parts.length) {
        run.current = 0;
        setState("idle");
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "en-US";
      u.rate = 1;
      u.onend = next;
      u.onerror = (e) => {
        // "interrupted" and "canceled" mean we stopped it on purpose.
        if (e.error === "interrupted" || e.error === "canceled") return;
        next();
      };
      synth.speak(u);
    };
    setState("playing");
    next();
  };

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (state === "idle") start();
    else if (state === "playing") {
      synth.pause();
      setState("paused");
    } else {
      synth.resume();
      setState("playing");
    }
  };

  return (
    <div className="read-aloud" ref={self}>
      <button className="btn" onClick={toggle} title="Read this page aloud, in your phone's voice">
        {state === "playing" ? <Pause size={16} /> : state === "paused" ? <Play size={16} /> : <Volume2 size={16} />}
        {state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Read aloud"}
      </button>
      {state !== "idle" && (
        <button className="btn" onClick={stop} title="Stop reading">
          <Square size={14} /> Stop
        </button>
      )}
    </div>
  );
}
