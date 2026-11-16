import type { Metadata } from "next";
import { Suspense } from "react";
import { Questions } from "../../views/Learn";

export const metadata: Metadata = { title: "Practice", description: "SQL, schema design and theory interview questions, easy to hard, checked automatically." };

export default function QuestionsPage() {
  return (
    <Suspense>
      <Questions />
    </Suspense>
  );
}
