/** @prose
 * # Warnings
 *
 * What a repository's text gets wrong, by file and line. markz reports what it can't read in a
 * Markdown text, like a reference link. prose adds its own, on how prose is put together
 * ([structure.ts](structure.ts)) and on prose that's missing ([presence.ts](presence.ts)).
 *
 * Each has a stable code, its place, what's wrong, and what to write instead
 * ([usage](../docs/usage.md#warnings)).
 *
 * `prose build` prints them, `prose check` fails on them, and `prose .` lists a page's own at its
 * foot ([cli.ts](cli.ts)). The text is parsed again for them, apart from rendering, so a page is
 * rendered the same whether or not anyone asks. Advice on style isn't a warning, and only
 * `prose style` gives it ([style.ts](style.ts)).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type Document, type WarningCode as MarkzCode } from "@amitkaps/markz";
import { docsNav } from "./nav.js";
import type { ProseComment } from "./parser.js";
import {
  noProse,
  noReadme,
  shippedExports,
  undocumentedExports,
  PRESENCE_CODES,
  type PresenceCode,
} from "./presence.js";
import { STRUCTURE_CODES, structureWarnings, type StructureCode } from "./structure.js";
import { extensionOf, fileToNode, isSource } from "./tree.js";

/** prose's other codes, about the docs in the bar and the build. */
const OTHER_CODES = ["nav-missing", "uncommitted-changes", "unignored-build"] as const;

/** prose's own codes, each with a row in [usage](../docs/usage.md#warnings) that a test holds it
 * to. markz exports its own, and a test holds that none share a name. */
export const PROSE_CODES: readonly ProseCode[] = [
  ...STRUCTURE_CODES,
  ...PRESENCE_CODES,
  ...OTHER_CODES,
];
export type ProseCode = StructureCode | PresenceCode | (typeof OTHER_CODES)[number];
export type WarningCode = MarkzCode | ProseCode;

/** A finding in a file. `prose style` gives its advice in the same shape, with its own codes. */
export interface Warning<Code extends string = WarningCode> {
  code: Code;
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
export function formatWarning(w: Warning<string>): string {
  const place = w.path
    ? `${w.path}${w.line ? `:${w.line}${w.column ? `:${w.column}` : ""}` : ""}: `
    : "";
  return `${place}${w.code}: ${w.message}${w.instead ? `; write ${w.instead}` : ""}`;
}

/** The 1-based line and column of `offset` in `text`. */
export function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: offset - lineStart + 1 };
}

/** A finding at an offset in the text it was found in, before it has a place in a file. */
export type Found<Code extends string = WarningCode> = Omit<
  Warning<Code>,
  "path" | "line" | "column"
> & { start: number };

/** What to look for in a parsed text: markz's warnings, or `prose style`'s advice. */
export type Finder<Code extends string> = (doc: Document) => Found<Code>[];

/** What markz can't read in a text. */
function markzFindings(doc: Document): Found[] {
  return doc.warnings.map((w) => ({
    code: w.code,
    message: w.message,
    instead: w.instead || undefined,
    start: w.start,
  }));
}

/** A Markdown text's findings. The whole file is parsed, metadata included, so a line is the
 *  file's own. */
function inMarkdown<Code extends string>(path: string, source: string, find: Finder<Code>) {
  return find(parse(source)).map(({ start, ...w }): Warning<Code> => ({
    ...w,
    path,
    ...position(source, start),
  }));
}

/** A Markdown file's warnings. */
export function markdownWarnings(path: string, source: string): Warning[] {
  return inMarkdown(path, source, markzFindings);
}

/** @prose
 * # A comment's place in its file
 *
 * A comment's prose is its body, with the delimiters, the marker and each line's gutter taken
 * off. A body's lines are still the file's lines, one for one, from the first one with text.
 *
 * So a finding's line in the body is found in the file by counting on from there. Its column is
 * found by where the body's line sits in the file's, after its gutter.
 */
