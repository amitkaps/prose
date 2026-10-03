/** @prose
 * # Syntax highlighting
 *
 * Code is highlighted on the server, in the page's own palette. One render serves both light and
 * dark, since each token carries a class, like `keyword`, and the stylesheet sets its colour for
 * either.
 *
 * Each language has its own small tokenizer in [languages/](languages/), for the languages a
 * repository here is likely to hold. They replaced shiki, whose grammars and regex engine came to
 * about 18 MB installed. A page is now quick enough to highlight that nothing is cached. An
 * unknown language is plain text.
 */
import { css } from "./languages/css.js";
import { ebnf } from "./languages/ebnf.js";
import { js, json } from "./languages/js.js";
import { markdown } from "./languages/markdown.js";
import { markup } from "./languages/markup.js";
import type { Colour, Span } from "./languages/scan.js";
import { gitignore, toml, yaml } from "./languages/config.js";
import { shell } from "./languages/shell.js";

const LANGUAGES: Record<string, (code: string) => Span[]> = {
  js,
  css: (code) => css(code),
  html: (code) => markup(code),
  svelte: (code) => markup(code, true),
  md: (code) => markdown(code, spansFor),
  yaml,
  toml,
  json,
  sh: shell,
  ebnf,
  gitignore,
};

/** Each extension or fence name, and the language it's read as. */
const ALIASES: Record<string, string> = {
  javascript: "js",
  mjs: "js",
  cjs: "js",
  ts: "js",
  typescript: "js",
  mts: "js",
  cts: "js",
  markdown: "md",
  yml: "yaml",
  jsonc: "json",
  bash: "sh",
  zsh: "sh",
  shell: "sh",
  shellscript: "sh",
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The language for a file extension or a fence's info string. Unknown ones are plain text. */
export function langFor(name: string): string {
  const lower = name.toLowerCase();
  const lang = ALIASES[lower] ?? lower;
  return LANGUAGES[lang] ? lang : "text";
}

function spansFor(code: string, lang: string): Span[] {
  const tokenize = LANGUAGES[langFor(lang)];
  if (!tokenize) return [];
  // A tokenizer's mistake costs colour, not the page.
  try {
    return tokenize(code);
  } catch {
    return [];
  }
}

/** @prose
 * # Lines
 *
 * Each line is its own `<span class="line">`, which the stylesheet numbers and wraps. So a token
 * that spans lines, like a block comment, is closed at each line's end and opened again on the
 * next. Spans arrive in any order, and one that overlaps an earlier one is dropped.
 */
function render(code: string, spans: Span[]): string {
  const lines: string[] = [];
  let line = "";
  const emit = (text: string, colour: Colour | null): void => {
    text.split("\n").forEach((piece, i) => {
      if (i > 0) {
        lines.push(line);
        line = "";
      }
      if (piece)
        line += colour ? `<span class="${colour}">${escapeHtml(piece)}</span>` : escapeHtml(piece);
    });
  };
  let at = 0;
  for (const span of spans.toSorted((a, b) => a.start - b.start)) {
    if (span.start < at || span.end <= span.start) continue;
    if (span.start > at) emit(code.slice(at, span.start), null);
    emit(code.slice(span.start, span.end), span.colour);
    at = span.end;
  }
  emit(code.slice(at), null);
  lines.push(line);
  return lines.map((l) => `<span class="line">${l}</span>`).join("\n");
}

/** Highlights `code` as `lang`, an extension or a fence name. */
export function highlight(code: string, lang: string): string {
  const text = code.replace(/\r\n/g, "\n");
  return `<pre class="highlighted"><code>${render(text, spansFor(text, lang))}</code></pre>`;
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
 * # Code samples in Markdown
 *
 * markz renders a fence as escaped `<pre><code class="language-…">`. Each one is swapped for the
 * highlighted code, so a code sample in a doc looks like the code on a source page.
 */
export function highlightFences(html: string): string {
  return html.replace(FENCE_RE, (_, lang: string | undefined, code: string) =>
    highlight(unescapeHtml(code).replace(/\n$/, ""), lang ?? "text"),
  );
}
