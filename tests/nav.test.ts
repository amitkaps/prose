/** @prose
 * # Docs nav tests
 *
 * The docs linked in the bar. A `nav` list in `docs/README.md` sets their order, and without one
 * every doc is linked in alphabetical order. Names that aren't files are skipped.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { docsNav, renderNav } from "../src/nav.js";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

function repo(readme: string | null): string[] {
  root = mkdtempSync(join(tmpdir(), "prose-nav-"));
  mkdirSync(join(root, "docs"));
  if (readme !== null) writeFileSync(join(root, "docs/README.md"), readme);
  const files = ["docs/usage.md", "docs/design.md", "docs/getting-started.md", "docs/deep/x.md"];
  return readme === null ? files : ["docs/README.md", ...files];
}

describe("docsNav", () => {
  it("follows the nav list in docs/README.md, skipping a name that isn't a doc", () => {
    const files = repo("---\nnav: [usage.md, missing.md, design.md]\n---\n# Docs\n");
    expect(docsNav(root, files)).toEqual([
      { path: "docs/usage.md", label: "Usage" },
      { path: "docs/design.md", label: "Design" },
    ]);
  });

  it("pins every doc in docs/, alphabetically, with no README or no list in it", () => {
    const labels = (files: string[]) => docsNav(root, files).map((item) => item.label);
    expect(labels(repo(null))).toEqual(["Design", "Getting started", "Usage"]);
    rmSync(root, { recursive: true, force: true });
    expect(labels(repo("# Docs\n\nNo metadata.\n"))).toEqual([
      "Design",
      "Getting started",
      "Usage",
    ]);
  });

  it("links the docs in the bar, the current one marked, and nothing without docs", () => {
    const html = renderNav([{ path: "docs/design.md", label: "Design" }], "docs/design.md");
    expect(html).toContain(
      '<nav class="docs" id="docs" popover aria-label="Docs"><a href="/docs/design.md" aria-current="page">Design</a></nav>',
    );
    expect(html).toContain('popovertarget="docs"');
    expect(renderNav([], "")).toBe("");
  });
});
