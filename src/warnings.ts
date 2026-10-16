/** @prose
 * # Warnings
 *
 * What a repository's text gets wrong, by file and line. markz reports what it can't read in a
 * Markdown text, like a reference link or a repeated id. prose adds its own few, like a `nav`
 * name that isn't a doc. Each has a stable code, its place, what's wrong, and what to write
 * instead ([usage](../docs/usage.md#warnings)).
 *
 * A finding is a warning or a note. A warning is a fault a machine can be sure of, so
 * `prose check` fails on it. A note is advice on style, which it prints but passes
 * ([notes.ts](notes.ts)). `prose build` prints both, and `prose .` lists a page's own at its foot
 * ([cli.ts](cli.ts)). The text is parsed again for them, apart from rendering, so a page is
 * rendered the same whether or not anyone asks.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type WarningCode as MarkzCode } from "@amitkaps/markz";
import { docsNav } from "./nav.js";
import { textNotes, type NoteCode } from "./notes.js";
import type { ProseComment } from "./parser.js";
import { extensionOf, fileToNode, isSource } from "./tree.js";

/** prose's own codes. markz's are in its reference, and none share a name. */
export type ProseCode = "nav-missing" | "uncommitted" | "out-not-ignored";
export type WarningCode = MarkzCode | ProseCode | NoteCode;

export interface Warning {
  code: WarningCode;
  /** A note is advice that `check` prints but passes. Without a level, it's a warning. */
  level?: "note";
  message: string;
  /** The form to write instead, as markz words it: a noun, like `inline links`. */
  instead?: string;
  /** The file, repo-relative. A warning about the build as a whole has none. */
  path?: string;
  line?: number;
  column?: number;
}

/** `docs/x.md:3:5: reference-link: reference link; write inline links`, one warning a line, as a
 *  compiler writes it, so an editor's terminal links the place. */
export function formatWarning(w: Warning): string {
  const place = w.path
    ? `${w.path}${w.line ? `:${w.line}${w.column ? `:${w.column}` : ""}` : ""}: `
    : "";
  return `${place}${w.code}: ${w.message}${w.instead ? `; write ${w.instead}` : ""}`;
}

/** `2 warnings and 1 note`, leaving out a level with none. */
export function tally(found: Warning[]): string {
  const notes = found.filter((w) => w.level === "note").length;
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [];
  if (found.length > notes) parts.push(count(found.length - notes, "warning"));
  if (notes) parts.push(count(notes, "note"));
  return parts.join(" and ");
}

/** The 1-based line and column of `offset` in `text`. */
export function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: offset - lineStart + 1 };
}

/** A finding at an offset in the text it was found in, before it has a place in a file. */
type Found = Omit<Warning, "path" | "line" | "column"> & { start: number };

/** A text's markz warnings and its notes, from one parse, in the order they occur. */
function textFindings(text: string): Found[] {
  const doc = parse(text);
  const warnings: Found[] = doc.warnings.map((w) => ({
    code: w.code,
    message: w.message,
    instead: w.instead || undefined,
    start: w.start,
  }));
  const notes: Found[] = textNotes(doc).map((n) => ({ ...n, level: "note" }));
  return [...warnings, ...notes].sort((a, b) => a.start - b.start);
}

/** A Markdown file's warnings and notes. The whole file is parsed, metadata included, so a line
 *  is the file's own. */
export function markdownWarnings(path: string, source: string): Warning[] {
  return textFindings(source).map(({ start, ...w }) => ({
    ...w,
    path,
    ...position(source, start),
  }));
}

/** @prose
 * ## A comment's place in its file
 *
 * A comment's prose is its body, with the delimiters, the marker and each line's gutter taken
 * off. A body's lines are still the file's lines, one for one, from the first one with text. So
 * a warning's line in the body is found in the file by counting on from there. Its column is
 * found by where the body's line sits in the file's, after its gutter.
 */
export function commentWarnings(path: string, source: string, comments: ProseComment[]): Warning[] {
  const lines = source.split("\n").map((line) => line.replace(/\r$/, ""));
  const found: Warning[] = [];
  for (const comment of comments) {
    const body = comment.body.split("\n");
    let start = position(source, comment.start).line - 1;
    while (start < lines.length && !lines[start]!.includes(body[0]!)) start++;
    for (const { start: offset, ...w } of textFindings(comment.body)) {
      const at = position(comment.body, offset);
      const line = lines[start + at.line - 1] ?? "";
      const text = body[at.line - 1] ?? "";
      const gutter = line.endsWith(text)
        ? line.length - text.length
        : Math.max(0, line.indexOf(text));
      found.push({ ...w, path, line: start + at.line, column: gutter + at.column });
    }
  }
  return found;
}

/** One file's warnings: a Markdown file's, or a source file's prose comments'. A file that isn't
 *  read for prose has none. */
export function fileWarnings(root: string, path: string): Warning[] {
  if (!isSource(root, path)) return [];
  if (extensionOf(path) === "md") {
    return markdownWarnings(path, readFileSync(join(root, path), "utf-8"));
  }
  const node = fileToNode(root, path);
  return commentWarnings(path, node.source ?? "", node.comments ?? []);
}

/** @prose
 * ## Text someone else wrote
 *
 * A repository can hold Markdown it didn't write, like a test corpus of other projects' docs.
 * Git already has a way to say so. `linguist-vendored` or `linguist-generated` in
 * `.gitattributes` is what GitHub reads to leave a file out of a repository's languages. A file
 * marked either way isn't checked, and its page still reads as any other. Outside a git
 * repository, every file is checked.
 */
function othersText(repo: string, files: string[]): Set<string> {
  const marked = new Set<string>();
  if (files.length === 0) return marked;
  try {
    const out = execFileSync(
      "git",
      ["check-attr", "-z", "--stdin", "linguist-vendored", "linguist-generated"],
      { cwd: repo, input: files.join("\0"), encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    ).split("\0");
    for (let i = 0; i + 2 < out.length; i += 3) {
      if (out[i + 2] === "set" || out[i + 2] === "true") marked.add(out[i]!);
    }
  } catch {
    // Not a git repository: nothing is marked.
  }
  return marked;
}

/** Every warning in a repository's text, in file order. The bar's own come first, and a markz
 *  warning they already name isn't repeated. The files are read from `root`, and their
 *  attributes from `repo`, which a build's export doesn't have. */
export function contentWarnings(root: string, files: string[], repo: string = root): Warning[] {
  const found: Warning[] = [];
  docsNav(root, files, found);
  const named = new Set(found.map((w) => `${w.path}:${w.line}:${w.code}`));
  const skipped = othersText(repo, files);
  for (const path of files) {
    if (skipped.has(path)) continue;
    for (const w of fileWarnings(root, path)) {
      if (!named.has(`${w.path}:${w.line}:${w.code}`)) found.push(w);
    }
  }
  return found;
}

/** One page's warnings on `prose .`: its file's, unless the file is someone else's text. */
export function pageWarnings(root: string, path: string): Warning[] {
  return othersText(root, [path]).has(path) ? [] : fileWarnings(root, path);
}
