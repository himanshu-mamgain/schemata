"use client";
import { useEffect, useRef } from "react";
import { editorTheme, monaco } from "./monaco";
import { useTheme } from "../theme";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Ctrl/Cmd+Enter. Gets the selected text when there is a selection, else everything. */
  onRun?: (sql: string) => void;
  language?: string;
  height?: number | string;
  /** Problems to underline, e.g. DBML parse errors (1-based lines and columns). */
  markers?: { line: number; column: number; endLine: number; endColumn: number; message: string }[];
}

export function SqlEditor({ value, onChange, onRun, language = "pgsql", height = 260, markers }: Props) {
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
      theme: editorTheme(theme),
      minimap: { enabled: false },
      fontSize: 14,
      // next/font gives the mono font a generated family name, kept in --font-mono.
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "Consolas, monospace",
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: language === "dbml" ? "off" : "on",
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
    monaco.editor.setTheme(editorTheme(theme));
  }, [theme]);

  useEffect(() => {
    const model = editor.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      "schemata",
      (markers ?? []).map((m) => ({
        startLineNumber: m.line,
        startColumn: m.column,
        endLineNumber: m.endLine,
        endColumn: Math.max(m.endColumn, m.column + 1),
        message: m.message,
        severity: monaco.MarkerSeverity.Error,
      })),
    );
  }, [markers, value]);

  return <div className="editor" ref={host} style={{ height }} />;
}
