import type { Metadata } from "next";
import { Sources } from "../../views/Sources";

export const metadata: Metadata = { title: "Data sources" };

export default function SourcesPage() {
  return <Sources />;
}
