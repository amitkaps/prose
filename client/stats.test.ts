import { describe, expect, it } from "vite-plus/test";
import type { TreeNode } from "./nav.js";
import { health, rollup } from "./stats.js";

const node = (over: Partial<TreeNode>): TreeNode => ({
	name: "n",
	kind: "chunk",
	path: "n",
	summary: "s",
	warningCount: 0,
	children: [],
	...over,
});

const tree = node({
	kind: "project",
	path: ".",
	children: [
		node({
			kind: "file",
			path: "a.ts",
			blocks: [
				node({
					path: "a.ts#one",
					code: "x\n".repeat(24),
					prose: "short",
					warnings: [{ kind: "stale", message: "" }],
					symbols: [{ text: "x", status: "unresolved" }],
				}),
				node({ path: "a.ts#two", pending: true, note: "look" }),
			],
		}),
		node({ kind: "file", path: "b.ts", summary: "undocumented" }),
	],
});

describe("stats", () => {
	it("rolls attention up to every ancestor", () => {
		const r = rollup(tree);
		expect(r.get("a.ts")).toEqual({ pending: 1, unresolved: 0, stale: 1, notes: 1 });
		expect(r.get(".")).toEqual({ pending: 1, unresolved: 0, stale: 1, notes: 1 });
	});

	it("summarizes project health", () => {
		const h = health(tree);
		expect(h.files).toEqual({ total: 2, documented: 1 });
		expect(h.blocks).toBe(2);
		expect(h.symbols.unresolved).toBe(1);
		expect(h.thinnest.map((t) => t.path)).toEqual(["a.ts"]);
	});
});
