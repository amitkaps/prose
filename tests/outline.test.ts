/** @prose
 * # Outline tests
 *
 * What `prose outline` writes: the tree, each file's summary on its line, a folder's from its
 * README, links made from the root, and what `.gitattributes` leaves out.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { outline, writeOutline } from "../src/outline.js";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

function project(files: Record<string, string>): string {
  root = mkdtempSync(join(tmpdir(), "prose-outline-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

const tree = (text: string) => text.slice(text.indexOf("\n- ") + 1);

describe("prose outline", () => {
  it("lists every file under its folder, with its summary", () => {
    const { text, files } = outline(
      project({
        "README.md": "# Demo\n\nA demo.\n",
        LICENSE: "MIT\n",
        "docs/README.md": "# Docs\n\nThe docs.\n",
        "docs/plan.md": "# Plan\n\nWhat's next.\nOn two lines.\n\nDetail.\n",
        "src/a.ts": "/** @prose\n * # A\n *\n * The a module.\n */\nexport const a = 1;\n",
        "src/b.ts": "export const b = 2;\n",
      }),
    );
    expect(files).toBe(6);
    expect(tree(text)).toBe(
      [
        "- LICENSE",
        "- README.md: A demo.",
        "- docs/: The docs.",
        "  - plan.md: What's next. On two lines.",
        "- src/",
        "  - a.ts: The a module.",
        "  - b.ts",
        "",
      ].join("\n"),
    );
  });

  it("writes links from the root", () => {
    const { text } = outline(
      project({
        "docs/plan.md":
          "# Plan\n\nSee [usage](usage.md), [src](../src/), [below](#next) and [site](https://x.dev).\n",
      }),
    );
    expect(tree(text)).toContain(
      "plan.md: See [usage](docs/usage.md), [src](src/), [below](docs/plan.md#next) and [site](https://x.dev).",
    );
  });

  it("leaves out what .gitattributes leaves out of check, and itself", () => {
    const at = project({
      ".gitattributes": "tests/fixtures/** prose-unchecked\n",
      "tests/fixtures/x.md": "# X\n\nA fixture.\n",
      "tests/a.test.ts": "/** @prose\n * # A\n *\n * Tests.\n */\n",
    });
    expect(writeOutline(at)).toBe(2);
    expect(writeOutline(at)).toBe(2);
    const text = readFileSync(join(at, "outline.md"), "utf8");
    expect(text).not.toContain("fixture");
    expect(text).not.toContain("- outline.md");
  });
});
