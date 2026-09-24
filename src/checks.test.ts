import { describe, expect, it } from "vite-plus/test";
import { checkStaleness, checkSymbols, declaredIdentifiers, extractCodeSpans } from "./checks.js";

describe("extractCodeSpans", () => {
	it("picks out identifier-shaped inline code spans, including dotted chains", () => {
		expect(extractCodeSpans("Calls `addTodo` then `store.subscribe`.")).toEqual([
			"addTodo",
			"store.subscribe",
		]);
	});

	it("skips spans that aren't identifier-shaped and known keywords/literals", () => {
		expect(extractCodeSpans("`completed: false` and `true` and `1 + 1`.")).toEqual([]);
	});

	it("doesn't cross a fenced code block's triple backticks as if they were one span", () => {
		expect(extractCodeSpans("Some text.\n\n```\nconst x = 1;\n```\n")).toEqual([]);
	});

	it("skips a file cross-reference, which is identifier-shaped but not a symbol", () => {
		expect(extractCodeSpans("See `README.md` and `parser.ts` and `plugin.ts`.")).toEqual([]);
	});

	it("skips reserved words that could never be a declaration site", () => {
		expect(extractCodeSpans("Uses `return`, `import`, `export`, and `interface`.")).toEqual([]);
	});

	it("skips import.meta forms, which are syntax rather than a declared identifier", () => {
		expect(extractCodeSpans("Reads `import.meta.url` and `import.meta.glob`.")).toEqual([]);
	});

	it("skips standard-library globals, which no project 'declares'", () => {
		expect(extractCodeSpans("Uses a `Set` and a `Promise` and `console`.")).toEqual([]);
	});
});

describe("declaredIdentifiers", () => {
	it("finds function, class, const/let/var, interface, and type declarations, exported or not", () => {
		const code = `
			export function addTodo() {}
			class Store {}
			const count = 0;
			export const total = 1;
			interface Todo {}
			type Id = string;
		`;
		expect([...declaredIdentifiers(code)].sort()).toEqual(
			["Id", "Store", "Todo", "addTodo", "count", "total"].sort(),
		);
	});

	it("finds default, namespace, and named import bindings, including aliases and type-only", () => {
		const code = `
			import marked from "marked";
			import * as fs from "node:fs";
			import { readFile, writeFile as write } from "node:fs/promises";
			import type { RendererObject } from "marked";
			import defaultExport, { named } from "pkg";
		`;
		expect([...declaredIdentifiers(code)].sort()).toEqual(
			["RendererObject", "defaultExport", "fs", "marked", "named", "readFile", "write"].sort(),
		);
	});
});

describe("checkSymbols", () => {
	it("resolves a symbol declared in the chunk's own code as local, with no warning", () => {
		const { symbols, warnings } = checkSymbols(
			"Calls `addTodo`.",
			"function addTodo() {}",
			"main.js#top-chunk-0",
			new Map(),
		);
		expect(symbols).toEqual([{ text: "addTodo", status: "local" }]);
		expect(warnings).toEqual([]);
	});

	it("resolves a symbol declared elsewhere in the project as linked, with no warning", () => {
		const table = new Map([["addTodo", "store.ts#top-chunk-0"]]);
		const { symbols, warnings } = checkSymbols(
			"Calls `addTodo`.",
			"",
			"main.js#top-chunk-0",
			table,
		);
		expect(symbols).toEqual([
			{ text: "addTodo", status: "linked", target: "store.ts#top-chunk-0" },
		]);
		expect(warnings).toEqual([]);
	});

	it("flags a symbol declared nowhere as unresolved", () => {
		const { symbols, warnings } = checkSymbols(
			"Calls `addTod0`.",
			"",
			"main.js#top-chunk-0",
			new Map(),
		);
		expect(symbols).toEqual([{ text: "addTod0", status: "unresolved" }]);
		expect(warnings).toEqual([
			{
				kind: "unresolved-symbol",
				symbol: "addTod0",
				message: "`addTod0` isn't declared anywhere in this project.",
			},
		]);
	});

	it("skips a span matching a known package dependency name, e.g. naming a library by its npm name", () => {
		const knownPackages = new Set(["marked"]);
		const { symbols, warnings } = checkSymbols(
			"Uses `marked`'s renderer hook.",
			"",
			"docs.ts#top-chunk-0",
			new Map(),
			new Set(),
			knownPackages,
		);
		expect(symbols).toEqual([]);
		expect(warnings).toEqual([]);
	});

	it("resolves a symbol declared only in the file's preamble as local, via fileScope", () => {
		const fileScope = new Set(["marked"]);
		const { symbols, warnings } = checkSymbols(
			"Uses `marked`'s renderer hook.",
			"",
			"docs.ts#top-chunk-0",
			new Map(),
			fileScope,
		);
		expect(symbols).toEqual([{ text: "marked", status: "local" }]);
		expect(warnings).toEqual([]);
	});

	it("doesn't flag a symbol declared in this same chunk via the project table (self-reference isn't 'elsewhere')", () => {
		const table = new Map([["addTodo", "main.js#top-chunk-0"]]);
		const { symbols } = checkSymbols(
			"Calls `addTodo`.",
			"function addTodo() {}",
			"main.js#top-chunk-0",
			table,
		);
		expect(symbols).toEqual([{ text: "addTodo", status: "local" }]);
	});
});

describe("checkStaleness", () => {
	it("flags a chunk whose code's newest line is newer than its prose's newest line", () => {
		const blame = [
			{ line: 1, time: 100 },
			{ line: 2, time: 100 },
			{ line: 3, time: 200 },
		];
		expect(checkStaleness(blame, 1, 2, 2, 3)).toEqual([
			{ kind: "stale", message: "The code changed more recently than its prose." },
		]);
	});

	it("doesn't flag a chunk whose prose is at least as new as its code", () => {
		const blame = [
			{ line: 1, time: 200 },
			{ line: 2, time: 200 },
			{ line: 3, time: 100 },
		];
		expect(checkStaleness(blame, 1, 2, 2, 3)).toEqual([]);
	});

	it("doesn't flag anything when there's no blame data (untracked file, or no git repo)", () => {
		expect(checkStaleness(null, 1, 2, 2, 3)).toEqual([]);
	});
});
