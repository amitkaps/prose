/** @prose
 * # The docs in the bar
 *
 * The docs a repository asks to be read first, linked in the bar on every page. They aren't
 * then one folder among forty. It's a convention, not a site's navigation. The docs are always
 * the ones in `docs/`, and the only choice is which of them, in what order.
 *
 * `docs/README.md` makes that choice with a `nav` list in its metadata, like
 * `nav: [design.md, usage.md, areas/]`. With no list, every Markdown file in `docs/` is linked, in
 * alphabetical order. A name that isn't a doc or a folder there is skipped, and `prose build` and
 * `prose check` warn about it, so a misspelt name doesn't drop out of the bar unnoticed. So does
 * metadata markz can't read, which would otherwise turn the bar alphabetical with no word why
 * ([warnings.ts](warnings.ts)). The local server doesn't, since it reads the list on every
 * request. The label is the file's or folder's name, capitalised and without `.md`.
 * A doc's title is often a sentence, too long for the bar.
 *
 * A folder in the list, like `areas/`, links the folder's page, its README and a list of its docs.
 * That's for a set of docs too many for the bar one by one, like one spec per area. Its slash is
 * optional. A folder is never linked without a list, since the bar would grow with every folder.
 *
 * A site path like `/quality`, for a page the deploy writes beside the site, was ruled out. prose
 * can't check that it exists, and it would be a dead link locally and in any other build. A
 * project that wants one in the bar can commit a short doc that links to it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { escapeHtml } from "./highlight.js";
import { position, type Warning } from "./warnings.js";

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
 * name that isn't a doc is added to `warnings`, when given, at its line in `docs/README.md`. */
export function docsNav(root: string, files: string[], warnings?: Warning[]): NavItem[] {
  const docs = files
    .filter((path) => /^docs\/[^/]+\.md$/.test(path) && path !== "docs/README.md")
    .sort();
  let chosen: string[] | null = null;
  let source = "";
  if (files.includes("docs/README.md")) {
    try {
      source = readFileSync(join(root, "docs/README.md"), "utf-8");
      const doc = parse(source);
      const nav = doc.metadata?.["nav"];
      if (Array.isArray(nav)) chosen = nav.map((name) => `docs/${String(name)}`);
      else {
        for (const w of doc.warnings.filter((w) => w.code.startsWith("metadata"))) {
          warnings?.push({
            code: w.code,
            message: `${w.message}, so the bar lists every doc in alphabetical order`,
            instead: w.instead || undefined,
            path: "docs/README.md",
            ...position(source, w.start),
          });
        }
      }
    } catch {
      chosen = null;
    }
  }
  if (!chosen) return docs.map((path) => ({ path, label: label(path.slice("docs/".length)) }));
  const items: NavItem[] = [];
  for (const path of chosen) {
    const name = path.slice("docs/".length);
    const folder = `${path.replace(/\/+$/, "")}/`;
    if (docs.includes(path)) {
      items.push({ path, label: label(name) });
    } else if (folder !== "docs/" && files.some((file) => file.startsWith(folder))) {
      items.push({ path: folder, label: label(name.replace(/\/+$/, "")) });
    } else {
      const at = source.indexOf(name, source.indexOf("nav"));
      warnings?.push({
        code: "nav-missing",
        message: `nav lists ${name}, which isn't a doc or a folder in docs/, so the bar skips it`,
        instead: "a doc's or a folder's name in docs/",
        path: "docs/README.md",
        ...(at === -1 ? {} : position(source, at)),
      });
    }
  }
  return items;
}

/** @prose
 * # The links
 *
 * The page's own doc is marked as current. A folder is marked on its own page and on every page in
 * it, since the reader is still among its docs. One element serves every width. It sits in the bar
 * while there's room. Below that, it's a popover behind a **Docs** button, like the file tree, so
 * neither needs script.
 */
export function renderNav(nav: NavItem[], current: string): string {
  if (nav.length === 0) return "";
  const mark = (path: string) =>
    current === path
      ? ` aria-current="page"`
      : path.endsWith("/") && current.startsWith(path)
        ? ` aria-current="true"`
        : "";
  const links = nav.map(
    ({ path, label }) =>
      `<a href="/${path.split("/").map(encodeURIComponent).join("/")}"${mark(path)}>${escapeHtml(
        label,
      )}</a>`,
  );
  return `<button type="button" class="docs-toggle" popovertarget="docs">Docs</button><nav class="docs" id="docs" popover aria-label="Docs">${links.join("")}</nav>`;
}
