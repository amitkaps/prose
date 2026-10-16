/** @prose
 * # Presence tests
 *
 * prose's warnings on prose that isn't there. That's a file with no `@prose`, a folder with no
 * `README.md`, and an export a library ships with no comment. Each runs on a small repository,
 * with the files and folders that must not be asked beside it.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { projectFiles } from "../src/tree.js";
import { contentWarnings } from "../src/warnings.js";

const roots: string[] = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

/** The warnings for a repository of `files`, as `path:line code`. */
function check(files: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), "prose-presence-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  return contentWarnings(root, projectFiles(root)).map(
    (w) => `${w.path}${w.line ? `:${w.line}` : ""} ${w.code}`,
  );
}

const summary = (title: string) => `/** @prose\n * # ${title}\n *\n * What it is.\n */\n`;

describe("files and folders", () => {
  it("asks for prose in every file and folder prose reads, and nothing else", () => {
    expect(
      check({
        "README.md": "# Demo\n",
        "src/a.ts": "export const a = 1;\n",
        "src/b.ts": `${summary("B")}export const b = 2;\n`,
        "config.yaml": "key: value\n",
        "data.json": "{}\n",
        "index.html": "<!doctype html>\n<p>A page.</p>\n",
        ".vscode/settings.json": "{}\n",
        "pkg/.github/workflows/ci.yml": "on: push\n",
        "docs/README.md": "# Docs\n",
        "fixtures/sample.ts": "export const s = 1;\n",
        ".gitattributes": "# @prose\n# # Attributes\n#\n# Samples.\nfixtures/** -prose\n",
      }),
    ).toEqual([
      "pkg/ no-readme",
      "src/ no-readme",
      "config.yaml:1 no-prose",
      "pkg/.github/workflows/ci.yml:1 no-prose",
      "src/a.ts:1 no-prose",
    ]);
  });
});

describe("a library's exports", () => {
  const library = {
    "README.md": "# Lib\n",
    "src/README.md": "# Source\n",
    "package.json": JSON.stringify({
      name: "lib",
      exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    }),
    "src/index.ts":
      summary("Lib") +
      [
        'export { a, type B } from "./a.ts";',
        'export * from "./c.js";',
        'export { outside } from "elsewhere";',
        "export { local };",
        "function local() {}",
        "/** Documented here. */",
        "export const here = 1;",
        "",
      ].join("\n"),
    "src/a.ts":
      summary("A") +
      "/** Documented. */\nexport const a = 1;\nexport interface B {\n  b: number;\n}\nexport const unshipped = 2;\n",
    "src/c.ts":
      summary("C") +
      [
        // Right under the summary, `f` would ship with it as its documentation.
        'import { a } from "./a.ts";',
        "export function f() {}",
        "/** One comment for every overload. */",
        "export function g(x: string): string;",
        "export function g(x: number): number;",
        "export function g(x: unknown) {",
        "  return x;",
        "}",
        "",
      ].join("\n"),
  };

  it("asks for a comment on each export the package ships, followed to where it's declared", () => {
    expect(check(library)).toEqual([
      "src/a.ts:8 undocumented-export",
      "src/c.ts:7 undocumented-export",
      "src/index.ts:10 undocumented-export",
    ]);
  });

  it("asks nothing of a private package", () => {
    const pkg = JSON.stringify({ name: "lib", private: true, types: "./dist/index.d.ts" });
    expect(check({ ...library, "package.json": pkg })).toEqual([]);
  });
});
