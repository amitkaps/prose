import * as fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";
import { firstParagraph, parseFile } from "./parser.js";

describe("parseFile: JS/TS/CSS (/** @prose */)", () => {
	it("reads the first block as file prose and later blocks as chunks", () => {
		const source = `/** @prose\n * File summary.\n */\nimport x from "y";\n\n/** @prose\n * A chunk.\n */\nconst a = 1;\n`;
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBe("File summary.");
		expect(parsed.preamble).toBe('import x from "y";');
		expect(parsed.sections).toHaveLength(1);
		expect(parsed.sections[0].chunks).toHaveLength(1);
		expect(parsed.sections[0].chunks[0].prose).toBe("A chunk.");
		expect(parsed.sections[0].chunks[0].code).toBe("const a = 1;");
		expect(parsed.sections[0].chunks[0].pending).toBe(false);
	});

	it("marks a chunk pending when no code follows before EOF", () => {
		const source = `/** @prose\n * File.\n */\n\n/** @prose\n * Plan item.\n */\n`;
		const parsed = parseFile(source, "js");
		expect(parsed.sections[0].chunks[0].pending).toBe(true);
		expect(parsed.sections[0].chunks[0].code).toBe("");
	});

	it("starts a new section on a heading line, and keeps the heading block as a chunk too", () => {
		const source = [
			"/** @prose\n * File.\n */",
			"/** @prose\n * # State\n *\n * About state.\n */\nlet count = 0;",
			"/** @prose\n * A second chunk in the same section.\n */\nlet x = 1;",
		].join("\n\n");
		const parsed = parseFile(source, "js");
		expect(parsed.sections).toHaveLength(1);
		expect(parsed.sections[0].heading).toBe("State");
		expect(parsed.sections[0].chunks).toHaveLength(2);
		expect(parsed.sections[0].chunks[0].heading).toBe("State");
		expect(parsed.sections[0].chunks[1].heading).toBeNull();
	});

	it("ignores unmarked comments entirely, treating them as code", () => {
		const source = `// just a code comment\n/** normal jsdoc, no @prose */\nconst a = 1;\n`;
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBeNull();
		expect(parsed.preamble).toBe(source.trim());
	});

	it("strips the leading ` * ` gutter from continuation lines", () => {
		const source = `/** @prose\n * Line one.\n * Line two.\n */\n`;
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBe("Line one.\nLine two.");
	});

	it("eats a body line's own leading * when that line skips the gutter (documented landmine)", () => {
		// Every continuation line is expected to carry the ` * ` gutter (spec.md §3.1). A line
		// that skips it and starts with a literal `*` of its own (e.g. a markdown bullet) is
		// indistinguishable from a gutter line to the strip regex, and loses its marker.
		const source = `/** @prose\n * Intro.\n* a bullet\n */\n`;
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBe("Intro.\na bullet");
	});

	it("does not let a backtick inside a regex literal corrupt depth tracking for the rest of the file", () => {
		// The old hand tokenizer read a bare backtick in a regex (e.g. `/\`/g`) as a template literal
		// and miscounted depth for the rest of the file (`prose/lessons.md`). oxc reads it right.
		const source = [
			"const RE = /`/g;",
			"function useless() { const x = 1; }",
			"/** @prose A chunk after the regex. */",
			"const a = 1;",
		].join("\n");
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBe("A chunk after the regex.");
	});

	it("still treats a bare / after a value as division, not a regex", () => {
		// `a / b` — the `/` follows an identifier, so it must stay division. If this were ever
		// misread as a regex start, it would scan forward looking for a closing `/` and could
		// swallow real code (including a later @prose block) as if it were inside the "regex".
		const source = [
			"const ratio = a / b;",
			"/** @prose A chunk after a division. */",
			"const c = 1;",
		].join("\n");
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBe("A chunk after a division.");
	});

	it("handles a / inside a regex character class without ending the regex early", () => {
		const source = [
			"const RE = /[a/b]/g;",
			"/** @prose A chunk after a regex with a slash in a character class. */",
			"const c = 1;",
		].join("\n");
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBe("A chunk after a regex with a slash in a character class.");
	});
});

