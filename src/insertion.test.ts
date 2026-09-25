import { describe, expect, it } from "vite-plus/test";
import { landing } from "./insertion.js";

/** The 1-based line of the first line containing `marker`. */
const at = (source: string, marker: string) =>
	source.split("\n").findIndex((l) => l.includes(marker)) + 1;

const lands = (source: string, ext: string, marker: string) =>
	landing(source, ext, at(source, marker)).line;

describe("landing: JS and TS (the enclosing statement)", () => {
	const source = [
		"import x from 'y';", // 1
		"",
		"/** Adds. */", // 3
		"export function add(a: number) {", // 4
		"  const t = `", // 5
		"    inside template", // 6
		"  `;", // 7
		"  return call(a,", // 8
		"    b);", // 9
		"}", // 10
	].join("\n");

	it("lands above the statement itself, inside a function", () => {
		expect(lands(source, "ts", "const t")).toBe(5);
		expect(lands(source, "ts", "return call")).toBe(8);
	});
	it("never lands inside a template literal or a multi-line call", () => {
		expect(lands(source, "ts", "inside template")).toBe(5);
		expect(lands(source, "ts", "b);")).toBe(8);
	});
	it("keeps a doc comment attached to its function", () => {
		expect(lands(source, "ts", "export function")).toBe(3);
	});
	it("refuses blank and comment-only lines", () => {
		expect(() => landing(source, "ts", 2)).toThrow(/blank/);
		expect(() => landing(source, "ts", 3)).toThrow(/comment/);
	});
	it("does not split a marked prose block from its code", () => {
		const s = "/** @prose Adds. */\nfunction a() {}\n";
		expect(landing(s, "ts", 2).line).toBe(2);
	});
});

describe("landing: CSS (the rule or declaration)", () => {
	const source = [
		".a {", // 1
		"  color: red;", // 2
		"  background: url(data:image/png;base64,AAAA);", // 3
		"  margin:", // 4
		"    0 auto;", // 5
		"}", // 6
		"@media (min-width: 1px) {", // 7
		"  .b { top: 0 }", // 8
		"}", // 9
	].join("\n");

	it("lands above a declaration inside a rule", () => {
		expect(lands(source, "css", "color")).toBe(2);
		expect(lands(source, "css", "0 auto")).toBe(4);
	});
	it("does not end a declaration at a `;` inside url()", () => {
		expect(lands(source, "css", "background")).toBe(3);
	});
	it("lands above the rule for a closing brace and nested rules", () => {
		expect(landing(source, "css", 6).line).toBe(1);
		expect(lands(source, "css", ".b")).toBe(8);
	});
});

describe("landing: HTML (the element)", () => {
	const source = [
		"<main>", // 1
		"  <div", // 2
		'    class="a"', // 3
		'    data-x="<b>">', // 4
		"    text line", // 5
		"  </div>", // 6
		"  <pre>", // 7
		"line one", // 8
		"line two", // 9
		"  </pre>", // 10
		"  <!-- a", // 11
		"  comment -->", // 12
		"</main>", // 13
	].join("\n");

	it("lands above the element for a line in its attribute list", () => {
		expect(lands(source, "html", 'class="a"')).toBe(2);
		expect(lands(source, "html", "data-x")).toBe(2);
	});
	it("lands above a text line inside an element", () => {
		expect(lands(source, "html", "text line")).toBe(5);
	});
	it("lands above a <pre> for any line inside it", () => {
		expect(lands(source, "html", "line two")).toBe(7);
	});
	it("refuses a line inside a comment", () => {
		expect(() => landing(source, "html", 12)).toThrow(/comment/);
	});
});

describe("landing: .svelte (each part in its own language)", () => {
	const source = [
		"<script>", // 1
		"  const s = `a", // 2
		"b`;", // 3
		"</script>", // 4
		"",
		'<div class="x"', // 6
		'  id="y">hi</div>', // 7
		"",
		"<style>", // 9
		"  .a {", // 10
		"    color: red;", // 11
		"  }", // 12
		"</style>", // 13
	].join("\n");

	it("uses the statement rule in the script, the element rule in the markup, the rule in the style", () => {
		expect(landing(source, "svelte", 3)).toEqual({ line: 2, style: "js" });
		expect(landing(source, "svelte", 7)).toEqual({ line: 6, style: "html" });
		expect(landing(source, "svelte", 11)).toEqual({ line: 11, style: "js" });
	});
});

describe("landing: YAML and TOML (the key)", () => {
	it("lands above the key that opened a block scalar", () => {
		const s = ["a: 1", "script: |", "  echo one", "", "  echo two", "b: 2"].join("\n");
		expect(landing(s, "yaml", 3)).toEqual({ line: 2, style: "hash" });
		expect(landing(s, "yaml", 5)).toEqual({ line: 2, style: "hash" });
		expect(landing(s, "yaml", 6).line).toBe(6);
	});
	it("lands above a multi-line TOML string, array and inline table's first line", () => {
		const s = ["a = 1", 'b = """', "text", '"""', "c = [", "  1,", "  2,", "]", "d = 4"].join("\n");
		expect(landing(s, "toml", 3).line).toBe(2);
		expect(landing(s, "toml", 6).line).toBe(5);
		expect(landing(s, "toml", 9).line).toBe(9);
	});
	it("refuses a comment line", () => {
		expect(() => landing("# hi\na: 1", "yaml", 1)).toThrow(/comment/);
		expect(() => landing("# hi\na = 1", "toml", 1)).toThrow(/comment/);
	});
});
