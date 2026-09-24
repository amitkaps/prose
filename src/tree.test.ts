import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildTree, findNode } from "./tree.js";

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
		expect(tree.children).toHaveLength(1);
		expect(tree.children[0].path).toBe("main.js");
		expect(tree.children[0].summary).toBe("File summary.");
	});

	it("marks a file with no @prose blocks as undocumented", () => {
		const dir = makeProject({ "main.js": "const a = 1;\n" });
		const tree = buildTree(dir);
		expect(tree.children[0].summary).toBe("undocumented");
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
		const chunk = tree.children[0].children[0];
		expect(chunk.pending).toBe(true);
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
});

describe("findNode", () => {
	it("finds a node by its stable path, including a chunk's #-anchored path", () => {
		const dir = makeProject({
			"main.js": "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n",
		});
		const tree = buildTree(dir);
		const found = findNode(tree, "main.js#top-chunk-0");
		expect(found?.kind).toBe("chunk");
		expect(found?.prose).toBe("A chunk.");
	});

	it("returns null for a path that does not exist in the tree", () => {
		const dir = makeProject({ "main.js": "const a = 1;\n" });
		const tree = buildTree(dir);
		expect(findNode(tree, "nope.js")).toBeNull();
	});
});