describe("parseFile: HTML (<!-- @prose -->)", () => {
	it("takes body lines as-is, with no gutter stripping", () => {
		const source = `<!-- @prose\nLine one.\n * looks like a bullet but is not a gutter\n-->\n<h1>hi</h1>\n`;
		const parsed = parseFile(source, "html");
		expect(parsed.fileProse).toBe("Line one.\n * looks like a bullet but is not a gutter");
	});

	it("chunks code between comments", () => {
		const source = `<!-- @prose\nFile.\n-->\n<!-- @prose\nA chunk.\n-->\n<h1>hi</h1>\n`;
		const parsed = parseFile(source, "html");
		expect(parsed.sections[0].chunks[0].code).toBe("<h1>hi</h1>");
	});
});

describe("parseFile: YAML/TOML (# @prose)", () => {
	it("reads a top-level # comment block as file prose, gutter stripped", () => {
		const source = "# @prose\n# File summary.\nname: demo\n";
		const parsed = parseFile(source, "yaml");
		expect(parsed.fileProse).toBe("File summary.");
		expect(parsed.preamble).toBe("name: demo");
	});

	it("chunks code between # comment blocks, in a .toml file", () => {
		const source = "# @prose\n# File.\n\n# @prose\n# A chunk.\nport = 8080\n";
		const parsed = parseFile(source, "toml");
		expect(parsed.sections[0].chunks[0].prose).toBe("A chunk.");
		expect(parsed.sections[0].chunks[0].code).toBe("port = 8080");
		expect(parsed.sections[0].chunks[0].commentStyle).toBe("hash");
		expect(parsed.sections[0].chunks[0].codeLang).toBe("toml");
	});

	it("does not treat an indented # comment (nested inside a mapping) as a prose block", () => {
		const source = "top:\n  # not top-level, just a code comment\n  child: 1\n";
		const parsed = parseFile(source, "yaml");
		expect(parsed.fileProse).toBeNull();
	});

	it("ignores unmarked # comments, treating them as ordinary code", () => {
		const source = "# just a comment\nname: demo\n";
		const parsed = parseFile(source, "yaml");
		expect(parsed.fileProse).toBeNull();
	});
});

describe("parseFile: .svelte (script/style as JS/CSS, markup as HTML, merged in order)", () => {
	it("merges blocks from all three parts in source order", () => {
		const source = [
			'<script lang="ts">',
			"/** @prose\n * # Title\n * File-level prose from the script part.\n */",
			'import x from "y";',
			"",
			"/** @prose A chunk in the script. */",
			"let a = 1;",
			"</script>",
			"",
			"<!-- @prose Markup chunk. -->",
			"<h1>hi</h1>",
			"",
			"<style>",
			"/** @prose A style chunk. */",
			"h1 { color: red; }",
			"</style>",
			"",
		].join("\n");
		const parsed = parseFile(source, "svelte");
		expect(parsed.fileProse).toBe("# Title\nFile-level prose from the script part.");
		expect(parsed.preamble).toBe('import x from "y";');
		const chunks = parsed.sections.flatMap((s) => s.chunks);
		expect(chunks.map((c) => c.prose)).toEqual([
			"A chunk in the script.",
			"Markup chunk.",
			"A style chunk.",
		]);
	});

	it("clips each chunk's code at its own part boundary — no bleed across </script>/<style>", () => {
		const source = [
			'<script lang="ts">',
			"/** @prose File prose — the first block, so it is not a chunk. */",
			"",
			"/** @prose A chunk. */",
			"let a = 1;",
			"</script>",
			"",
			"<!-- @prose Markup. -->",
			"<h1>hi</h1>",
			"",
			"<style>",
			"/** @prose Style. */",
			"h1 { color: red; }",
			"</style>",
		].join("\n");
		const parsed = parseFile(source, "svelte");
		const chunks = parsed.sections.flatMap((s) => s.chunks);
		expect(chunks[0].code).toBe("let a = 1;");
		expect(chunks[0].code).not.toContain("</script>");
		expect(chunks[1].code).toBe("<h1>hi</h1>");
		expect(chunks[1].code).not.toContain("<style>");
		expect(chunks[2].code).toBe("h1 { color: red; }");
		expect(chunks[2].code).not.toContain("</style>");
	});
});

