import { describe, expect, it } from "vite-plus/test";
import { rank, score } from "./fuzzy.js";

describe("fuzzy", () => {
	it("matches subsequences case-insensitively and rejects non-matches", () => {
		expect(score("TRE", "src/tree.ts")).not.toBeNull();
		expect(score("xyz", "src/tree.ts")).toBeNull();
		expect(score("ts.", "src/tree.ts")).toBeNull();
	});

	it("prefers word-start and consecutive matches", () => {
		const items = ["src/a-truly-extended-entry.ts", "src/tree.ts"];
		expect(rank("tre", items, (s) => s)[0]).toBe("src/tree.ts");
	});

	it("returns the first items for an empty query", () => {
		expect(rank("", ["a", "b", "c"], (s) => s, 2)).toEqual(["a", "b"]);
	});
});
