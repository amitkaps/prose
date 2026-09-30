import { describe, expect, it } from "vite-plus/test";
import { declaredIdentifiers } from "./names.js";

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

	it("finds destructured top-level bindings, including nested, renamed, and rest — a real parser's win over regex", () => {
		const code = "const { a, b: renamed, nested: { c }, ...rest } = x;";
		expect([...declaredIdentifiers(code)].sort()).toEqual(["a", "c", "rest", "renamed"].sort());
	});

	it("only counts top-level declarations, not ones nested inside a function body", () => {
		const code = "function outer() { const inner = 1; }";
		expect([...declaredIdentifiers(code)].sort()).toEqual(["outer"]);
	});

	it("skips the parse entirely for non-js codeLang, never returning false declarations from CSS/HTML text", () => {
		const cssLike = "h1 { color: red; }\nconst used = new Set();";
		expect(declaredIdentifiers(cssLike, "css")).toEqual(new Set());
		expect(declaredIdentifiers(cssLike, "html")).toEqual(new Set());
		// The same text, parsed as JS (which it partly resembles), still degrades safely: oxc-parser
		// stops at the first syntax error rather than throwing, so this returns whatever real
		// declarations came *before* the error, not nothing and not a crash.
		expect(declaredIdentifiers(cssLike, "js")).toEqual(new Set());
	});
});
