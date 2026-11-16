import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaygroundLoader } from "../loaders";

export const metadata: Metadata = { title: "SQL editor", description: "A real PostgreSQL in your browser, with three datasets, query plans and saved queries." };

export default function PlaygroundPage() {
  return (
    <Suspense>
      <PlaygroundLoader />
    </Suspense>
  );
}
