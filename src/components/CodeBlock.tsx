"use client";
import { useEffect, useState } from "react";

/**
 * Read-only code (examples in the guide). The page is prerendered with the plain
 * text; in the browser Monaco's colorizer adds syntax colours.
 */
export function CodeBlock({ code, language = "pgsql" }: { code: string; language?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("../editor/monaco")
      .then(async ({ monaco }) => {
        if (language === "dbml") await import("../erd/dbml-language");
        return monaco.editor.colorize(code, language, { tabSize: 2 });
      })
      .then((h) => live && setHtml(h))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code, language]);
  return html ? <pre className="code" dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="code">{code}</pre>;
}
