import { useEffect, useRef, useState } from "react";
import { monaco } from "./monaco";
import { useTheme } from "../theme";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Ctrl/Cmd+Enter. Gets the selected text when there is a selection, else everything. */
  onRun?: (sql: string) => void;
  language?: string;
  height?: number | string;
}

export function SqlEditor({ value, onChange, onRun, language = "pgsql", height = 260 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const theme = useTheme();

  useEffect(() => {
    const ed = monaco.editor.create(host.current!, {
      value,
      language,
      theme: theme === "light" ? "schemata-light" : "schemata-dark",
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: "on",
      padding: { top: 10, bottom: 10 },
      renderLineHighlight: "line",
      fixedOverflowWidgets: true,
    });
    editor.current = ed;
    ed.onDidChangeModelContent(() => changeRef.current(ed.getValue()));
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const sel = ed.getSelection();
      const picked = sel && !sel.isEmpty() ? ed.getModel()!.getValueInRange(sel) : ed.getValue();
      runRef.current?.(picked);
    });
    return () => ed.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (e.g. "Open in editor", reset) replace the text; typing doesn't loop back.
  useEffect(() => {
    const ed = editor.current;
    if (ed && ed.getValue() !== value) ed.setValue(value);
  }, [value]);

  useEffect(() => {
    monaco.editor.setTheme(theme === "light" ? "schemata-light" : "schemata-dark");
  }, [theme]);

  return <div className="editor" ref={host} style={{ height }} />;
}

/** Read-only, syntax-highlighted code (examples in the guide). */
export function CodeBlock({ code, language = "pgsql" }: { code: string; language?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    monaco.editor.colorize(code, language, { tabSize: 2 }).then((h) => live && setHtml(h));
    return () => {
      live = false;
    };
  }, [code, language]);
  return html ? <pre className="code" dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="code">{code}</pre>;
}
