import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { lineHash } from "./hash.js";
import { landing, NoAnchorError } from "./insertion.js";
import { blockHash, chunkAnchor, parseFile, type ProseChunk } from "./parser.js";
import {
	addNote,
	escapeNote,
	NoteWriteError,
	noteTarget,
	resolveNote,
	withLineNote,
	withNote,
	withoutLineNote,
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

/** @prose
 * # Line notes (spec §6.2)
 *
 * Examples first, through the RPC-level `addNote`/`resolveNote` with `file:line` paths, then the
 * property test: for every line of a set of fixtures where a note may go, in every language and
 * with LF, CRLF and no final newline, any note text parses back as exactly one line note with the
 * escaped text, adds no block, leaves the code as it was, and resolving it restores the bytes.
 */
const lineHashAt = (source: string, line: number) => lineHash(source.split("\n")[line - 1]);

describe("line notes: the write path", () => {
	const source = [
		"/** @prose File. */",
		"",
		"export function add(a: number) {",
		"  const t = `",
		"    text",
		"  `;",
		"  return a;",
		"}",
		"",
	].join("\n");

	it("writes above the enclosing statement, at its indent, and resolves back to the same bytes", () => {
		makeFile("main.ts", source);
		addNote(root, "main.ts:5", "Why a template?", lineHashAt(source, 5));
		const written = readFileSync(join(root, "main.ts"), "utf-8");
		expect(written).toBe(
			[
				"/** @prose File. */",
				"",
				"export function add(a: number) {",
				"  /** @note",
				"   * Why a template?",
				"   */",
				"  const t = `",
				"    text",
				"  `;",
				"  return a;",
				"}",
				"",
			].join("\n"),
		);
		const noteNode = findNode(buildTree(root), "main.ts");
		expect(noteNode?.lineNotes).toEqual([
			{
				path: "main.ts:4",
				text: "Why a template?",
				hash: expect.any(String),
				span: expect.any(Array),
			},
		]);
		resolveNote(root, "main.ts:4", noteNode!.lineNotes![0].hash);
		expect(readFileSync(join(root, "main.ts"), "utf-8")).toBe(source);
	});

	it("replaces a note already at the spot instead of stacking one", () => {
		makeFile("main.ts", source);
		addNote(root, "main.ts:7", "First.", lineHashAt(source, 7));
		const once = readFileSync(join(root, "main.ts"), "utf-8");
		addNote(root, "main.ts:10", "Second.", lineHashAt(once, 10));
		const notes = parseFile(readFileSync(join(root, "main.ts"), "utf-8"), "ts").lineNotes;
		expect(notes.map((n) => n.text)).toEqual(["Second."]);
	});

	it("refuses when the line changed since the view loaded it", () => {
		makeFile("main.ts", source);
		expect(() => addNote(root, "main.ts:7", "x", lineHash("  return b;"))).toThrow(/changed since/);
	});

	it("refuses a blank or comment line, and a stale note on resolve", () => {
		makeFile("main.ts", source);
		expect(() => addNote(root, "main.ts:2", "x", lineHashAt(source, 2))).toThrow(NoteWriteError);
		addNote(root, "main.ts:7", "x", lineHashAt(source, 7));
		expect(() => resolveNote(root, "main.ts:6", "deadbeef")).toThrow(/changed since|gone/);
	});

	it("writes to the block when the spot is right under its prose, so the note is read back as its note", () => {
		const s = "/** @prose File. */\n\n/** @prose A chunk. */\nconst a = 1;\n";
		makeFile("main.ts", s);
		expect(noteTarget(root, "main.ts:4", lineHashAt(s, 4))).toEqual({
			line: 4,
			text: "const a = 1;",
			block: true,
		});
		addNote(root, "main.ts:4", "About a.", lineHashAt(s, 4));
		const parsed = parseFile(readFileSync(join(root, "main.ts"), "utf-8"), "ts");
		expect(parsed.sections[0].chunks[0].note).toBe("About a.");
		expect(parsed.lineNotes).toEqual([]);
	});

	it("resolves a trailing note without touching the code on its line", () => {
		const s = "/** @prose File. */\nconst a = 1; /** @note trailing */\nconst b = 2;\n";
		const note = parseFile(s, "ts").lineNotes[0];
		expect(withoutLineNote(s, "ts", note.startLine, note.hash)).toBe(
			"/** @prose File. */\nconst a = 1; \nconst b = 2;\n",
		);
	});

	it("reads a note in a function body, a rule, a YAML mapping and a Svelte script", () => {
		const cases: [string, string][] = [
			["ts", "/** @prose F. */\nfunction f() {\n  /** @note in body */\n  g();\n}\n"],
			["css", "/** @prose F. */\n.a {\n  /** @note in rule */\n  color: red;\n}\n"],
			["yaml", "# @prose\n# F.\na:\n  # @note\n  # in map\n  b: 1\n"],
			[
				"svelte",
				"<script>\n  /** @prose F. */\n  function f() {\n    /** @note in script */\n    g();\n  }\n</script>\n",
			],
		];
		for (const [ext, src] of cases) {
			const notes = parseFile(src, ext).lineNotes;
			expect(notes).toHaveLength(1);
			expect(notes[0].text).toMatch(/^in /);
		}
	});
});

const LINE_FIXTURES: Record<string, string> = {
	ts: [
		"/** @prose File. */",
		"import x from 'y';",
		"",
		"/** @prose A function. */",
		"export function f(a: number) {",
		"  const t = `line one",
		"line two`;",
		"  /** @note Old. */",
		"  return call(a,",
		"    x);",
		"}",
		"",
		"/** @prose Another. */",
		"export const g = { a: 1,",
		"  b: 2 };",
		"",
	].join("\n"),
	css: "/** @prose File. */\n\n/** @prose A rule. */\n.a {\n  color: red;\n  margin:\n    0 auto;\n}\n",
	html: '<!-- @prose File. -->\n<main>\n\t<div\n\t\tclass="a">\n\t\ttext\n\t</div>\n\t<pre>\none\ntwo\n\t</pre>\n</main>\n',
	svelte:
		'<script>\n\t/** @prose File. */\n\tlet a = `x\ny`;\n</script>\n\n<!-- @prose Markup. -->\n<h1\n\tid="z">{a}</h1>\n\n<style>\n\t.a {\n\t\tcolor: red;\n\t}\n</style>\n',
	yaml: "# @prose\n# File.\n\nname: x\nscript: |\n  echo one\n  echo two\nitems:\n  - a\n  - b\n",
	toml: '# @prose\n# File.\n\na = 1\nb = """\ntext\n"""\nc = [\n  1,\n  2,\n]\n',
};

describe("property: line notes (spec §6.2)", () => {
	for (const [ext, fixture] of Object.entries(LINE_FIXTURES)) {
		it(`round-trips any note text above any legal line of a .${ext} file`, () => {
			const variants = [fixture, crlf(fixture), noFinalNewline(fixture)];
			const legal = (source: string) =>
				source
					.split("\n")
					.map((_, i) => i + 1)
					.filter((line) => {
						try {
							landing(source, ext, line);
							return true;
						} catch (err) {
							if (err instanceof NoAnchorError) return false;
							throw err;
						}
					});
			fc.assert(
				fc.property(fc.constantFrom(...variants), fc.nat(), noteText, (original, pick, text) => {
					const lines = legal(original);
					const line = lines[pick % lines.length];
					const hash = lineHashAt(original, line);
					const style = landing(original, ext, line).style;
					fc.pre(escapeNote(text, style).trim() !== "");

					const before = parseFile(original, ext);
					const written = withLineNote(original, ext, line, text, hash);
					const after = parseFile(written, ext);
					const proseOf = (p: typeof before) => [
						p.fileProse,
						...p.sections.flatMap((s) => s.chunks.map((c) => c.prose)),
					];
					expect(proseOf(after)).toEqual(proseOf(before));
					if (ext === "ts") expect(topLevel(written)).toEqual(topLevel(original));

					const blockNotes = (p: typeof before) =>
						[p.fileBlock, ...p.sections.flatMap((s) => s.chunks)].filter(
							(b) => b?.note !== undefined,
						);
					if (after.lineNotes.length === before.lineNotes.length + 1) {
						const note = after.lineNotes.find(
							(n) => !before.lineNotes.some((o) => o.text === n.text && o.hash === n.hash),
						)!;
						expect(note.text).toBe(escapeNote(text, style));
						expect(withoutLineNote(written, ext, note.startLine, note.hash)).toBe(original);
					} else {
						// The spot already had a note (replaced), or belongs to a block (a block note).
						expect(
							after.lineNotes.length === before.lineNotes.length ||
								blockNotes(after).length >= blockNotes(before).length,
						).toBe(true);
					}
				}),
				{ numRuns: 500 },
			);
		});
	}
});
