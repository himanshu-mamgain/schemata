import { Fragment } from "react";

/** Just enough Markdown for the content files: **bold** and `code`. */
export function Markdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>,
      )}
    </p>
  );
}