describe("parseFile: @note", () => {
	it("folds an @note directly after a chunk's @prose block into that chunk", () => {
		const source = [
			"/** @prose File. */",
			"",
			"/** @prose A chunk. */",
			"/** @note Should this reject duplicates? */",
			"const a = 1;",
		].join("\n");
		const parsed = parseFile(source, "js");
		const chunk = parsed.sections[0].chunks[0];
		expect(chunk.note).toBe("Should this reject duplicates?");
		expect(chunk.code).toBe("const a = 1;");
		expect(chunk.code).not.toContain("@note");
	});

	it("folds a hash-style @note after a YAML @prose block into that chunk, with no blank line between the two markers", () => {
		const source =
			"# @prose\n# File.\n\n# @prose\n# A chunk.\n# @note Double-check this port.\nport: 8080\n";
		const parsed = parseFile(source, "yaml");
		const chunk = parsed.sections[0].chunks[0];
		expect(chunk.prose).toBe("A chunk.");
		expect(chunk.note).toBe("Double-check this port.");
		expect(chunk.code).toBe("port: 8080");
		expect(chunk.commentStyle).toBe("hash");
	});

	it("records commentStyle and exact byte offsets for a chunk with no note yet", () => {
		const source = ["/** @prose File. */", "", "/** @prose A chunk. */", "const a = 1;"].join("\n");
		const parsed = parseFile(source, "js");
		const chunk = parsed.sections[0].chunks[0];
		expect(chunk.commentStyle).toBe("js");
		expect(chunk.note).toBeUndefined();
		expect(chunk.noteStartIndex).toBeUndefined();
		expect(source.slice(chunk.proseEndIndex)).toBe("\nconst a = 1;");
	});

	it("records the note's exact byte span when one exists", () => {
		const source = [
			"/** @prose File. */",
			"",
			"/** @prose A chunk. */",
			"/** @note A question. */",
			"const a = 1;",
		].join("\n");
		const parsed = parseFile(source, "js");
		const chunk = parsed.sections[0].chunks[0];
		expect(source.slice(chunk.noteStartIndex, chunk.noteEndIndex)).toBe("/** @note A question. */");
	});

	it("drops a note that has real code between it and the preceding prose block", () => {
		const source = [
			"/** @prose File. */",
			"",
			"/** @prose A chunk. */",
			"const a = 1;",
			"/** @note Too late, code is already here. */",
			"const b = 2;",
		].join("\n");
		const parsed = parseFile(source, "js");
		const chunks = parsed.sections.flatMap((s) => s.chunks);
		expect(chunks.every((c) => c.note === undefined)).toBe(true);
		expect(chunks[0].code).toContain("const a = 1;");
	});

	it("drops a leading note with no preceding prose block to attach to", () => {
		const source = "/** @note Nothing came before this. */\nconst a = 1;\n";
		const parsed = parseFile(source, "js");
		expect(parsed.fileProse).toBeNull();
		expect(parsed.preamble).toBe(source.trim());
	});

	it("supports @note in HTML comment style too, with no gutter stripped", () => {
		const source = [
			"<!-- @prose File. -->",
			"<!-- @prose A chunk. -->",
			"<!-- @note A question. -->",
			"<h1>hi</h1>",
		].join("\n");
		const parsed = parseFile(source, "html");
		const chunk = parsed.sections[0].chunks[0];
		expect(chunk.note).toBe("A question.");
		expect(chunk.commentStyle).toBe("html");
	});
});

describe("firstParagraph", () => {
	it("skips a leading heading and returns the first paragraph", () => {
		expect(firstParagraph("# Title\n\nFirst paragraph.\n\nSecond paragraph.")).toBe(
			"First paragraph.",
		);
	});

	it("returns the whole text when there is no heading or second paragraph", () => {
		expect(firstParagraph("Just one paragraph.")).toBe("Just one paragraph.");
	});
});

const anchorsOf = (source: string, ext = "ts") =>
	parseFile(source, ext).sections.flatMap((s) => s.chunks.map((c) => c.anchor));

