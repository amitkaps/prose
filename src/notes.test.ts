import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { blockHash, chunkAnchor, parseFile, type ProseChunk } from "./parser.js";
import {
	addNote,
	escapeNote,
	NoteWriteError,
	resolveNote,
	withNote,
	withoutNote,
} from "./notes.js";
import { buildTree, findNode } from "./tree.js";

let root: string;

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

function makeFile(relPath: string, content: string): string {
	root = mkdtempSync(join(tmpdir(), "prose-notes-test-"));
	writeFileSync(join(root, relPath), content, "utf-8");
	return root;
}

/** The block's hash as the client would hold it: from the tree, like the view. */
function hashAt(path: string): string {
	return findNode(buildTree(root), path)?.hash ?? "";
}

function add(path: string, text: string): void {
	addNote(root, path, text, hashAt(path));
}

function resolve(path: string): void {
	resolveNote(root, path, hashAt(path));
}

describe("notes on the file prose", () => {
	it("adds, replaces and resolves a note on the file's own @prose block", () => {
		makeFile("main.js", ["/** @prose File. */", "const a = 1;", ""].join("\n"));
		add("main.js#file", "Too big?");
		expect(readFileSync(join(root, "main.js"), "utf-8")).toBe(
			["/** @prose File. */", "/** @note", " * Too big?", " */", "const a = 1;", ""].join("\n"),
		);
		add("main.js#file", "Split it.");
		expect(parseFile(readFileSync(join(root, "main.js"), "utf-8"), "js").fileBlock?.note).toBe(
			"Split it.",
		);
		resolve("main.js#file");
		expect(readFileSync(join(root, "main.js"), "utf-8")).toBe(
			["/** @prose File. */", "const a = 1;", ""].join("\n"),
		);
	});

	it("refuses a file with no @prose block", () => {
		makeFile("main.js", "const a = 1;\n");
		expect(() => add("main.js#file", "x")).toThrow();
	});
});

describe("addNote", () => {
	it("inserts a brand-new note directly after the chunk's @prose block, in JS comment style", () => {
		makeFile(
			"main.js",
			["/** @prose File. */", "", "/** @prose A chunk. */", "const a = 1;", ""].join("\n"),
		);
		add("main.js#a", "Should this reject duplicates?");
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
		add("main.js#a", "A question.");
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
		add("index.html#chunk-1", "A question.");
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
		add("main.js#a", "New question.");
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
		add("index.html#chunk-1", "A question.");
		const written = readFileSync(join(root, "index.html"), "utf-8");
		expect(written).toContain("<!-- @note\nA question.\n-->\n<h1>hi</h1>");
	});

	it("writes in hash comment style for a .toml chunk, no closing delimiter", () => {
		makeFile(
			"config.toml",
			["# @prose", "# File.", "", "# @prose", "# A chunk.", "port = 8080", ""].join("\n"),
		);
		add("config.toml#chunk-1", "Double-check this port.");
		const written = readFileSync(join(root, "config.toml"), "utf-8");
		expect(written).toContain(
			"# @prose\n# A chunk.\n# @note\n# Double-check this port.\nport = 8080",
		);
		const reparsed = parseFile(written, "toml");
		expect(reparsed.sections[0].chunks[0].note).toBe("Double-check this port.");
	});

	it("throws when the chunk path does not resolve (stale client, or a file/folder-level path)", () => {
		makeFile("main.js", "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n");
		expect(() => add("main.js#nope", "text")).toThrow();
		expect(() => add("main.js", "text")).toThrow();
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
		resolve("main.js#a");
		const written = readFileSync(join(root, "main.js"), "utf-8");
		expect(written).toBe(
			["/** @prose File. */", "", "/** @prose A chunk. */", "const a = 1;", ""].join("\n"),
		);
	});

	it("removes a hash-style note entirely, leaving the surrounding code untouched", () => {
		makeFile(
			"config.toml",
			[
				"# @prose",
				"# File.",
				"",
				"# @prose",
				"# A chunk.",
				"# @note",
				"# A question.",
				"port = 8080",
				"",
			].join("\n"),
		);
		resolve("config.toml#chunk-1");
		const written = readFileSync(join(root, "config.toml"), "utf-8");
		expect(written).toBe(
			["# @prose", "# File.", "", "# @prose", "# A chunk.", "port = 8080", ""].join("\n"),
		);
	});

	it("throws when the chunk has no note to resolve", () => {
		makeFile("main.js", "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n");
		expect(() => resolve("main.js#chunk-1")).toThrow();
	});
});

