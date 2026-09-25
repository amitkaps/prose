import { describe, expect, it } from "vite-plus/test";
import { ordered, resolvePath, segments, type TreeNode } from "./nav.js";

const n = (kind: TreeNode["kind"], path: string): TreeNode => ({
	name: path,
	kind,
	path,
	summary: "",
	warningCount: 0,
	children: [],
});

describe("ordered", () => {
	it("puts project docs first, then folders, then files, keeping alphabetical order within a group", () => {
		const out = ordered([
			n("file", "a.ts"),
			n("raw", "package.json"),
			n("folder", "src"),
			n("file", "prose/spec.md"),
			n("folder", "client"),
		]);
		expect(out.map((x) => x.path)).toEqual([
			"prose/spec.md",
			"src",
			"client",
			"a.ts",
			"package.json",
		]);
	});
});

describe("resolvePath", () => {
	const file = { ...n("file", "a.ts"), blocks: [n("chunk", "a.ts#x")] };
	const tree = { ...n("project", "."), children: [file] };

	it("resolves a block path to its file plus a focus", () => {
		expect(resolvePath(tree, "a.ts#x")).toEqual({ node: file, focus: "a.ts#x" });
		expect(resolvePath(tree, "a.ts")).toEqual({ node: file, focus: null });
	});

	it("falls back to the project for an unknown path, and to the file for an unknown block", () => {
		expect(resolvePath(tree, "nope.ts").node).toBe(tree);
		expect(resolvePath(tree, "a.ts#gone")).toEqual({ node: file, focus: null });
	});
});

describe("segments", () => {
	const block = (start: number, end: number): TreeNode => ({
		...n("chunk", "f#b"),
		span: [start, end],
	});

	it("interleaves code runs with block spans, dropping the comment text and blank edges", () => {
		const source = "import x;\n\n/** @prose A */\nconst a = 1;\n\n/** @prose B */\n";
		const a = source.indexOf("/** @prose A */");
		const b = source.indexOf("/** @prose B */");
		const out = segments(source, [block(a, a + 15), block(b, b + 15)]);
		expect(out.map((s) => (s.kind === "code" ? s.text : "BLOCK"))).toEqual([
			"import x;",
			"BLOCK",
			"const a = 1;",
			"BLOCK",
		]);
	});

	it("is just the code for a file with no blocks", () => {
		expect(segments("const a = 1;\n", [])).toEqual([
			{ kind: "code", text: "const a = 1;", line: 1 },
		]);
	});
	it("carries each code run's first line, and lays a line note out in place", () => {
		const source = "a();\n\n/** @note hi */\nb();\nc();\n";
		const at = source.indexOf("/** @note");
		const note = { path: "f:3", text: "hi", hash: "h", span: [at, at + 15] as [number, number] };
		expect(segments(source, [], [note])).toEqual([
			{ kind: "code", text: "a();", line: 1 },
			{ kind: "note", note },
			{ kind: "code", text: "b();\nc();", line: 4 },
		]);
	});
});
