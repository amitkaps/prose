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

describe("buildTree: prose/ cross-cutting docs (spec §3.4)", () => {
	it("surfaces prose/*.md files at L3, ahead of the folder tree, sorted alphabetically", () => {
		const dir = makeProject({
			"prose/lessons.md": "Lessons body.",
			"prose/architecture.md": "Architecture body.",
			"src/main.ts": "const a = 1;\n",
		});
		const tree = buildTree(dir);
		expect(tree.children.map((n) => n.path)).toEqual([
			"prose/architecture.md",
			"prose/lessons.md",
			"src",
		]);
		expect(tree.children[0].prose).toBe("Architecture body.");
	});

	it("excludes remarks.md from the surfaced docs", () => {
		const dir = makeProject({
			"prose/remarks.md": "## some/file.ts\n\n- [ ] a remark",
			"prose/lessons.md": "Lessons body.",
		});
		const tree = buildTree(dir);
		expect(tree.children.map((n) => n.path)).toEqual(["prose/lessons.md"]);
	});

	it("never turns prose itself into an ordinary folder node", () => {
		const dir = makeProject({ "prose/lessons.md": "Lessons body." });
		const tree = buildTree(dir);
		expect(tree.children.find((n) => n.name === "prose")).toBeUndefined();
	});

	it("is a no-op when there is no prose/ directory", () => {
		const dir = makeProject({ "main.js": "const a = 1;\n" });
		const tree = buildTree(dir);
		expect(tree.children.map((n) => n.path)).toEqual(["main.js"]);
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

describe("buildTree: checks (spec §5)", () => {
	it("flags a symbol that resolves nowhere in the project, and rolls the count up to every ancestor", () => {
		const dir = makeProject({
			"main.js": "/** @prose File. */\n\n/** @prose Calls `doesNotExist`. */\nconst a = 1;\n",
		});
		const tree = buildTree(dir);
		const chunk = findNode(tree, "main.js#top-chunk-0");
		expect(chunk?.symbols).toEqual([{ text: "doesNotExist", status: "unresolved" }]);
		expect(chunk?.warnings).toEqual([
			{
				kind: "unresolved-symbol",
				symbol: "doesNotExist",
				message: "`doesNotExist` isn't declared anywhere in this project.",
			},
		]);
		expect(chunk?.warningCount).toBe(1);
		const file = findNode(tree, "main.js");
		expect(file?.warningCount).toBe(1);
		expect(tree.warningCount).toBe(1);
	});

	it("links a symbol declared in a different chunk, project-wide, with no warning", () => {
		const dir = makeProject({
			"store.ts":
				"/** @prose Store. */\n\n/** @prose The store. */\nexport function addTodo() {}\n",
			"main.js": "/** @prose File. */\n\n/** @prose Calls `addTodo`. */\nconst a = 1;\n",
		});
		const tree = buildTree(dir);
		const chunk = findNode(tree, "main.js#top-chunk-0");
		expect(chunk?.symbols).toEqual([
			{ text: "addTodo", status: "linked", target: "store.ts#top-chunk-0" },
		]);
		expect(chunk?.warningCount).toBe(0);
		expect(tree.warningCount).toBe(0);
	});

	it("resolves a symbol imported only in the file's preamble, shared across every chunk in that file", () => {
		const dir = makeProject({
			"docs.ts": [
				"/** @prose File. */",
				'import { marked } from "marked";',
				"",
				"/** @prose Uses `marked` to render docs. */",
				"export function render() {}",
			].join("\n"),
		});
		const tree = buildTree(dir);
		const chunk = findNode(tree, "docs.ts#top-chunk-0");
		expect(chunk?.symbols).toEqual([{ text: "marked", status: "local" }]);
		expect(chunk?.warningCount).toBe(0);
	});

	it("has no warnings for a project with no git repo and no unresolved symbols", () => {
		const dir = makeProject({
			"main.js": "/** @prose File. */\n\n/** @prose A plain chunk, no symbols. */\nconst a = 1;\n",
		});
		const tree = buildTree(dir);
		expect(tree.warningCount).toBe(0);
	});
});
