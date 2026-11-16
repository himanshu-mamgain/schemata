import type { Metadata } from "next";
import { Roadmap } from "../../views/Learn";

export const metadata: Metadata = { title: "Roadmap", description: "From your first SELECT to how databases work inside, in 11 stages." };

export default function RoadmapPage() {
  return <Roadmap />;
}
