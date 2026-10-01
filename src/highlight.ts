/** @prose
 * # Syntax highlighting
 *
 * Code is highlighted on the server with shiki, with only the languages a repository here is
 * likely to hold, and in the page's own palette, so one render serves light and dark.
 *
 * It comes in through `shiki/core`, not the full bundle of every grammar. The theme is shiki's
 * CSS-variables theme: each token's colour is a variable, set in `style.css` for light and for
 * dark, so code and page follow the reader's setting without a second render. The highlighter
 * is created on first use and kept for the life of the server.
 *
 * It's the cost of a page: a 1,300-line TypeScript file takes about 0.4 s with the WASM regex
 * engine, 1.1 s with the JavaScript one. So the WASM engine, and a cache of highlighted runs keyed
 * by their text: after an edit, only the code that changed is highlighted again, and a key made
 * of the text can never serve a stale result.
 */
import { createCssVariablesTheme, createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

const LANGS: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  css: "css",
  html: "html",
  svelte: "svelte",
  md: "markdown",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  json: "json",
  jsonc: "jsonc",
  sh: "shellscript",
  bash: "shellscript",
  text: "text",
};

const THEME = createCssVariablesTheme({
  name: "prose-code",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

let highlighter: Promise<HighlighterCore> | null = null;
const cache = new Map<string, string>();
const CACHE_SIZE = 2000;

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [THEME],
    langs: [
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/svelte.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/toml.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/jsonc.mjs"),
      import("shiki/langs/shellscript.mjs"),
    ],
    engine: createOnigurumaEngine(import("shiki/wasm")),
  });
  return highlighter;
}

/** Creates the highlighter ahead of the first page that needs it. */
export async function warmHighlighter(): Promise<void> {
  await getHighlighter().catch(() => {});
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The shiki language for a file extension or a fence's info string; unknown ones are plain text. */
export function langFor(name: string): string {
  return LANGS[name.toLowerCase()] ?? "text";
}

/** Highlights `code` as `lang` (an extension or a shiki name). Falls back to escaped plain text if
 *  shiki fails, so a grammar problem costs colour, not the page. */
export async function highlight(code: string, lang: string): Promise<string> {
  const name = LANGS[lang] ? LANGS[lang]! : lang;
  const key = `${name}\0${code}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  try {
    const h = await getHighlighter();
    const known = h.getLoadedLanguages().includes(name) ? name : "text";
    const html = h.codeToHtml(code, { lang: known, theme: "prose-code" });
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, html);
    return html;
  } catch {
    const lines = code.split("\n").map((line) => `<span class="line">${escapeHtml(line)}</span>`);
    return `<pre class="shiki"><code>${lines.join("\n")}</code></pre>`;
  }
}

const FENCE_RE = /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g;

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** @prose
 * Fenced code in rendered Markdown arrives as `<pre><code class="language-…">`, escaped. Each one
 * is swapped for shiki's output, so a code sample in a doc looks like the code in a source page.
 */
export async function highlightFences(html: string): Promise<string> {
  const matches = [...html.matchAll(FENCE_RE)];
  if (matches.length === 0) return html;
  const rendered = await Promise.all(
    matches.map((m) => highlight(unescapeHtml(m[2]!).replace(/\n$/, ""), langFor(m[1] ?? "text"))),
  );
  let i = 0;
  return html.replace(FENCE_RE, () => rendered[i++]!);
}
