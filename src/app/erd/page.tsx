import type { Metadata } from "next";
import { ErdLoader } from "../loaders";

export const metadata: Metadata = { title: "Schema diagrams", description: "Write DBML and see the ER diagram as you type. Draw any dataset, or share a schema as a link." };

export default function ErdRoute() {
  return <ErdLoader />;
}
