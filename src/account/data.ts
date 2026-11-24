import { answers, deletedQueries, designs, edited, fromYourAccount, lessonsRead, savedQueries, solved } from "../store";
import type { SchemataData } from "./merge";

// Reads and writes the part of localStorage that syncs with your Studia account (merge.ts).

const withTimes = (texts: Record<string, string>, kind: "answer" | "design", times: Record<string, number>) =>
  Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, { text, at: times[`${kind}:${id}`] ?? 0 }]));

/** Everything to sync, from this device. */
export function snapshot(): SchemataData {
  const times = edited.get();
  return {
    version: 1,
    solved: solved.get(),
    lessonsRead: lessonsRead.get(),
    answers: withTimes(answers.get(), "answer", times),
    designs: withTimes(designs.get(), "design", times),
    savedQueries: savedQueries.get(),
    deletedQueries: deletedQueries.get(),
  };
}

/** Writes the merged copy here, without counting it as your change. */
export function applySnapshot(next: SchemataData) {
  const times: Record<string, number> = { ...edited.get() };
  for (const [id, a] of Object.entries(next.answers)) times[`answer:${id}`] = a.at;
  for (const [id, d] of Object.entries(next.designs)) times[`design:${id}`] = d.at;
  fromYourAccount(() => {
    solved.set(next.solved);
    lessonsRead.set(next.lessonsRead ?? {});
    answers.set(Object.fromEntries(Object.entries(next.answers).map(([id, a]) => [id, a.text])));
    designs.set(Object.fromEntries(Object.entries(next.designs).map(([id, d]) => [id, d.text])));
    edited.set(times);
    savedQueries.set(next.savedQueries);
    deletedQueries.set(next.deletedQueries);
  });
}
