/** @prose
 * # Structure tests
 *
 * prose's warnings on how a text is put together. That's links that reach nothing, headings that
 * skip a level, `@prose` sharing its line, a summary with no title, and a written id that isn't
 * kebab case or is stated on two pages. Each is run on a small repository, with the near misses
 * that must not warn beside it.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { projectFiles } from "../src/tree.js";
import { contentWarnings } from "../src/warnings.js";

const comment = (...lines: string[]) =>
  `/** @prose\n${lines.map((l) => ` * ${l}`.trimEnd()).join("\n")}\n */\n`;

describe("structure warnings", () => {
  let root: string;
  let found: string[];
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "prose-structure-"));
    const files: Record<string, string> = {
      "README.md": [
        "# Demo",
        "",
        "[Usage](docs/usage.md#checks), [src](src/), [up](./), [site](https://example.com),",
        "[about](/about), [line](src/a.ts#L4), [out](../elsewhere.md), [adding](src/a.ts#adding),",
        "[again](src/a.ts#adding-1), [gone](docs/gone.md), [nowhere](docs/usage.md#nowhere).",
        "",
      ].join("\n"),
      "docs/usage.md": "# Usage\n\n## Checks\n\n#### Too deep\n\n[Top](#usage), [lost](#lost).\n",
      "src/a.ts":
        comment("# A", "", "What a is.") +
        "export const a = 1;\n" +
        comment("# Adding", "", "One part.") +
        comment("## Inside", "", "A part of adding.") +
        comment("# Adding", "", "Another.") +
        "/** @prose One line. */\nexport const b = 2;\n" +
        "/** @prose\n * # Closing\n *\n * Ends on its text. */\n",
      "src/b.ts":
        comment("## B", "", "A title the page puts above it.") +
        comment("# Part", "", "x") +
        comment("## Inside", "", "x") +
        comment("# Next", "", "x") +
        comment("### Skips", "", "x"),
      "src/c.ts": comment("What c is, with no title.") + "export const c = 3;\n",
      "src/d.ts":
        "/**\n * @prose\n * # D\n *\n * Its marker on the line after.\n */\n" +
        "/**\n * @prose Text on the marker's line.\n */\n",
      "config.yaml": "# @prose Prose on the marker's line.\nkey: value\n",
      "docs/ids.md":
        "# Ids\n\n{#shared}\n## Shared\n\n- [`one-id`]{#one-id}: Stated here.\n- [Bad]{#Bad_Id}: Not kebab case.\n",
      "docs/later.md": "# Later\n\n{#shared}\n## Shared\n\nThe [`one-id`]{#one-id} again.\n",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    execFileSync("git", ["init", "-q"], { cwd: root });
    found = contentWarnings(root, projectFiles(root)).map((w) => `${w.path}:${w.line} ${w.code}`);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("warns about a link to a file or a heading that isn't there, and checks nothing it can't see", () => {
    expect(found.filter((w) => w.startsWith("README.md"))).toEqual([
      "README.md:5 broken-link",
      "README.md:5 broken-anchor",
    ]);
    expect(found).toContain("docs/usage.md:7 broken-anchor");
  });

  it("warns about a heading that skips a level, where a later comment's headings show one down", () => {
    expect(found).toContain("docs/usage.md:5 heading-skip");
    expect(found.filter((w) => w.startsWith("src/b.ts"))).toEqual(["src/b.ts:22 heading-skip"]);
    expect(found).not.toContain("src/a.ts:13 heading-skip");
  });

  it("warns about prose on the marker's line or the closing line, wherever the marker sits", () => {
    expect(found.filter((w) => w.endsWith("marker-line"))).toEqual([
      "config.yaml:1 marker-line",
      "src/a.ts:22 marker-line",
      "src/a.ts:24 marker-line",
      "src/d.ts:8 marker-line",
    ]);
  });

  it("warns about a summary with no heading, the first comment only", () => {
    expect(found.filter((w) => w.endsWith("untitled-summary"))).toEqual([
      "config.yaml:1 untitled-summary",
      "src/c.ts:1 untitled-summary",
    ]);
  });

  it("warns about a span's id that isn't kebab case, or that another page states, but not a heading's", () => {
    expect(found.filter((w) => /id-(case|twice)$/.test(w))).toEqual([
      "docs/ids.md:7 id-case",
      "docs/later.md:6 id-twice",
    ]);
  });
});
