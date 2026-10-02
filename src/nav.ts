/** @prose
 * # The docs at the top of the rail
 *
 * The docs a repository asks to be read first, pinned above the file tree, so they aren't one
 * folder among forty. It's a convention, not a site's navigation: the docs are always `docs/`'s,
 * and the only choice is which of them, in what order.
 *
 * `docs/README.md` chooses with a `nav` list in its metadata, by file name, in reading order:
 * `nav: [design.md, usage.md]`. With no list, every Markdown file in `docs/` is pinned,
 * alphabetically. A name that isn't a file there is skipped. The label is the file's name without
 * `.md`, capitalised, rather than its title, which is often a sentence too long for the rail.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";

export interface NavItem {
  path: string;
  label: string;
}

/** `getting-started.md` is `Getting started`. */
function label(name: string): string {
  const words = name.replace(/\.md$/, "").replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The pinned docs for a repository whose files (the walk's list) are under `root`. */
export function docsNav(root: string, files: string[]): NavItem[] {
  const docs = files
    .filter((path) => /^docs\/[^/]+\.md$/.test(path) && path !== "docs/README.md")
    .sort();
  let chosen: string[] | null = null;
  if (files.includes("docs/README.md")) {
    try {
      const nav = parse(readFileSync(join(root, "docs/README.md"), "utf-8")).metadata?.["nav"];
      if (Array.isArray(nav)) chosen = nav.map((name) => `docs/${String(name)}`);
    } catch {
      chosen = null;
    }
  }
  const paths = chosen ? chosen.filter((path) => docs.includes(path)) : docs;
  return paths.map((path) => ({ path, label: label(path.slice("docs/".length)) }));
}
