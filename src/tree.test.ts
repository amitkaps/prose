import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildTree, findNode, projectFiles } from "./tree.js";

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

  it("skips lockfiles by name even though .yaml/.toml are otherwise walked", () => {
    const dir = makeProject({
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "package.json": "{}\n",
      "config.toml": "port = 8080\n",
    });
    const tree = buildTree(dir);
    // `package.json` is a raw file now, so it stays; the lockfile is the one excluded.
    expect(tree.children.map((n) => n.name)).toEqual(["config.toml", "package.json"]);
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

  it("still excludes generated lockfiles", () => {
    const dir = makeProject({ "package-lock.json": "{}", "main.ts": "const a = 1;\n" });
    expect(buildTree(dir).children.map((n) => n.path)).toEqual(["main.ts"]);
  });
});

describe("buildTree: prose/ (spec §3.4)", () => {
  it("is an ordinary folder, in its sorted place", () => {
    const dir = makeProject({
      "prose/lessons.md": "Lessons body.",
      "main.ts": "const a = 1;\n",
    });
    const tree = buildTree(dir);
    expect(tree.children.map((n) => n.path)).toEqual(["main.ts", "prose"]);
    expect(findNode(tree, "prose/lessons.md")?.prose).toBe("Lessons body.");
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
    expect(projectFiles(dir)).toEqual(["dist/kept.js", "src/a.ts", "src/new.ts"]);
    expect(buildTree(dir).children.map((n) => n.name)).toEqual(["dist", "src"]);
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
