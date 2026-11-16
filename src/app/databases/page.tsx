import type { Metadata } from "next";
import { Databases } from "../../views/Learn";

export const metadata: Metadata = { title: "Database guide", description: "When to use PostgreSQL, MySQL, MongoDB, Redis, Cassandra and the rest, and who does." };

export default function DatabasesPage() {
  return <Databases />;
}
