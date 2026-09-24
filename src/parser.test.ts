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
		// scanJsLike doesn't disambiguate a regex literal from a template string; a bare
		// backtick in a regex (e.g. `/\`/g`) is treated as opening a template literal that only
		// "closes" at the next backtick anywhere later in the source, permanently miscounting
		// `{`/`}` depth from that point on. Found dogfooding this file's own slugify() (`prose/
		// lessons.md`), which used to write this trap directly.
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
