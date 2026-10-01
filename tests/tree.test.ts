/** @prose
 * # Tree tests
 *
 * The walk into folders and files (spec §4): summaries, raw files such as lockfiles shown as text, `docs/` as an
 * ordinary folder, and the git-aware file list, all against throwaway projects built in a temp directory.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildTree, findNode, ignoredIn, projectFiles, rawToNode, walkFiles } from "../src/tree.js";

let root: string;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function makeProject(files: Record<string, string>): string {
  root = mkdtempSync(join(tmpdir(), "prose-tree-test-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = join(root, relPath);
    mkdirSync(join(absPath, ".."), { recursive: true });
    writeFileSync(absPath, content, "utf-8");
  }
  return root;
}

describe("buildTree", () => {
  it("walks files with @prose comments into file nodes, chunks and sections", () => {
    const dir = makeProject({
      "main.js": '/** @prose\n * File summary.\n */\nimport x from "y";\n',
    });
    const tree = buildTree(dir);
    expect(tree.kind).toBe("project");
    expect(tree.name).toBe(basename(dir));
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]!.path).toBe("main.js");
    expect(tree.children[0]!.summary).toBe("File summary.");
  });

  it("marks a file with no @prose blocks as undocumented", () => {
    const dir = makeProject({ "main.js": "const a = 1;\n" });
    const tree = buildTree(dir);
    expect(tree.children[0]!.summary).toBe("undocumented");
  });

  it("reads a folder's README.md as its prose, and excludes it from the folder's children", () => {
    const dir = makeProject({
      "lib/README.md": "# lib\n\nFolder summary.\n",
      "lib/index.ts": "/** @prose Chunk. */\nexport {};\n",
    });
    const tree = buildTree(dir);
    const folder = tree.children.find((n) => n.name === "lib");
    expect(folder?.kind).toBe("folder");
    expect(folder?.summary).toBe("Folder summary.");
    expect(folder?.children.map((c) => c.name)).toEqual(["lib/index.ts"]);
  });

  it("treats a plain .md file (not README.md) as whole-file prose, with frontmatter stripped", () => {
    const dir = makeProject({
      "content/page.md": "---\ntitle: Page\n---\nBody text.\n",
    });
    const tree = buildTree(dir);
    const content = tree.children.find((n) => n.name === "content");
    const page = content?.children[0];
    expect(page?.prose).toBe("Body text.");
    expect(page?.prose).not.toContain("title:");
  });

  it("marks a chunk with no trailing code as pending", () => {
    const dir = makeProject({
      "main.js": "/** @prose File. */\n\n/** @prose Plan item. */\n",
    });
    const tree = buildTree(dir);
    const chunk = findNode(tree, "main.js#chunk-1");
    expect(chunk?.pending).toBe(true);
  });

  it("makes a file the leaf: its blocks (file prose first) hang off it, not off children", () => {
    const dir = makeProject({
      "main.js":
        "/** @prose File. */\nimport x from 'y';\n\n/** @prose A chunk. */\nconst a = 1;\n",
    });
    const file = buildTree(dir).children[0]!;
    expect(file.children).toEqual([]);
    expect(file.blocks?.map((b) => b.path)).toEqual(["main.js#file", "main.js#a"]);
    // spans are the comment's exact byte range in the source, so a view can lay code around it
    const [first, second] = file.blocks! as [
      NonNullable<typeof file.blocks>[number],
      NonNullable<typeof file.blocks>[number],
    ];
    expect(file.source!.slice(...first.span!)).toBe("/** @prose File. */");
    expect(file.source!.slice(...second.span!)).toBe("/** @prose A chunk. */");
  });

  it("skips node_modules, dist and other generated directories", () => {
    const dir = makeProject({
      "node_modules/dep/index.js": "const a = 1;\n",
      "dist/out.js": "const a = 1;\n",
      "main.js": "const a = 1;\n",
    });
    const tree = buildTree(dir);
    expect(tree.children.map((n) => n.name)).toEqual(["main.js"]);
  });

  it("walks .yaml/.toml files with # @prose comments into file nodes", () => {
    const dir = makeProject({
      "config.toml": "# @prose\n# TOML config summary.\nport = 8080\n",
      "pipeline.yaml": "# @prose\n# YAML pipeline summary.\nname: build\n",
    });
    const tree = buildTree(dir);
    const names = tree.children.map((n) => n.name).sort();
    expect(names).toEqual(["config.toml", "pipeline.yaml"]);
    expect(tree.children.find((n) => n.name === "config.toml")?.summary).toBe(
      "TOML config summary.",
    );
  });

  it("shows a lockfile as text, never parsed for prose, though .yaml otherwise is", () => {
    const dir = makeProject({
      "pnpm-lock.yaml": "# @prose\n# Not prose.\nlockfileVersion: '9.0'\n",
      "config.toml": "port = 8080\n",
    });
    const byName = Object.fromEntries(buildTree(dir).children.map((n) => [n.name, n.kind]));
    expect(byName).toEqual({ "config.toml": "file", "pnpm-lock.yaml": "raw" });
  });
});

