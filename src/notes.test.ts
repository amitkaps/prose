import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parseFile } from "./parser.js";
import { addNote, resolveNote } from "./notes.js";

let root: string;

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

function makeFile(relPath: string, content: string): string {
	root = mkdtempSync(join(tmpdir(), "prose-notes-test-"));
	writeFileSync(join(root, relPath), content, "utf-8");
	return root;
}

describe("addNote", () => {
	it("inserts a brand-new note directly after the chunk's @prose block, in JS comment style", () => {
		makeFile(
			"main.js",
			["/** @prose File. */", "", "/** @prose A chunk. */", "const a = 1;", ""].join("\n"),
		);
		addNote(root, "main.js#top-chunk-0", "Should this reject duplicates?");
		const written = readFileSync(join(root, "main.js"), "utf-8");
		expect(written).toBe(
			[
				"/** @prose File. */",
				"",
				"/** @prose A chunk. */",
				"/** @note",
				" * Should this reject duplicates?",
				" */",
				"const a = 1;",
				"",
			].join("\n"),
		);
		// Round-trips: re-parsing the written file reads the note back out correctly.
		const reparsed = parseFile(written, "js");
		expect(reparsed.sections[0].chunks[0].note).toBe("Should this reject duplicates?");
	});

	it("measures indentation from the @prose block's opening line, not its closing gutter line", () => {
		// A multi-line JS-style block's closing line is " */" — one leading space from the ` * `
		// gutter, not the block's real column. Using that line's own leading whitespace as "the
		// indent" (instead of the opening `/**` line's) would misindent every inserted note by
		// exactly the gutter's width — a real bug, not a hypothetical one.
		makeFile(
			"main.js",
			[
				"/** @prose File. */",
				"",
				"/** @prose",
				" * A chunk with a multi-line block.",
				" */",
				"const a = 1;",
				"",
			].join("\n"),
		);
		addNote(root, "main.js#top-chunk-0", "A question.");
		const written = readFileSync(join(root, "main.js"), "utf-8");
		expect(written).toContain("\n/** @note\n * A question.\n */\nconst a = 1;");
		expect(written).not.toContain(" /** @note");
	});

	it("preserves the chunk's own indentation when inserting (HTML has no depth-0 restriction)", () => {
		makeFile(
			"index.html",
			[
				"<!-- @prose File. -->",
				"<div>",
				"\t<!-- @prose A chunk. -->",
				"\t<h1>hi</h1>",
				"</div>",
				"",
			].join("\n"),
		);
		addNote(root, "index.html#top-chunk-0", "A question.");
		const written = readFileSync(join(root, "index.html"), "utf-8");
		expect(written).toContain("\t<!-- @note\nA question.\n\t-->\n\t<h1>hi</h1>");
	});

	it("replaces an existing note in place rather than stacking a second one", () => {
		makeFile(
			"main.js",
			[
				"/** @prose File. */",
				"",
				"/** @prose A chunk. */",
				"/** @note",
				" * Old question.",
				" */",
				"const a = 1;",
				"",
			].join("\n"),
		);
		addNote(root, "main.js#top-chunk-0", "New question.");
		const written = readFileSync(join(root, "main.js"), "utf-8");
		expect(written).not.toContain("Old question.");
		const reparsed = parseFile(written, "js");
		expect(reparsed.sections[0].chunks[0].note).toBe("New question.");
		expect(written.match(/@note/g)).toHaveLength(1);
	});

	it("writes in HTML comment style for an .html chunk, no gutter", () => {
		makeFile(
			"index.html",
			["<!-- @prose File. -->", "<!-- @prose A chunk. -->", "<h1>hi</h1>", ""].join("\n"),
		);
		addNote(root, "index.html#top-chunk-0", "A question.");
		const written = readFileSync(join(root, "index.html"), "utf-8");
		expect(written).toContain("<!-- @note\nA question.\n-->\n<h1>hi</h1>");
	});

	it("throws when the chunk path does not resolve (stale client, or a file/folder-level path)", () => {
		makeFile("main.js", "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n");
		expect(() => addNote(root, "main.js#nope", "text")).toThrow();
		expect(() => addNote(root, "main.js", "text")).toThrow();
	});
});

describe("resolveNote", () => {
	it("removes an existing note entirely, leaving the surrounding code untouched", () => {
		makeFile(
			"main.js",
			[
				"/** @prose File. */",
				"",
				"/** @prose A chunk. */",
				"/** @note",
				" * A question.",
				" */",
				"const a = 1;",
				"",
			].join("\n"),
		);
		resolveNote(root, "main.js#top-chunk-0");
		const written = readFileSync(join(root, "main.js"), "utf-8");
		expect(written).toBe(
			["/** @prose File. */", "", "/** @prose A chunk. */", "const a = 1;", ""].join("\n"),
		);
	});

	it("throws when the chunk has no note to resolve", () => {
		makeFile("main.js", "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n");
		expect(() => resolveNote(root, "main.js#top-chunk-0")).toThrow();
	});
});
