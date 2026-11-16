/** Theme constants shared by the server layout (no React here) and theme.ts. */
export type Theme = "paper" | "blueprint" | "chalkboard";

export const THEME_KEY = "schemata:theme";
export const THEME_COLORS: Record<Theme, string> = { paper: "#f7f5ef", blueprint: "#0f2741", chalkboard: "#1f2b27" };

/** Runs in <head> before React: applies the saved theme so the first paint is right. */
export const themeBootScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="blueprint"&&t!=="chalkboard")t="paper";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t==="paper"?"light":"dark";var m=document.querySelector('meta[name="theme-color"]');m&&m.setAttribute("content",${JSON.stringify(THEME_COLORS)}[t])}catch(e){}`;