describe("buildTree: file source", () => {
  it("carries the whole file's text, documented or not", () => {
    const dir = makeProject({
      "a.js": "/** @prose\n * Doc.\n */\nconst a = 1;\n",
      "b.js": "const b = 2;\n",
      "c.md": "Prose only.\n",
    });
    const byPath = Object.fromEntries(buildTree(dir).children.map((n) => [n.path, n]));
    expect(byPath["a.js"]!.source).toBe("/** @prose\n * Doc.\n */\nconst a = 1;\n");
    expect(byPath["b.js"]!.source).toBe("const b = 2;\n");
    expect(byPath["c.md"]!.source).toBeUndefined();
  });
});

describe("buildTree: raw files", () => {
  it("shows JSON files as raw nodes carrying their text, with no chunks", () => {
    const dir = makeProject({ "package.json": '{ "name": "x" }\n', "main.ts": "const a = 1;\n" });
    const raw = buildTree(dir).children.find((n) => n.path === "package.json");
    expect(raw?.kind).toBe("raw");
    expect(raw?.code).toBe('{ "name": "x" }\n');
    expect(raw?.children).toEqual([]);
  });

  it("shows every other file: dotfiles, LICENSE, a source file too large to be written by hand", () => {
    const dir = makeProject({
      ".gitignore": "dist/\n",
      LICENSE: "MIT\n",
      "big.ts": `export const a = "${"x".repeat(200_001)}";\n`,
    });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const kinds = buildTree(dir).children.map((n) => [n.path, n.kind]);
    expect(kinds).toEqual([
      [".gitignore", "raw"],
      ["LICENSE", "raw"],
      ["big.ts", "raw"],
    ]);
  });

  it("cuts long text at 1,000 lines, and a long line at 100 KB, saying what's left", () => {
    const lines = Array.from({ length: 1500 }, (_, i) => `line ${i + 1}`).join("\n");
    const dir = makeProject({ "notes.txt": `${lines}\n`, "min.js.map": "x".repeat(150_000) });
    const long = rawToNode(dir, "notes.txt");
    expect(long.code!.split("\n")).toHaveLength(1000);
    expect(long.more).toBe("500 more lines");
    const wide = rawToNode(dir, "min.js.map");
    expect(wide.code).toHaveLength(100_000);
    expect(wide.more).toBe("50 KB more");
  });

  it("gives a binary file its type and size, and an image its bytes to show", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const dir = makeProject({});
    writeFileSync(join(dir, "dot.png"), png);
    writeFileSync(join(dir, "font.woff2"), Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 2]));
    expect(rawToNode(dir, "dot.png")).toMatchObject({
      kind: "binary",
      about: "PNG image · 70 B",
      image: `data:image/png;base64,${png.toString("base64")}`,
    });
    expect(rawToNode(dir, "font.woff2")).toMatchObject({
      kind: "binary",
      about: "WOFF2 file · 7 B",
    });
    expect(rawToNode(dir, "font.woff2").image).toBeUndefined();
  });
});