function inComments<Code extends string>(
  path: string,
  source: string,
  comments: ProseComment[],
  find: Finder<Code>,
): Warning<Code>[] {
  const lines = source.split("\n").map((line) => line.replace(/\r$/, ""));
  const found: Warning<Code>[] = [];
  for (const comment of comments) {
    const body = comment.body.split("\n");
    let start = position(source, comment.start).line - 1;
    while (start < lines.length && !lines[start]!.includes(body[0]!)) start++;
    for (const { start: offset, ...w } of find(parse(comment.body))) {
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

/** A source file's prose comments' warnings. */
export function commentWarnings(path: string, source: string, comments: ProseComment[]): Warning[] {
  return inComments(path, source, comments, markzFindings);
}

/** One file's findings: a Markdown file's, or a source file's prose comments'. A file that isn't
 *  read for prose has none. */
export function findInFile<Code extends string>(
  root: string,
  path: string,
  find: Finder<Code>,
): Warning<Code>[] {
  if (!isSource(root, path)) return [];
  if (extensionOf(path) === "md") {
    return inMarkdown(path, readFileSync(join(root, path), "utf-8"), find);
  }
  const node = fileToNode(root, path);
  return inComments(path, node.source ?? "", node.comments ?? [], find);
}

/** What one run of the check knows of the repository: its files, each linked page's heading
 *  ids, and the exports its package ships, each read once. */
export interface Run {
  files: Set<string>;
  ids: Map<string, Set<string>>;
  shipped?: Map<string, Map<string, number>>;
}

export function newRun(files: string[]): Run {
  return { files: new Set(files), ids: new Map() };
}

/** One file's warnings, markz's and prose's own, in the file's order. */
export function fileWarnings(root: string, path: string, run: Run): Warning[] {
  run.shipped ??= shippedExports(root, run.files);
  return [
    ...noProse(root, path),
    ...findInFile(root, path, markzFindings),
    ...structureWarnings(root, path, run.files, run.ids),
    ...undocumentedExports(path, run.shipped, root),
  ].sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
}

/** @prose
 * # Text prose doesn't check
 *
 * A repository can hold text that isn't held to its rules, like fixtures or a corpus of other
 * projects' docs. `prose-unchecked` in `.gitattributes` says so, as linguist's attributes do, so
 * there's no config file. Such a file isn't checked, and its page still reads as any other.
 *
 * `linguist-vendored` and `linguist-generated` leave a file out too. They were the only way
 * before `prose-unchecked`, and they also hide a file from GitHub's languages. That suits copied-in code,
 * but not a repository's own tests. Outside a git repository, every file is checked.
 */
export function unchecked(repo: string, files: string[]): Set<string> {
  const marked = new Set<string>();
  if (files.length === 0) return marked;
  try {
    const out = execFileSync(
      "git",
      ["check-attr", "-z", "--stdin", "prose-unchecked", "linguist-vendored", "linguist-generated"],
      { cwd: repo, input: files.join("\0"), encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    ).split("\0");
    for (let i = 0; i + 2 < out.length; i += 3) {
      if (["set", "true"].includes(out[i + 2]!)) marked.add(out[i]!);
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
  const skipped = unchecked(repo, files);
  const run = newRun(files);
  const checked = files.filter((path) => !skipped.has(path));
  found.push(...noReadme(root, checked, run.files));
  for (const path of checked) {
    for (const w of fileWarnings(root, path, run)) {
      if (!named.has(`${w.path}:${w.line}:${w.code}`)) found.push(w);
    }
  }
  return found;
}

/** How many files `prose check` read, and how many `.gitattributes` left out, so a skip is
 *  never silent. Only files prose reads for prose count. */
export function checkedCount(
  root: string,
  files: string[],
  repo: string = root,
): { checked: number; left: number } {
  const readable = files.filter((path) => isSource(root, path));
  const left = unchecked(repo, readable).size;
  return { checked: readable.length - left, left };
}

/** One page's warnings on `prose .`, or `null` when `.gitattributes` leaves its file out. */
export function pageWarnings(root: string, path: string, files: string[]): Warning[] | null {
  return unchecked(root, [path]).has(path) ? null : fileWarnings(root, path, newRun(files));
}
