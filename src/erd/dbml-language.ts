/** DBML highlighting in Monaco, from @dbml/parse (the same rules dbdiagram.io uses). */
import { dbmlLanguageConfig, dbmlMonarchTokensProvider } from "@dbml/parse";
import { monaco } from "../editor/monaco";

if (!monaco.languages.getLanguages().some((l) => l.id === "dbml")) {
  monaco.languages.register({ id: "dbml", extensions: [".dbml"] });
  monaco.languages.setMonarchTokensProvider("dbml", dbmlMonarchTokensProvider as unknown as Parameters<typeof monaco.languages.setMonarchTokensProvider>[1]);
  monaco.languages.setLanguageConfiguration("dbml", dbmlLanguageConfig as unknown as Parameters<typeof monaco.languages.setLanguageConfiguration>[1]);
}