describe("buildTree: docs/ (spec §3.4)", () => {
  it("is an ordinary folder, in its sorted place", () => {
    const dir = makeProject({
      "docs/lessons.md": "Lessons body.",
      "main.ts": "const a = 1;\n",
    });
    const tree = buildTree(dir);
    expect(tree.children.map((n) => n.path)).toEqual(["docs", "main.ts"]);
    expect(findNode(tree, "docs/lessons.md")?.prose).toBe("Lessons body.");
  });
});

describe("projectFiles: a git-aware walk (spec §4.2)", () => {
  it("lists tracked and untracked files, leaving out what .gitignore excludes", () => {
    const dir = makeProject({
      ".gitignore": "coverage/\nbuild/\n",
      "src/a.ts": "export {};\n",
      "src/new.ts": "export {};\n",
      "coverage/report.js": "x;\n",
      "build/out.js": "x;\n",
      "dist/kept.js": "x;\n",
    });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", "src/a.ts"], { cwd: dir });
    // `dist/` isn't ignored here, so git mode shows it: only .gitignore decides.
    expect(projectFiles(dir)).toEqual([".gitignore", "dist/kept.js", "src/a.ts", "src/new.ts"]);
    expect(buildTree(dir).children.map((n) => n.name)).toEqual([".gitignore", "dist", "src"]);
  });

  it("names what's ignored in one folder, at the level .gitignore names it", () => {
    const dir = makeProject({
      ".gitignore": "node_modules/\n.env\n*.log\n",
      ".env": "SECRET=1\n",
      "node_modules/dep/index.js": "x;\n",
      "src/a.ts": "export {};\n",
      "src/debug.log": "x\n",
    });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    expect(ignoredIn(dir, "")).toEqual([".env", "node_modules/"]);
    expect(ignoredIn(dir, "src")).toEqual(["debug.log"]);
    expect(projectFiles(dir)).toEqual([".gitignore", "src/a.ts"]);
  });

  it("drops a file that's deleted but still in the index", () => {
    const dir = makeProject({ "a.ts": "export {};\n", "b.ts": "export {};\n" });
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", "."], { cwd: dir });
    rmSync(join(dir, "b.ts"));
    expect(projectFiles(dir)).toEqual(["a.ts"]);
  });

  it("walks the disk with the fixed skip list outside a git repository", () => {
    const dir = makeProject({
      "node_modules/dep/index.js": "x;\n",
      ".cache/x.js": "x;\n",
      "src/a.ts": "export {};\n",
    });
    expect(projectFiles(dir)).toEqual(["src/a.ts"]);
    expect(ignoredIn(dir, "")).toEqual([]);
  });

  it("never follows a symbolic link, so a commit's export can't reach outside itself", () => {
    const outside = makeProject({ "secret.txt": "x\n" });
    const dir = mkdtempSync(join(tmpdir(), "prose-tree-link-"));
    writeFileSync(join(dir, "a.ts"), "export {};\n");
    symlinkSync(join(outside, "secret.txt"), join(dir, "secret.txt"));
    symlinkSync(outside, join(dir, "linked"));
    try {
      expect(walkFiles(dir, "")).toEqual(["a.ts"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("findNode", () => {
  it("finds a node by its stable path, including a chunk's #-anchored path", () => {
    const dir = makeProject({
      "main.js": "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n",
    });
    const tree = buildTree(dir);
    const found = findNode(tree, "main.js#a");
    expect(found?.kind).toBe("chunk");
    expect(found?.prose).toBe("A chunk.");
  });

  it("returns null for a path that does not exist in the tree", () => {
    const dir = makeProject({ "main.js": "const a = 1;\n" });
    const tree = buildTree(dir);
    expect(findNode(tree, "nope.js")).toBeNull();
  });
});
