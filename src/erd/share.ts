/** DBML in a link: /erd#dbml=<compressed>, so a schema (or a design problem) can be shared. */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export const shareHash = (dbml: string) => `#dbml=${compressToEncodedURIComponent(dbml)}`;

export function fromHash(hash: string): string | null {
  const m = /^#dbml=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    return decompressFromEncodedURIComponent(m[1]) || null;
  } catch {
    return null;
  }
}
