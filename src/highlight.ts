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
import { type Document, html, walk } from "@amitkaps/markz";
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

/** @prose
 * # Code samples in Markdown
 *
 * A code sample in a doc is highlighted like the code on a source page. markz writes each fence
 * as escaped `<pre><code class="language-…">`, and that's swapped for the highlighted code.
 *
 * The code and its language come from markz's parse, not from reading the HTML back. From a
 * fence's node, the exact text markz wrote for it is known, so it's found by that text, in source
 * order. Nothing is unescaped or guessed. A raw `=html` block or display math also writes
 * `<pre><code>`, and neither can be mistaken for a fence. Matching every `<pre><code>` in the HTML
 * was ruled out for that reason.
 */
export function markdownHtml(doc: Document): string {
  let out = html(doc);
  let at = 0;
  walk(doc, {
    enter(node) {
      if (doc.type(node) !== "code") return true;
      const { lang, value } = doc.data(node, "code");
      const attr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      const written = `<pre><code${attr}>${escapeHtml(value)}</code></pre>`;
      const found = out.indexOf(written, at);
      if (found === -1) return false;
      const highlighted = highlight(value.replace(/\n$/, ""), lang ?? "text");
      out = out.slice(0, found) + highlighted + out.slice(found + written.length);
      at = found + highlighted.length;
      return false;
    },
  });
  return out;
}
