import type { Metadata } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { TOPICS } from "../../../content/topics";
import { TopicPage } from "../../../views/Learn";

export const dynamicParams = false;
export const generateStaticParams = () => TOPICS.map((t) => ({ id: t.id }));

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = TOPICS.find((x) => x.id === id);
  return t ? { title: t.title, description: t.blurb } : {};
}

/** A roadmap stage's lesson (src/content/lessons/<id>.md), read when the page is built. */
function lesson(id: string): string | undefined {
  const file = join(process.cwd(), "src", "content", "lessons", `${id}.md`);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

export default async function TopicRoute({ params }: Props) {
  const { id } = await params;
  if (!TOPICS.some((t) => t.id === id)) notFound();
  return <TopicPage id={id} lesson={lesson(id)} />;
}
