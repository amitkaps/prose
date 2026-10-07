/** @prose
 * # The docs in the bar
 *
 * The docs a repository asks to be read first, linked in the bar on every page. They aren't
 * then one folder among forty. It's a convention, not a site's navigation. The docs are always
 * the ones in `docs/`, and the only choice is which of them, in what order.
 *
 * `docs/README.md` makes that choice with a `nav` list in its metadata, like
 * `nav: [design.md, usage.md]`. With no list, every Markdown file in `docs/` is linked, in
 * alphabetical order. A name that isn't a file there is skipped, and `prose build` warns about it,
 * so a misspelt name doesn't drop out of the bar unnoticed. The local server doesn't, since it
 * reads the list on every request. The label is the file's name, capitalised and without `.md`.
 * A doc's title is often a sentence, too long for the bar.
 *
 * A site path like `/quality`, for a page the deploy writes beside the site, was ruled out. prose
 * can't check that it exists, and it would be a dead link locally and in any other build. A
 * project that wants one in the bar can commit a short doc that links to it.
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

/** The docs to link for a repository whose files (the walk's list) are under `root`. Each `nav`
 * name that isn't a doc is added to `warnings`, when given. */
export function docsNav(root: string, files: string[], warnings?: string[]): NavItem[] {
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
  for (const path of chosen ?? []) {
    if (docs.includes(path)) continue;
    const name = path.slice("docs/".length);
    warnings?.push(
      `docs/README.md's nav lists ${name}, which isn't a doc in docs/, so the bar skips it`,
    );
  }
  return paths.map((path) => ({ path, label: label(path.slice("docs/".length)) }));
}

/** @prose
 * # The links
 *
 * The page's own doc is marked as current. One element serves every width. It sits in the bar
 * while there's room. Below that, it's a popover behind a **Docs** button, like the file tree, so
 * neither needs script.
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
