/** @prose
 * # `prose outline`
 *
 * Writes `outline.md`, the repository as a tree with each file's summary, so an agent sees the
 * whole map in one read. `AGENTS.md` names it, and an agent opens the part for the folder it
 * works in. Docs, config and source are all in it, since a config file's summary says what it's
 * for as much as a module's does.
 *
 * It's a copy of the summaries, so nobody edits it, and it's gitignored. `pnpm pr` and `pnpm gone`
 * write it, and `verify` only checks. A committed copy would conflict between two open pull
 * requests that each change a summary.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileToNode, isSource, projectFiles } from "./tree.js";
import { unchecked } from "./warnings.js";

export const OUTLINE = "outline.md";

const HEAD = `# Outline

Every file in this repository, with the first paragraph of its prose. \`prose outline\` writes it from the files, so change a summary there, not here.
`;

/** @prose
 * # What the outline holds
 *
 * Every file git would track, as the tree does, less what `.gitattributes` leaves out of `prose
 * check`, like fixtures. A folder's line carries its `README.md`'s summary, as the tree does, so
 * the README has no line of its own. A file with no summary, like `LICENSE` or a lockfile, is
 * listed by name, so the tree is whole.
 */
export function outline(root: string): { text: string; files: number } {
  const all = projectFiles(root).filter((f) => f !== OUTLINE);
  const skipped = unchecked(root, all);
  const files = all.filter((f) => !skipped.has(f));
  const listed = new Set(files);
  const lines: string[] = [];
  const folders = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    for (let depth = 1; depth < parts.length; depth++) {
      const folder = parts.slice(0, depth).join("/");
      if (folders.has(folder)) continue;
      folders.add(folder);
      const readme = `${folder}/README.md`;
      const about = listed.has(readme) ? summaryOf(root, readme) : "";
      lines.push(line(depth - 1, `${parts[depth - 1]}/`, about));
    }
    if (parts.length > 1 && parts.at(-1) === "README.md") continue;
    lines.push(line(parts.length - 1, parts.at(-1)!, summaryOf(root, file)));
  }
  return { text: `${HEAD}\n${lines.join("\n")}\n`, files: files.length };
}

/** Writes `outline.md` at the root, and says how many files it holds. */
export function writeOutline(root: string): number {
  const { text, files } = outline(root);
  writeFileSync(join(root, OUTLINE), text);
  return files;
}

function line(depth: number, name: string, about: string): string {
  return `${"  ".repeat(depth)}- ${name}${about ? `: ${about}` : ""}`;
}

/** A file's summary on one line, with its links made relative to the root, or "" with none. */
function summaryOf(root: string, file: string): string {
  if (!isSource(root, file)) return "";
  const { summary } = fileToNode(root, file);
  if (summary === "undocumented") return "";
  return fromRoot(file, summary.replace(/\s+/g, " ").trim());
}

/** @prose
 * # Links from the root
 *
 * A summary's relative links are written from its own file, and the outline sits at the root. So
 * `[usage](usage.md)` in `docs/plan.md` becomes `[usage](docs/usage.md)`, and a bare `#anchor`
 * names its file. A link in inline code is rewritten too, which no summary has needed to avoid.
 */
function fromRoot(file: string, text: string): string {
  const dir = dirname(file);
  return text.replace(/\]\(([^)\s]+)\)/g, (whole, to: string) => {
    if (/^([a-z][a-z+.-]*:|\/)/i.test(to)) return whole;
    if (to.startsWith("#")) return `](${file}${to})`;
    return `](${posix.normalize(posix.join(dir, to))})`;
  });
}
