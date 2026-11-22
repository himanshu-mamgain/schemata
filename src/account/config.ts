// The Studia account: one GitHub sign-in for Schemata, Structura and DSA Atlas, kept by
// Supabase (Auth, plus one progress row per app). With no Supabase settings at build time,
// the account button doesn't show and nothing changes.
// Set in Netlify's environment variables (see the README, "Studia account"); Next.js puts
// NEXT_PUBLIC_ values into the page at build time:
//   NEXT_PUBLIC_SUPABASE_URL               https://<project-ref>.supabase.co
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   the project's publishable key: public by design;
//                                          row-level security decides what each user may touch
//   NEXT_PUBLIC_STUDIA_URL                 the Studia site (https://studia-hub.netlify.app)
//   NEXT_PUBLIC_REQUIRE_SIGN_IN            "true": a signed-out visitor is sent to Studia's
//                                          login first, then back to the page they asked for
//   NEXT_PUBLIC_AUTH_COOKIE_DOMAIN         .studia.dev once the apps live there; empty until then

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN ?? "";
export const STUDIA_URL = (process.env.NEXT_PUBLIC_STUDIA_URL ?? "").replace(/\/+$/, "");

/** The cookie that holds the session. The same name in all three apps, so they can share it. */
export const COOKIE_NAME = "studia-auth";

/** This app's row in the shared `app_progress` table. */
export const APP_ID = "schemata";

export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Signing in and out happens on the Studia site. */
export const viaStudia = accountsEnabled && Boolean(STUDIA_URL);

/** Every page needs a signed-in learner (they're sent to Studia's login first). */
export const signInRequired = viaStudia && process.env.NEXT_PUBLIC_REQUIRE_SIGN_IN === "true";

/** Search engines and link previews read the pages without being sent to the login. */
export const CRAWLER = /bot\b|crawler|spider|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|WhatsApp|Slackbot|Twitterbot|LinkedInBot|Lighthouse/i;

/** This page's address without its #fragment, which Supabase uses to hand over a session. */
function here(): string {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

/** Studia's login, coming back to this page afterwards. */
export const studiaLogin = (next = here()) => `${STUDIA_URL}/login?app=${APP_ID}&next=${encodeURIComponent(next)}`;

/** Studia's sign-out, offering to sign back in to this app. */
export const studiaLogout = (next = window.location.origin + "/") => `${STUDIA_URL}/logout?app=${APP_ID}&next=${encodeURIComponent(next)}`;

/** Studia sent a session for this app in the address's fragment (#access_token=…&refresh_token=…). */
export function handoffTokens(): { access_token: string; refresh_token: string } | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

/** A session cookie is there (Supabase may split it into .0, .1 …). */
export const hasSessionCookie = () =>
  document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_NAME}=`) || c.trim().startsWith(`${COOKIE_NAME}.`));

/** Back from signing in, with a session, a one-time code or an error in the address. */
export function returningFromSignIn(): boolean {
  const q = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return q.has("code") || q.has("error_description") || hash.has("error_description") || Boolean(handoffTokens());
}

/**
 * Runs in <head> before the page paints (layout.tsx): with sign-in required and no session,
 * go straight to Studia's login, so you never see the page flash first. The same checks as
 * startAccount() in account.ts: not offline, not just back from a failed sign-in, not a crawler.
 */
export const accountBootScript = signInRequired
  ? `try{var c=document.cookie,h=location.hash,q=location.search;` +
    `if(navigator.onLine&&!${CRAWLER}.test(navigator.userAgent)` +
    `&&!/(^|; *)${COOKIE_NAME}[=.]/.test(c)&&!/access_token=|error_description=/.test(h)&&!/[?&](code|error_description)=/.test(q))` +
    `location.replace(${JSON.stringify(`${STUDIA_URL}/login?app=${APP_ID}&next=`)}+encodeURIComponent(location.origin+location.pathname+q))}catch(e){}`
  : "";