describe("safe writes: which file (spec §6, Trust boundary)", () => {
	it("refuses a path outside the root, absolute or relative, and leaves that file alone", () => {
		const outer = mkdtempSync(join(tmpdir(), "prose-notes-outer-"));
		try {
			writeFileSync(join(outer, "victim.js"), "/** @prose File. */\nconst a = 1;\n");
			root = join(outer, "project");
			mkdirSync(root);
			const hash = blockHash({ prose: "File.", note: undefined });
			for (const path of ["../victim.js#file", `${join(outer, "victim.js")}#file`]) {
				expect(() => addNote(root, path, "x", hash)).toThrow(NoteWriteError);
			}
			expect(readFileSync(join(outer, "victim.js"), "utf-8")).toBe(
				"/** @prose File. */\nconst a = 1;\n",
			);
		} finally {
			rmSync(outer, { recursive: true, force: true });
		}
	});

	it("refuses a symlink that leads outside the root", () => {
		const outer = mkdtempSync(join(tmpdir(), "prose-notes-outer-"));
		try {
			writeFileSync(join(outer, "victim.js"), "/** @prose File. */\nconst a = 1;\n");
			makeFile("main.js", "const a = 1;\n");
			symlinkSync(join(outer, "victim.js"), join(root, "link.js"));
			const hash = blockHash({ prose: "File.", note: undefined });
			expect(() => addNote(root, "link.js#file", "x", hash)).toThrow(NoteWriteError);
		} finally {
			rmSync(outer, { recursive: true, force: true });
		}
	});

	it("refuses a file the tree doesn't show (a skipped or dot folder)", () => {
		makeFile("main.js", "const a = 1;\n");
		const source = "/** @prose File. */\nconst a = 1;\n";
		const hash = blockHash({ prose: "File.", note: undefined });
		for (const dir of ["node_modules", ".hidden"]) {
			mkdirSync(join(root, dir));
			writeFileSync(join(root, dir, "x.js"), source);
			expect(() => addNote(root, `${dir}/x.js#file`, "x", hash)).toThrow(NoteWriteError);
			expect(readFileSync(join(root, dir, "x.js"), "utf-8")).toBe(source);
		}
	});
});

describe("safe writes: the block hash (spec §6.3)", () => {
	it("refuses a write when the block's prose changed since the client saw it", () => {
		makeFile("main.js", "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n");
		const stale = hashAt("main.js#chunk-1");
		const edited = "/** @prose File. */\n\n/** @prose A chunk, edited. */\nconst a = 1;\n";
		writeFileSync(join(root, "main.js"), edited);
		expect(() => addNote(root, "main.js#chunk-1", "x", stale)).toThrow(/changed since/);
		expect(readFileSync(join(root, "main.js"), "utf-8")).toBe(edited);
	});

	it("refuses a write when a block inserted above moved the anchor onto another block", () => {
		makeFile("main.js", "/** @prose File. */\n\n/** @prose Mine. */\nconst a = 1;\n");
		const mine = hashAt("main.js#chunk-1");
		const shifted =
			"/** @prose File. */\n\n/** @prose New. */\nconst n = 0;\n\n/** @prose Mine. */\nconst a = 1;\n";
		writeFileSync(join(root, "main.js"), shifted);
		expect(() => addNote(root, "main.js#chunk-1", "x", mine)).toThrow(NoteWriteError);
		expect(readFileSync(join(root, "main.js"), "utf-8")).toBe(shifted);
	});

	it("refuses a resolve when the note was rewritten since the client saw it", () => {
		makeFile("main.js", "/** @prose File. */\n/** @note\n * Old.\n */\nconst a = 1;\n");
		const stale = hashAt("main.js#file");
		add("main.js#file", "New.");
		expect(() => resolveNote(root, "main.js#file", stale)).toThrow(NoteWriteError);
		expect(parseFile(readFileSync(join(root, "main.js"), "utf-8"), "js").fileBlock?.note).toBe(
			"New.",
		);
	});

	it("refuses an empty note", () => {
		makeFile("main.js", "/** @prose File. */\nconst a = 1;\n");
		expect(() => add("main.js#file", " \n\t\n")).toThrow(NoteWriteError);
	});
});

describe("escapeNote (spec §6.2)", () => {
	it("keeps a note from closing its comment or ending the element around it", () => {
		expect(escapeNote("a */ b </script>", "js")).toBe("a *\\/ b <\\/script>");
		expect(escapeNote("a --> b --!> c", "html")).toBe("a --&gt; b --!&gt; c");
		expect(escapeNote("x\n  @prose y\n@note z", "hash")).toBe("x\n  \\@prose y\n\\@note z");
	});

	it("is idempotent, so saving a note the view shows again changes nothing", () => {
		for (const style of ["js", "html", "hash"] as const) {
			const once = escapeNote("*/ --> </x @prose", style);
			expect(escapeNote(once, style)).toBe(once);
		}
	});
});

