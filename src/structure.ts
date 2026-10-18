/** @prose
 * # Structure
 *
 * prose's warnings on how a text is put together, as [writing](../docs/writing.md) asks. A link
 * reaches a file and a heading that are there, headings never skip a level, `@prose` sits on its
 * own line, and a file's summary opens with its title. Each is exact, so a warning is always
 * something to fix ([usage](../docs/usage.md#warnings)).
 *
 * They're found in the same texts as markz's warnings, and placed the same way
 * ([warnings.ts](warnings.ts)).
 */
import { dirname, posix } from "node:path";
import { headings, walk, type Document } from "@amitkaps/markz";
import type { ProseComment } from "./parser.js";
import { markdownBody, sourceBody } from "./render.js";
import { extensionOf, fileToNode, isSource } from "./tree.js";
import { findInFile, position, type Finder, type Found, type Warning } from "./warnings.js";

export const STRUCTURE_CODES = [
  "broken-link",
  "broken-anchor",
  "heading-skip",
  "marker-line",
  "untitled-summary",
] as const;
export type StructureCode = (typeof STRUCTURE_CODES)[number];

/** One file's structure warnings, against the repository's `files`. */
export function structureWarnings(
  root: string,
  path: string,
  files: Set<string>,
  ids: Map<string, Set<string>>,
): Warning<StructureCode>[] {
  if (!isSource(root, path)) return [];
  const found = [
    ...findInFile(root, path, links(root, path, files, ids)),
    ...findInFile(root, path, headingLevels()),
  ];
  if (extensionOf(path) !== "md") {
    const node = fileToNode(root, path);
    found.push(...markers(path, node.source ?? "", node.comments ?? []));
  }
  return found.sort((a, b) => a.line! - b.line! || a.column! - b.column!);
}

/** @prose
 * # Links
 *
 * A relative link reaches a file or folder in the repository, and its `#fragment` a heading on
 * that page. The ids are the page's own, as it renders, so a link lands where a reader's click
 * would.
 *
 * A link with a scheme, a site path like `/about`, or a path out of the repository isn't checked,
 * since prose can't see where it goes. Neither is a GitHub line, like `#L42`, or a fragment on a
 * file prose doesn't read.
 */
function links(
  root: string,
  path: string,
  files: Set<string>,
  ids: Map<string, Set<string>>,
): Finder<StructureCode> {
  const folders = new Set(
    [...files].flatMap((f) =>
      f
        .split("/")
        .slice(0, -1)
        .map((_, i, parts) => parts.slice(0, i + 1).join("/")),
    ),
  );
  return (doc) => {
    const found: Found<StructureCode>[] = [];
    walk(doc, {
      enter(node) {
        const type = doc.type(node);
        if (type !== "link" && type !== "image") return true;
        const { destination, expressions } = doc.data(node, type);
        if (expressions.length || /^([a-z][\w+.-]*:|\/)/i.test(destination)) return true;
        const [where, fragment] = destination.split("#", 2) as [string, string?];
        const target = targetOf(path, decode(where.replace(/\?.*$/, "")));
        if (target === null) return true;
        const start = doc.start(node);
        if (target !== "" && !files.has(target) && !folders.has(target)) {
          found.push({
            code: "broken-link",
            message: `link to \`${where}\`, which isn't a file or folder here`,
            instead: "a path from this file",
            start,
          });
          return true;
        }
        const id = fragment === undefined ? "" : decode(fragment);
        if (!id || /^L\d+(-L?\d+)?$/.test(id)) return true;
        const page = files.has(target) ? target : posix.join(target, "README.md");
        if (!files.has(page) || !isSource(root, page)) return true;
        if (!idsOf(root, page, ids).has(id)) {
          found.push({
            code: "broken-anchor",
            message: `link to \`#${fragment}\`, which no id in \`${page}\` has`,
            instead: "a heading's or span's id, as the page's `#` gives it",
            start,
          });
        }
        return true;
      },
    });
    return found;
  };
}

/** The repo path a link from `path` points to: `""` for the root, or `null` for one outside. */
function targetOf(path: string, where: string): string | null {
  if (!where) return path;
  const joined = posix.normalize(posix.join(dirname(path), where)).replace(/\/$/, "");
  if (joined === ".") return "";
  return joined.startsWith("../") || joined === ".." ? null : joined;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Every id on a file's page, rendered once a run. */
function idsOf(root: string, page: string, ids: Map<string, Set<string>>): Set<string> {
  let found = ids.get(page);
  if (!found) {
    const node = fileToNode(root, page);
    const body = extensionOf(page) === "md" ? markdownBody(node) : sourceBody(node);
    found = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
    ids.set(page, found);
  }
  return found;
}

/** @prose
 * # Heading levels
 *
 * A page's headings go down one level at a time, so a screen reader's outline has no gap. A later
 * comment's headings show one level down
 * ([render.ts](render.ts#a-source-file-as-one-document)).
 *
 * So a later comment's `#` follows the file's title, and its `##` follows a `#` before it. A page
 * with no title of its own gets one, so the first heading may be a `##`.
 *
 * The finder is made once a file, and sees the file's texts in order, so it carries the level
 * from one comment to the next.
 */
function headingLevels(): Finder<StructureCode> {
  let last = 1;
  let first = true;
  return (doc: Document) => {
    const found: Found<StructureCode>[] = [];
    const shift = first ? 0 : 1;
    first = false;
    for (const heading of headings(doc)) {
      const level = Math.min(6, heading.depth + shift);
      if (level > last + 1) {
        found.push({
          code: "heading-skip",
          message: `heading ${level - last} levels below the one before it on the page`,
          instead: shift
            ? "`#` for a part of the file, and `##` only inside one"
            : "one level below",
          start: doc.start(heading.node),
        });
      }
      last = level;
    }
    return found;
  };
}

/** @prose
 * # The marker's line and the summary's title
 *
 * `@prose` and a block comment's close each sit on their own line
 * ([writing](../docs/writing.md#a-prose-comment)). Then a formatter re-indents the comment as it
 * does JSDoc. A file's first comment, its summary, opens with a heading, which is the page's
 * title. Both are read from the source, at the marker.
 */
function markers(path: string, source: string, comments: ProseComment[]): Warning<StructureCode>[] {
  const found: Warning<StructureCode>[] = [];
  comments.forEach((comment, i) => {
    const text = source.slice(comment.start, comment.end);
    const at = comment.start + Math.max(0, text.indexOf("@prose"));
    const place = { path, ...position(source, at) };
    const lines = text.split("\n");
    const marker = lines.find((line) => line.includes("@prose")) ?? "";
    const opening = marker.slice(marker.indexOf("@prose") + "@prose".length).trim();
    const close = /(\*\/|-->)\s*$/.exec(text);
    const closing = close
      ? lines
          .at(-1)!
          .replace(/(\*\/|-->)\s*$/, "")
          .replace(/^\s*\*?/, "")
          .trim()
      : "";
    if ((opening && opening !== "*/" && opening !== "-->") || (lines.length > 1 && closing)) {
      found.push({
        code: "marker-line",
        message: opening ? "prose on the `@prose` line" : "prose on the comment's closing line",
        instead: "`@prose` and the close each on their own line",
        ...place,
      });
    }
    if (i === 0 && !/^\s*#{1,6}\s/.test(comment.body)) {
      found.push({
        code: "untitled-summary",
        message: "file's summary with no heading",
        instead: "a `# Title` line first, which is the page's title",
        ...place,
      });
    }
  });
  return found;
}
