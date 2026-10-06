/** @prose
 * # Parsing `@prose` comments
 *
 * Finds the `@prose` comments in one source file, each language its own way. A file comes back
 * as its comments in source order, each with its Markdown body and the byte span it took. The
 * first is the file's summary, and the renderer lays out the code around them.
 *
 * What counts as a prose comment is [writing](../docs/writing.md#in-each-language). This file is
 * how it's read.
 */
import { lexJs } from "./lexer.js";

export interface ProseComment {
  /** The comment's Markdown, without its delimiters, gutter or marker. */
  body: string;
  /** Byte span `[start, end)` of the comment in the file. */
  start: number;
  end: number;
}

const MARKER = "@prose";

/** @prose
 * # Recognizing a prose comment
 *
 * A comment counts only if its first line, trimmed, starts with `@prose`. Any other comment
 * returns `null` and stays an ordinary comment, like unmarked JSDoc, `//` or a tool pragma. Each
 * style strips its own gutter before this runs. That's JS's ` * `, YAML's `# `, and none for
 * HTML. Blank lines at either edge of the body are dropped, and a CRLF file's `\r` stays out.
 */
function extractMarkedFromLines(rawLines: string[]): string | null {
  const lines = rawLines.map((line) => line.replace(/\r$/, ""));
  const trimmedFirst = lines[0]!.trim();
  if (!trimmedFirst.startsWith(MARKER)) return null;
  let rest = trimmedFirst.slice(MARKER.length);
  if (rest.startsWith(" ")) rest = rest.slice(1);
  const out: string[] = [];
  if (rest.length > 0) out.push(rest);
  for (let i = 1; i < lines.length; i++) out.push(lines[i]!);
  while (out.length && out[0]!.trim() === "") out.shift();
  while (out.length && out.at(-1)!.trim() === "") out.pop();
  return out.join("\n");
}

function extractMarkedBlock(inner: string, stripContinuation: boolean): string | null {
  const lines = inner.split("\n");
  const stripped = lines.map((line, i) =>
    i === 0 || !stripContinuation ? line : line.replace(/^[ \t]*\*[ \t]?/, ""),
  );
  const body = extractMarkedFromLines(stripped);
  // `*/` would end the comment, so a block spells it `*\/`; the prose has it as written.
  return body === null || !stripContinuation ? body : body.replaceAll("*\\/", "*/");
}

/** Whether only indentation precedes `index` on its line. */
function startsLine(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  return /^[ \t]*$/.test(source.slice(lineStart, index));
}

/** @prose
 * # Scanning JS and TS
 *
 * The comments come from [lexer.ts](lexer.ts), which skips strings, template literals and regex
 * literals whole. So a comment-shaped string or a `/` in a regex can't be misread as a comment.
 * The lexer replaced `oxc-parser`, whose native binary was too heavy for a comment list.
 */
function scanJs(source: string): ProseComment[] {
  const found: ProseComment[] = [];
  for (const token of lexJs(source)) {
    if (token.kind !== "comment" || !source.startsWith("/**", token.start)) continue;
    const text = source.slice(token.start, token.end);
    if (!text.endsWith("*/") || text.length < 5) continue;
    const body = extractMarkedBlock(text.slice(3, -2), true);
    if (body !== null) found.push({ body, start: token.start, end: token.end });
  }
  return found;
}

/** @prose
 * # Scanning CSS
 *
 * CSS has no parser here, only a pass that skips strings and comments, so a `/*` inside a
 * string isn't read as a comment.
 */
function scanCss(source: string): ProseComment[] {
  const found: ProseComment[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < n && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
      i++;
    } else if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      const text = source.slice(i, end);
      const body = text.startsWith("/**")
        ? extractMarkedBlock(text.slice(3, text.endsWith("*/") ? -2 : undefined), true)
        : null;
      if (body !== null) found.push({ body, start: i, end });
      i = end;
    } else {
      i++;
    }
  }
  return found;
}

/** The languages whose comments are `#` lines, by extension (`.gitignore` is read as `gitignore`). */
const HASH_EXTENSIONS = new Set(["yaml", "yml", "toml", "gitignore"]);

/** @prose
 * # Scanning `#` comments
 *
 * YAML, TOML and `.gitignore` have only `#` line comments, with no closing delimiter, so the
 * marker sets the boundary. A comment starts at a `# @prose` line and runs through the `#` lines
 * after it, up to the next marker line or the first line that isn't a comment. So two comments
 * can sit back to back without the second joining the first.
 */
