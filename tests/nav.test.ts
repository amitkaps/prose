/** @prose
 * # Docs nav tests
 *
 * The docs linked in the bar. A `nav` list in `docs/README.md` sets their order, and without one
 * every doc is linked in alphabetical order. Names that aren't docs are skipped, with a warning.
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
  it("warns when docs/README.md's metadata can't be read, and lists every doc", () => {
    const files = repo("---\nnav:\n  - usage.md\n---\n# Docs\n");
    const warnings: string[] = [];
    expect(docsNav(root, files, warnings).map((item) => item.label)).toEqual([
      "Design",
      "Getting started",
      "Usage",
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /^docs\/README\.md line 3: .*, so the bar lists every doc in alphabetical order$/,
    );
  });

  it("follows the nav list in docs/README.md, skipping and warning about a name that isn't a doc", () => {
    const files = repo("---\nnav: [usage.md, missing.md, design.md, /quality]\n---\n# Docs\n");
    const warnings: string[] = [];
    expect(docsNav(root, files, warnings)).toEqual([
      { path: "docs/usage.md", label: "Usage" },
      { path: "docs/design.md", label: "Design" },
    ]);
    expect(warnings).toEqual([
      "docs/README.md's nav lists missing.md, which isn't a doc in docs/, so the bar skips it",
      "docs/README.md's nav lists /quality, which isn't a doc in docs/, so the bar skips it",
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