describe("anchors (spec §3.2)", () => {
	it("names a chunk by its first declared name, then its heading, then its position", () => {
		const source = [
			"/** @prose File. */",
			"/** @prose Adds. */\nexport function addTodo() {}",
			"/** @prose\n * # Filtering\n */",
			"/** @prose Loose. */\nconsole.log(1);",
		].join("\n\n");
		expect(anchorsOf(source)).toEqual(["addTodo", "filtering", "chunk-3"]);
	});

	it("suffixes repeats in source order, and keeps `file` for the file prose", () => {
		const source = [
			"/** @prose File. */",
			"/** @prose One. */\nconst file = 1;",
			"/** @prose Two. */\nfunction a() {}",
			"/** @prose Three. */\nfunction a(x) {}",
		].join("\n\n");
		expect(anchorsOf(source)).toEqual(["file-2", "a", "a-2"]);
		expect(parseFile(source, "ts").fileBlock?.anchor).toBe("file");
	});

	it("gives a heading in a non-JS file its slug", () => {
		expect(
			anchorsOf("/** @prose File. */\n\n/** @prose\n * # Layout\n */\nmain { }", "css"),
		).toEqual(["layout"]);
	});

	it("property: inserting a block anywhere never changes what an existing anchor names", () => {
		const names = ["alpha", "beta", "gamma", "delta"];
		const chunk = (n: string) => `/** @prose ${n}. */\nexport const ${n} = 1;`;
		const heading = "/** @prose\n * # Notes\n */";
		fc.assert(
			fc.property(
				fc.subarray(names, { minLength: 1 }),
				fc.nat(),
				fc.constantFrom(chunk("epsilon"), heading, "/** @prose Bare. */"),
				(present, at, inserted) => {
					const blocks = present.map(chunk);
					const before = ["/** @prose File. */", ...blocks].join("\n\n");
					const i = at % (blocks.length + 1);
					const after = [
						"/** @prose File. */",
						...blocks.slice(0, i),
						inserted,
						...blocks.slice(i),
					].join("\n\n");
					const beforeChunks = parseFile(before, "ts").sections.flatMap((s) => s.chunks);
					const afterByCode = new Map(
						parseFile(after, "ts")
							.sections.flatMap((s) => s.chunks)
							.map((c) => [c.anchor, c.code]),
					);
					for (const c of beforeChunks) expect(afterByCode.get(c.anchor)).toBe(c.code);
				},
			),
		);
	});
});

describe("misplaced blocks (spec §3.1)", () => {
	it("reports a @prose block inside a function or a rule, and does not make it a block", () => {
		const js = "/** @prose File. */\nfunction f() {\n  /** @prose Inside. */\n  g();\n}\n";
		const parsed = parseFile(js, "ts");
		expect(parsed.misplaced).toEqual([3]);
		expect(parsed.sections.flatMap((s) => s.chunks)).toEqual([]);
		const css = "/** @prose File. */\n.a {\n  /** @prose Inside. */\n  color: red;\n}\n";
		expect(parseFile(css, "css").misplaced).toEqual([3]);
	});

	it("does not report a top-level block after a function, or an object literal's comment that isn't a block", () => {
		const s =
			"/** @prose File. */\nfunction f() {}\n/** @prose Next. */\nconst a = { /** doc */ b: 1 };\n";
		const parsed = parseFile(s, "ts");
		expect(parsed.misplaced).toEqual([]);
		expect(parsed.sections[0].chunks).toHaveLength(1);
	});
});

describe("line notes (spec §6.2)", () => {
	it("makes a note straight after a @prose block its block note, and any other a line note", () => {
		const s = [
			"/** @prose File. */",
			"/** @prose A chunk. */",
			"/** @note Block note. */",
			"/** @note Second, so a line note. */",
			"function f() {",
			"  /** @note In the body. */",
			"  g();",
			"}",
		].join("\n");
		const parsed = parseFile(s, "ts");
		expect(parsed.sections[0].chunks[0].note).toBe("Block note.");
		expect(parsed.lineNotes.map((n) => [n.startLine, n.text])).toEqual([
			[4, "Second, so a line note."],
			[6, "In the body."],
		]);
	});

	it("finds a note in a file with no @prose block at all", () => {
		const parsed = parseFile("const a = 1;\n/** @note Alone. */\nconst b = 2;\n", "ts");
		expect(parsed.fileBlock).toBeNull();
		expect(parsed.lineNotes.map((n) => n.text)).toEqual(["Alone."]);
	});

	it("reads an indented YAML note, but not an indented @prose", () => {
		const s =
			"# @prose\n# File.\na:\n  # @note\n  # Deep.\n  b: 1\n  # @prose\n  # Ignored.\n  c: 2\n";
		const parsed = parseFile(s, "yaml");
		expect(parsed.lineNotes.map((n) => n.text)).toEqual(["Deep."]);
		expect(parsed.sections.flatMap((s) => s.chunks)).toEqual([]);
	});
});
