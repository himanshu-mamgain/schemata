import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QUESTIONS, questionById } from "../../../content/questions";
import { QuestionPage } from "../../../views/QuestionPage";

export const dynamicParams = false;
export const generateStaticParams = () => QUESTIONS.map((q) => ({ id: q.id }));

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const q = questionById((await params).id);
  return q ? { title: q.title, description: q.prompt } : {};
}

export default async function QuestionRoute({ params }: Props) {
  const { id } = await params;
  if (!questionById(id)) notFound();
  return <QuestionPage id={id} />;
}
