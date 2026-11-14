/**
 * The app ecosystem: linked learning apps. Each keeps its own data on the device;
 * they connect through links. Same list as DSA Atlas (packages/shared/src/ecosystem.ts)
 * and Structura; when an app is added, update all three. See docs/ecosystem.md.
 */
import structuraTopics from "./data/structura-topics.json";

export type EcoAppId = "structura" | "dsa-atlas" | "schemata";

export interface EcoApp {
  id: EcoAppId;
  name: string;
  url: string;
  tagline: string;
  /** Accent used for the app's tile in the switcher. */
  color: string;
}

export const THIS_APP: EcoAppId = "schemata";

export const ECOSYSTEM: EcoApp[] = [
  { id: "dsa-atlas", name: "DSA Atlas", url: "https://dsa-atz.netlify.app", tagline: "DSA notes: brute force → optimal, complexity, revision", color: "#34d399" },
  { id: "structura", name: "Structura", url: "https://structura-web.netlify.app", tagline: "System design you can see working", color: "#a78bfa" },
  { id: "schemata", name: "Schemata", url: "https://schemata-web.netlify.app", tagline: "Databases: SQL editor, interview questions, roadmap", color: "#38bdf8" },
];

export const appUrl = (id: EcoAppId) => ECOSYSTEM.find((a) => a.id === id)!.url;

export interface StructuraTopic {
  id: string;
  title: string;
  blurb: string;
}
const structuraById = new Map((structuraTopics as StructuraTopic[]).map((t) => [t.id, t]));
export const structuraTitle = (id: string) => structuraById.get(id)?.title ?? id;

/** Deep links into the other apps. Keep stable: documented in docs/ecosystem.md. */
export const ecoLinks = {
  structuraTopic: (topicId: string) => `${appUrl("structura")}/?topic=${encodeURIComponent(topicId)}`,
  dsaPattern: (pattern: string) => `${appUrl("dsa-atlas")}/?page=checklist&pattern=${encodeURIComponent(pattern)}`,
};

/** A link to a related topic in another app, shown as a card. */
export type EcoRef = { app: "structura"; topic: string } | { app: "dsa-atlas"; pattern: string };

export function ecoRef(ref: EcoRef): { href: string; title: string; app: EcoApp } {
  const app = ECOSYSTEM.find((a) => a.id === ref.app)!;
  return ref.app === "structura"
    ? { href: ecoLinks.structuraTopic(ref.topic), title: structuraTitle(ref.topic), app }
    : { href: ecoLinks.dsaPattern(ref.pattern), title: `${ref.pattern} problems`, app };
}
