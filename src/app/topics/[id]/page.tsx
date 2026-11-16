import type { Metadata } from "next";
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

export default async function TopicRoute({ params }: Props) {
  const { id } = await params;
  if (!TOPICS.some((t) => t.id === id)) notFound();
  return <TopicPage id={id} />;
}
