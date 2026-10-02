/** @prose
 * # The docs in the bar
 *
 * The docs a repository asks to be read first, as links in the bar after the project's name, on
 * every page, so they aren't one folder among forty. It's a convention, not a site's navigation:
 * the docs are always `docs/`'s, and the only choice is which of them, in what order.
 *
 * `docs/README.md` chooses with a `nav` list in its metadata, by file name, in reading order:
 * `nav: [design.md, usage.md]`. With no list, every Markdown file in `docs/` is linked,
 * alphabetically. A name that isn't a file there is skipped. The label is the file's name without
 * `.md`, capitalised, rather than its title, which is often a sentence too long for the bar.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { escapeHtml } from "./highlight.js";

export interface NavItem {
  path: string;
  label: string;
}

/** `getting-started.md` is `Getting started`. */
function label(name: string): string {
  const words = name.replace(/\.md$/, "").replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The docs to link for a repository whose files (the walk's list) are under `root`. */
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

/** @prose
 * The links, with the page's own doc marked current. One element serves both widths: in the bar
 * itself while it has room, and below that a popover behind a **Docs** button, as the file tree
 * is (`style.css`), so neither needs script.
 */
export function renderNav(nav: NavItem[], current: string): string {
  if (nav.length === 0) return "";
  const links = nav.map(
    ({ path, label }) =>
      `<a href="/${path.split("/").map(encodeURIComponent).join("/")}"${
        current === path ? ` aria-current="page"` : ""
      }>${escapeHtml(label)}</a>`,
  );
  return `<button type="button" class="docs-toggle" popovertarget="docs">Docs</button><nav class="docs" id="docs" popover aria-label="Docs">${links.join("")}</nav>`;
}