/** @prose
 * # Property tests on the write path (spec §6.2)
 *
 * Every example above uses friendly text, which is how the injection bug in `formatNote` went
 * unnoticed. These generate note text from fragments that have broken comment syntax before
 * (`*\/`, `-->`, `@prose`, `</script>`, CR/LF, tabs) mixed with arbitrary unicode, and check, for
 * every comment style and every block of a fixture file (LF and CRLF, with and without a newline
 * at the end, with and without an existing note):
 *
 * - the file parses back to the same blocks, prose and code, with only the target's note changed,
 *   to exactly the escaped text, so no block was started or ended by the note;
 * - adding a second note gives the same file as adding only the second one;
 * - resolving right after adding gives back the original bytes;
 * - JS/TS still parses in `oxc-parser` to the same top-level statements, and a `/** *\/` note
 *   adds no `</script` that could end the element around it.
 *
 * They run on `withNote`/`withoutNote`, the pure edits, so they need no files; the path guard
 * around them has its own tests above.
 */
const FRAGMENTS = [
	"*/",
	"/*",
	"/**",
	"-->",
	"--!>",
	"<!--",
	"@prose",
	"@note",
	"# @prose",
	" * @note",
	"</script>",
	"</style>",
	"\n",
	"\r\n",
	"\r",
	"\t",
	" ",
	"*",
	"#",
	"-",
	"\\",
];
const noteText = fc
	.array(fc.oneof(fc.constantFrom(...FRAGMENTS), fc.string({ unit: "grapheme", maxLength: 6 })), {
		maxLength: 12,
	})
	.map((parts) => parts.join(""));

const crlf = (source: string) => source.replaceAll("\n", "\r\n");
const noFinalNewline = (source: string) => source.replace(/\n$/, "");

const FIXTURES: Record<string, string> = {
	ts: "/** @prose File. */\nimport x from 'y';\n\n/** @prose A chunk. */\nexport const a = x;\n\n/** @prose Another. */\n/** @note\n * Existing.\n */\nexport function b() {}\n\n/** @prose A pending chunk, last in the file. */\n",
	css: "/** @prose File. */\n\n/** @prose A rule. */\n.a { color: red; }\n",
	html: "<!-- @prose File. -->\n<main>\n\t<!-- @prose A chunk. -->\n\t<h1>hi</h1>\n</main>\n",
	svelte:
		"<script>\n\t/** @prose File. */\n\tlet a = 1;\n</script>\n\n<!-- @prose Markup. -->\n<h1>{a}</h1>\n",
	toml: "# @prose\n# File.\n\n# @prose\n# A chunk.\nport = 8080\n\n# @prose\n# Another.\n# @note\n# Existing.\nhost = 'x'\n",
};

function blocksOf(source: string, ext: string): { anchor: string; chunk: ProseChunk }[] {
	const parsed = parseFile(source, ext);
	return [
		...(parsed.fileBlock ? [{ anchor: "file", chunk: parsed.fileBlock }] : []),
		...parsed.sections.flatMap((section) =>
			section.chunks.map((chunk) => ({ anchor: chunkAnchor(chunk), chunk })),
		),
	];
}

function topLevel(source: string): string[] {
	const { program, errors } = parseSync("main.ts", source);
	expect(errors).toEqual([]);
	return program.body.map((node) => node.type);
}

describe("property: note writes (spec §6.2)", () => {
	for (const [ext, fixture] of Object.entries(FIXTURES)) {
		it(`round-trips any note text in a .${ext} file`, () => {
			const variants = [fixture, crlf(fixture), noFinalNewline(fixture)];
			fc.assert(
				fc.property(
					fc.constantFrom(...variants),
					fc.nat(),
					noteText,
					noteText,
					(original, pick, first, second) => {
						const before = blocksOf(original, ext);
						const { anchor, chunk } = before[pick % before.length];
						const index = before.findIndex((b) => b.anchor === anchor);
						const style = chunk.commentStyle;
						const hash = blockHash(chunk);
						fc.pre(escapeNote(first, style).trim() !== "");
						fc.pre(escapeNote(second, style).trim() !== "");

						const written = withNote(original, ext, anchor, first, hash);
						const after = blocksOf(written, ext);
						expect(after.map((b) => [b.anchor, b.chunk.prose, b.chunk.code])).toEqual(
							before.map((b) => [b.anchor, b.chunk.prose, b.chunk.code]),
						);
						expect(after.map((b) => b.chunk.note)).toEqual(
							before.map((b, i) => (i === index ? escapeNote(first, style) : b.chunk.note)),
						);
						if (ext === "ts") expect(topLevel(written)).toEqual(topLevel(original));
						if (style === "js") {
							expect(written.split("</script").length).toBe(original.split("</script").length);
						}

						const twice = withNote(written, ext, anchor, second, blockHash(after[index].chunk));
						expect(twice).toBe(withNote(original, ext, anchor, second, hash));

						if (chunk.note === undefined) {
							expect(withoutNote(written, ext, anchor, blockHash(after[index].chunk))).toBe(
								original,
							);
						}
					},
				),
				{ numRuns: 500 },
			);
		});
	}
});
