"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { legacyPath } from "../routes";

/**
 * Older links put everything in the query (/?topic=indexing, /?q=…). Netlify redirects
 * them (netlify.toml); this does the same anywhere else, e.g. in development.
 */
export function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const to = legacyPath(location.search);
    if (to) router.replace(to);
  }, [router]);
  return null;
}
