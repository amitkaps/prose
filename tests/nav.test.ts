/** @prose
 * # Docs nav tests
 *
 * The docs pinned above the tree: the `nav` list in `docs/README.md` in its order, every doc
 * alphabetically without one, names that aren't files skipped, and the labels.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { docsNav } from "../src/nav.js";
import { renderRail } from "../src/rail.js";

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

  it("puts the docs above the tree, the current one highlighted", () => {
    const html = renderRail(["docs/design.md"], "docs/design.md", "demo", "", [
      { path: "docs/design.md", label: "Design" },
    ]);
    expect(html).toContain(
      '<div class="rail-docs"><p class="rail-label">Docs</p><ul><li><a href="/docs/design.md" aria-current="page">Design</a>',
    );
    expect(html.indexOf("rail-docs")).toBeLessThan(html.indexOf("rail-tree"));
    expect(renderRail(["a.ts"], "", "demo")).not.toContain("rail-docs");
  });
});