function scanHashComments(source: string): ProseComment[] {
  const found: ProseComment[] = [];
  const lines = source.split("\n");
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  const isComment = (line: string): boolean => /^[ \t]*#/.test(line);
  const stripHash = (line: string): string => line.replace(/^[ \t]*#[ \t]?/, "");
  const isMarkerLine = (line: string): boolean => stripHash(line).trim().startsWith(MARKER);

  let i = 0;
  while (i < lines.length) {
    if (!isComment(lines[i]!) || !isMarkerLine(lines[i]!)) {
      i++;
      continue;
    }
    const first = i;
    const commentLines = [stripHash(lines[i]!)];
    i++;
    while (i < lines.length && isComment(lines[i]!) && !isMarkerLine(lines[i]!)) {
      commentLines.push(stripHash(lines[i]!));
      i++;
    }
    const body = extractMarkedFromLines(commentLines);
    if (body !== null) {
      // The comment ends right after its last line's content, before the line ending, as a
      // `*/` or `-->` does in the other styles.
      const last = i - 1;
      const start = lineOffsets[first]! + lines[first]!.indexOf("#");
      const end = lineOffsets[last]! + lines[last]!.replace(/\r$/, "").length;
      found.push({ body, start, end });
    }
  }
  return found;
}

/** Scans HTML source for `<!-- @prose … -->` comments. */
function scanHtml(source: string): ProseComment[] {
  const found: ProseComment[] = [];
  const re = /<!--([\s\S]*?)-->/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const body = extractMarkedBlock(match[1]!, false);
    if (body !== null) {
      found.push({ body, start: match.index, end: match.index + match[0].length });
    }
  }
  return found;
}

/** @prose
 * # Scanning `.html` and `.svelte` files
 *
 * Both split into parts the same way, by regex, so a `<script>` inside a `<template>` is found too. Each part follows its own language's rule. The `<script>` and `<style>` bodies are read as TS
 * and CSS, everything else as HTML, and the comments merge back in source order.
 */
function scanParts(source: string): ProseComment[] {
  const found: ProseComment[] = [];
  for (const part of markupParts(source)) {
    const text = source.slice(part.start, part.end);
    const inPart =
      part.kind === "markup"
        ? scanHtml(text)
        : part.kind === "style"
          ? scanCss(text)
          : scanJs(text);
    for (const c of inPart) {
      found.push({ body: c.body, start: c.start + part.start, end: c.end + part.start });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** A markup file's parts in order: each `<script>` and `<style>` body, and the markup between
 *  them (tags included in the markup, which is scanned as HTML). */
function markupParts(
  source: string,
): { kind: "script" | "style" | "markup"; start: number; end: number }[] {
  const parts: { kind: "script" | "style" | "markup"; start: number; end: number }[] = [];
  const tagRe = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(source))) {
    const [full, tagName, inner] = match as unknown as [string, string, string];
    const inside = match.index + full.indexOf(inner);
    parts.push({ kind: "markup", start: last, end: match.index });
    parts.push({ kind: tagName as "script" | "style", start: inside, end: inside + inner.length });
    last = match.index + full.length;
  }
  parts.push({ kind: "markup", start: last, end: source.length });
  return parts;
}

/** @prose
 * # A file's comments
 *
 * A comment counts when it starts its own line, at any depth, in every language. So a class can
 * read method by method, and a comment that shares its line with code, like
 * `call(/** @prose … *\/ x)`, stays part of that code. This one rule replaced a statement walk
 * for JS and a brace counter for CSS, which each drew the line by depth instead.
 */
export function parseFile(source: string, extension: string): ProseComment[] {
  const found =
    extension === "html" || extension === "svelte"
      ? scanParts(source)
      : HASH_EXTENSIONS.has(extension)
        ? scanHashComments(source)
        : extension === "css"
          ? scanCss(source)
          : scanJs(source);
  return found.filter((c) => startsLine(source, c.start));
}

/** Returns the first Markdown paragraph of `text`, skipping a leading heading line, for use as a summary. */
export function firstParagraph(text: string): string {
  const withoutTitle = text.replace(/^#{1,6}\s+.*(\n|$)/, "").trim();
  const paragraph = withoutTitle.split(/\n\s*\n/)[0] ?? "";
  return paragraph.trim();
}
