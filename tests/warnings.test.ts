/** @prose
 * # Warnings tests
 *
 * What markz and prose report about a repository's text, at the file's own line and column. The
 * one-line form `check` and `build` print, the files `.gitattributes` leaves out and how many, and
 * the list at the foot of a local page that a built page never has.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { parseFile } from "../src/parser.js";
import { renderRoute, type Site } from "../src/server.js";
import { projectFiles } from "../src/tree.js";
import {
  checkedCount,
  commentWarnings,
  contentWarnings,
  formatWarning,
  markdownWarnings,
} from "../src/warnings.js";

describe("formatWarning", () => {
  it("writes the place, the code, the message and what to write instead, as a compiler does", () => {
    expect(
      formatWarning({
        code: "reference-link",
        message: "reference link",
        instead: "inline links",
        path: "docs/x.md",
        line: 3,
        column: 5,
      }),
    ).toBe("docs/x.md:3:5: reference-link: reference link; write inline links");
    expect(formatWarning({ code: "uncommitted-changes", message: "not in the build" })).toBe(
      "uncommitted-changes: not in the build",
    );
  });
});

describe("markdownWarnings", () => {
  it("places a warning at the file's own line, metadata included", () => {
    const source = "---\ntitle: X\n---\n# X\n\nSome __strong__ text.\n";
    expect(markdownWarnings("x.md", source)).toMatchObject([
      { code: "underscore-strong", path: "x.md", line: 6, column: 6, instead: "`**strong**`" },
    ]);
  });
});

describe("commentWarnings", () => {
  it("places a warning in a comment at its line and column in the source file", () => {
    const source = "const a = 1;\n\n/** @prose\n * # Title\n *\n * Some __strong__ text.\n */\n";
    const [w] = commentWarnings("a.ts", source, parseFile(source, "ts"));
    expect(w).toMatchObject({ code: "underscore-strong", line: 6, column: 9 });
  });

  it("counts from the marker's own line when the prose starts on it", () => {
    const source = "/** @prose __a__ */\n";
    expect(commentWarnings("a.ts", source, parseFile(source, "ts"))).toMatchObject([
      { line: 1, column: 12 },
    ]);
  });

  it("finds an indented HTML comment's place after its indent", () => {
    const source = "<body>\n\t<!-- @prose\n\tSome __strong__ text.\n\t-->\n</body>\n";
    expect(commentWarnings("a.html", source, parseFile(source, "html"))).toMatchObject([
      { line: 3, column: 7 },
    ]);
  });
});

describe("a repository's warnings", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "prose-warnings-"));
    const files: Record<string, string> = {
      "README.md": "# Demo\n\nSome __strong__ text.\n",
      "docs/README.md": "---\nnav: [usage.md, gone.md]\n---\n# Docs\n",
      "docs/usage.md": "# Usage\n\n## Checks\n\n{@section #checks}\n\n{/section}\n",
      "vendor/theirs.md": "# Theirs\n\n[ref][x]\n",
      "fixtures/sample.md": "# Sample\n\nSome __strong__ text.\n",
      "src/README.md": "# Source\n",
      "src/a.ts": "/** @prose\n * # A\n *\n * A *star*.\n */\nexport const a = 1;\n",
      "src/b.ts": "/** @prose\n * # B\n *\n * One idea; another.\n */\nexport const b = 1;\n",
      ".gitattributes":
        "# @prose\n# # Attributes\n#\n# Text that isn't ours; prose leaves it alone.\nvendor/** linguist-vendored\nfixtures/** prose-unchecked\n",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    execFileSync("git", ["init", "-q"], { cwd: root });
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("reports the bar's warnings first, then each file's, with no advice on style, and skips files .gitattributes marks prose-unchecked or vendored", () => {
    const found = contentWarnings(root, projectFiles(root));
    expect(found.map((w) => `${w.path}:${w.line} ${w.code}`)).toEqual([
      "docs/README.md:2 nav-missing",
      "README.md:3 underscore-strong",
      "docs/usage.md:5 duplicate-id",
      "src/a.ts:4 star-emphasis",
    ]);
  });

  it("counts the files it read, apart from the ones .gitattributes leaves out", () => {
    // All nine are read for prose, `.gitattributes` among them, and two are left out.
    expect(checkedCount(root, projectFiles(root))).toEqual({ checked: 7, left: 2 });
  });

  it("lists a local page's own warnings at its foot, linked to the editor, and a built page's never", () => {
    const files = projectFiles(root);
    const site: Site = { root, project: "demo", files, live: true, nav: [] };
    const local = renderRoute(site, "src/a.ts");
    expect(local.status === 200 && local.html).toMatch(
      /<aside class="warnings" aria-label="Warnings"><p>1 warning in this file<\/p><ul><li><a href="vscode:\/\/file[^"]*\/src\/a\.ts:4:6">line 4<\/a> .*<span class="warning-code">star-emphasis<\/span><\/li><\/ul><\/aside>/,
    );
    const home = renderRoute(site, "");
    expect(home.status === 200 && home.html).toContain("underscore-strong");
    // Advice on style is for `prose style`, never a page.
    const styled = renderRoute(site, "src/b.ts");
    expect(styled.status === 200 && styled.html).not.toContain('class="warnings"');
    const built = renderRoute({ ...site, live: false }, "src/a.ts");
    expect(built.status === 200 && built.html).not.toContain('class="warnings"');
    // A file left out says so, rather than looking clean.
    for (const path of ["vendor/theirs.md", "fixtures/sample.md"]) {
      const page = renderRoute(site, path);
      expect(page.status === 200 && page.html).toContain("Not checked, since");
      expect(page.status === 200 && page.html).not.toContain("warning-code");
      const built = renderRoute({ ...site, live: false }, path);
      expect(built.status === 200 && built.html).not.toContain('class="warnings"');
    }
  });
});
