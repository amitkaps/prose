/** @prose
 * # Parsing `@prose` comments
 *
 * Turns one source file's text into its file prose, preamble and chunks (spec §3.2): find the
 * `@prose` comments (each language its own way, §3.1), then slice the code between consecutive
 * comments into chunks. Each chunk keeps its comment's byte span, so a renderer can lay the file
 * out in source order with the prose where the comment was.
 */
import { parseSync } from "oxc-parser";
import { declaredIdentifiers } from "./names.js";

export type CodeLang = "js" | "css" | "html" | "yaml" | "toml";

export interface ProseChunk {
	/** Content-derived address within the file (spec §3.2): `file`, the heading slug, the
	 *  first declared name, or `chunk-N`; unique per file. */
	anchor: string;
	heading: string | null;
	prose: string;
	code: string;
	pending: boolean;
	/** 1-based line the `@prose` comment starts on, for a link into the editor. */
	startLine: number;
	/** Byte span `[startIndex, endIndex)` of the `@prose` comment itself. */
	startIndex: number;
	endIndex: number;
	/** The language of the chunk's code. Not always the comment's: a `.svelte` file's `<style>`
	 *  uses `/** *\/` comments, but its code is CSS. */
	codeLang: CodeLang;
}

export interface ProseSection {
	heading: string | null;
	slug: string;
	chunks: ProseChunk[];
}

export interface FileParse {
	fileProse: string | null;
	/** The file prose as a block in its own right (anchor `file`), so it can be laid out in place
	 *  like any chunk. Its `code` is the preamble. Null for a file with no block. */
	fileBlock: ProseChunk | null;
	preamble: string;
	sections: ProseSection[];
}

interface RawBlock {
	codeLang: CodeLang;
	body: string;
	startIndex: number;
	endIndex: number;
	startLine: number;
	/** A `@prose` block below the top level: not a block, left as an ordinary comment (§3.1). */
	nested?: boolean;
	/** For `.svelte` files: the end of this block's own part (script, style or markup), so its
	 *  trailing code never bleeds across a part boundary into the next `<script>` or `<style>`. */
	partEnd?: number;
}

const MARKER = "@prose";
const HEADING_RE = /^#{1,6}\s+(.*)$/;

function lineAt(source: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i++) {
		if (source[i] === "\n") line++;
	}
	return line;
}

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.replaceAll("`", "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "section"
	);
}

/** @prose
 * # Recognizing a prose block
 *
 * A comment counts only if its first line, trimmed, starts with `@prose`; any other comment
 * (unmarked JSDoc, `//`, a tool pragma) returns `null` and stays an ordinary code comment
 * (spec §3.1). Each style strips its own gutter before this runs: JS's ` * `, YAML's `# `, and
 * none for HTML. Blank lines at either edge of the body are dropped, and a CRLF file's `\r`
 * stays out of it.
 */
function extractMarkedFromLines(rawLines: string[]): string | null {
	const lines = rawLines.map((line) => line.replace(/\r$/, ""));
	const trimmedFirst = lines[0]!.trim();
	if (!trimmedFirst.startsWith(MARKER)) return null;
	let rest = trimmedFirst.slice(MARKER.length);
	if (rest.startsWith(" ")) rest = rest.slice(1);
	const out: string[] = [];
	if (rest.length > 0) out.push(rest);
	for (let i = 1; i < lines.length; i++) out.push(lines[i]!);
	while (out.length && out[0]!.trim() === "") out.shift();
	while (out.length && out.at(-1)!.trim() === "") out.pop();
	return out.join("\n");
}

function extractMarkedBlock(inner: string, stripContinuation: boolean): string | null {
	const lines = inner.split("\n");
	const stripped = lines.map((line, i) =>
		i === 0 || !stripContinuation ? line : line.replace(/^[ \t]*\*[ \t]?/, ""),
	);
	return extractMarkedFromLines(stripped);
}

/** @prose
 * # Scanning JS and TS
 *
 * The comments come from `oxc-parser`, so a regex literal, a template string or a
 * comment-shaped string can't be misread as a comment. A `/**` comment that starts with the
 * marker counts only at the top level, outside every top-level statement; one inside a function,
 * class or object is `nested`, and stays part of the code around it (spec §3.1). A file oxc can't
 * parse at all yields no blocks.
 */
function scanJs(source: string, lang: "js" | "ts"): RawBlock[] {
	let parsed: ReturnType<typeof parseSync>;
	try {
		parsed = parseSync(`file.${lang}`, source);
	} catch {
		return [];
	}
	const statements = parsed.program.body.map((node): [number, number] => [node.start, node.end]);
	const blocks: RawBlock[] = [];
	for (const comment of parsed.comments) {
		if (comment.type !== "Block" || !comment.value.startsWith("*")) continue;
		const text = source.slice(comment.start, comment.end);
		const body = extractMarkedBlock(text.slice(3, -2), true);
		if (body === null) continue;
		blocks.push({
			body,
			codeLang: "js",
			startIndex: comment.start,
			endIndex: comment.end,
			startLine: lineAt(source, comment.start),
			nested: statements.some(([start, end]) => comment.start >= start && comment.end <= end),
		});
	}
	return blocks;
}

/** @prose
 * # Scanning CSS
 *
 * CSS has no parser here, only a pass that skips strings and comments and counts `{}`, so a
 * `/** @prose *\/` counts at depth 0 and is `nested` inside a rule (spec §3.1).
 */
function scanCss(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	let i = 0;
	let depth = 0;
	const n = source.length;
	while (i < n) {
		const c = source[i];
		if (c === '"' || c === "'") {
			i++;
			while (i < n && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
			i++;
		} else if (c === "/" && source[i + 1] === "*") {
			const close = source.indexOf("*/", i + 2);
			const end = close === -1 ? n : close + 2;
			const text = source.slice(i, end);
			const body = text.startsWith("/**")
				? extractMarkedBlock(text.slice(3, text.endsWith("*/") ? -2 : undefined), true)
				: null;
			if (body !== null) {
				blocks.push({
					body,
					codeLang: "css",
					startIndex: i,
					endIndex: end,
					startLine: lineAt(source, i),
					nested: depth > 0,
				});
			}
			i = end;
		} else {
			if (c === "{") depth++;
			else if (c === "}") depth = Math.max(0, depth - 1);
			i++;
		}
	}
	return blocks;
}

/** @prose
 * # Scanning YAML and TOML
 *
 * Both use `#` line comments with no closing delimiter, so the marker defines the boundary: a
 * block starts at a column-0 `# @prose` line and runs through the following `#` lines, up to the
 * next marker line or the first line that isn't a comment. Two blocks can then sit back to back
 * without the second's lines joining the first's body. An indented `#` comment, inside a nested
 * mapping or table, is an ordinary comment, as braces make one in CSS (spec §3.1).
 */
function scanHashComments(source: string, codeLang: "yaml" | "toml"): RawBlock[] {
	const blocks: RawBlock[] = [];
	const lines = source.split("\n");
	const lineOffsets: number[] = [];
	let offset = 0;
	for (const line of lines) {
		lineOffsets.push(offset);
		offset += line.length + 1;
	}
	const stripHash = (line: string): string => line.replace(/^#[ \t]?/, "");
	const isMarkerLine = (stripped: string): boolean => stripped.trim().startsWith(MARKER);

	let i = 0;
	while (i < lines.length) {
		if (!lines[i]!.startsWith("#") || !isMarkerLine(stripHash(lines[i]!))) {
			i++;
			continue;
		}
		const startLine = i;
		const commentLines = [stripHash(lines[i]!)];
		i++;
		while (i < lines.length && lines[i]!.startsWith("#")) {
			const next = stripHash(lines[i]!);
			if (isMarkerLine(next)) break;
			commentLines.push(next);
			i++;
		}
		const body = extractMarkedFromLines(commentLines);
		if (body !== null) {
			// The block ends right after its last line's content, before the line ending, as a
			// `*/` or `-->` does in the other styles.
			const lastLine = i - 1;
			blocks.push({
				body,
				codeLang,
				startIndex: lineOffsets[startLine]!,
				endIndex: lineOffsets[lastLine]! + lines[lastLine]!.replace(/\r$/, "").length,
				startLine: startLine + 1,
			});
		}
	}
	return blocks;
}

/** Scans HTML source for `<!-- @prose … -->` comments. */
function scanHtml(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	const re = /<!--([\s\S]*?)-->/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(source))) {
		const body = extractMarkedBlock(match[1]!, false);
		if (body !== null) {
			blocks.push({
				body,
				codeLang: "html",
				startIndex: match.index,
				endIndex: match.index + match[0].length,
				startLine: lineAt(source, match.index),
			});
		}
	}
	return blocks;
}

/** Shifts a block found in an extracted sub-range back into the full source's coordinates. */
function shiftBlock(
	block: RawBlock,
	offset: number,
	fullSource: string,
	partEnd: number,
): RawBlock {
	const startIndex = block.startIndex + offset;
	return {
		...block,
		startIndex,
		endIndex: block.endIndex + offset,
		startLine: lineAt(fullSource, startIndex),
		partEnd,
	};
}

/** @prose
 * # Scanning `.svelte` files
 *
 * Each part follows its own language's rule (spec §3.1): `<script>` and `<style>` bodies as
 * TS and CSS, everything else as HTML, merged back in source order. Each block carries its part's
 * end, so a chunk's code is clipped there instead of running past `</script>` into the next part.
 */
function scanSvelte(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	for (const part of svelteParts(source)) {
		const text = source.slice(part.start, part.end);
		const found =
			part.kind === "markup"
				? scanHtml(text)
				: part.kind === "style"
					? scanCss(text)
					: scanJs(text, "ts");
		for (const block of found) blocks.push(shiftBlock(block, part.start, source, part.end));
	}
	blocks.sort((a, b) => a.startIndex - b.startIndex);
	return blocks;
}

/** A `.svelte` file's parts in order: each `<script>` and `<style>` body, and the markup between
 *  them (tags included in the markup, which is scanned as HTML). */
function svelteParts(
	source: string,
): { kind: "script" | "style" | "markup"; start: number; end: number }[] {
	const parts: { kind: "script" | "style" | "markup"; start: number; end: number }[] = [];
	const tagRe = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = tagRe.exec(source))) {
		const [full, tagName, inner] = match as unknown as [string, string, string];
		const inside = match.index + full.indexOf(inner);
		parts.push({ kind: "markup", start: last, end: match.index });
		parts.push({ kind: tagName as "script" | "style", start: inside, end: inside + inner.length });
		last = match.index + full.length;
	}
	parts.push({ kind: "markup", start: last, end: source.length });
	return parts;
}

/** @prose
 * # Building chunks from blocks
 *
 * The first block is the file prose; the code before the next block is the preamble. Every
 * later block starts a chunk that runs to the next block, or to the end of the file. A block
 * whose first line is a Markdown heading also opens a new section, and stays a chunk itself, so
 * a heading with no other prose isn't lost. A chunk with no code is `pending`: a plan item
 * (spec §3.2).
 */
export function parseFile(source: string, extension: string): FileParse {
	const found =
		extension === "html"
			? scanHtml(source)
			: extension === "svelte"
				? scanSvelte(source)
				: extension === "yaml" || extension === "yml"
					? scanHashComments(source, "yaml")
					: extension === "toml"
						? scanHashComments(source, "toml")
						: extension === "css"
							? scanCss(source)
							: scanJs(source, extension === "ts" ? "ts" : "js");
	const blocks = found.filter((b) => !b.nested);

	if (blocks.length === 0) {
		return { fileProse: null, fileBlock: null, preamble: source.trim(), sections: [] };
	}

	const fileBlock = blocks[0]!;
	const rest = blocks.slice(1);
	const nextStart = rest[0]?.startIndex ?? source.length;
	const preambleEnd =
		fileBlock.partEnd !== undefined ? Math.min(nextStart, fileBlock.partEnd) : nextStart;
	const preamble = source.slice(fileBlock.endIndex, preambleEnd).trim();

	const sections: ProseSection[] = [];
	let currentSection: ProseSection = { heading: null, slug: "top", chunks: [] };
	let hasOpenedSection = false;

	for (let i = 0; i < rest.length; i++) {
		const block = rest[i]!;
		const nextBlockStart = i + 1 < rest.length ? rest[i + 1]!.startIndex : source.length;
		const codeEnd =
			block.partEnd !== undefined ? Math.min(nextBlockStart, block.partEnd) : nextBlockStart;
		const code = source.slice(block.endIndex, codeEnd).trim();

		const headingMatch = block.body.split("\n")[0]?.match(HEADING_RE);
		if (headingMatch) {
			if (hasOpenedSection || currentSection.chunks.length > 0) sections.push(currentSection);
			const heading = headingMatch[1]!.trim();
			currentSection = { heading, slug: slugify(heading), chunks: [] };
			hasOpenedSection = true;
		}

		currentSection.chunks.push({
			anchor: "",
			heading: headingMatch ? currentSection.heading : null,
			prose: block.body,
			code,
			pending: code.length === 0,
			startLine: block.startLine,
			startIndex: block.startIndex,
			endIndex: block.endIndex,
			codeLang: block.codeLang,
		});
	}
	sections.push(currentSection);

	assignAnchors(sections);

	return {
		fileProse: fileBlock.body,
		fileBlock: {
			anchor: FILE_ANCHOR,
			heading: null,
			prose: fileBlock.body,
			code: preamble,
			pending: false,
			startLine: fileBlock.startLine,
			startIndex: fileBlock.startIndex,
			endIndex: fileBlock.endIndex,
			codeLang: fileBlock.codeLang,
		},
		preamble,
		sections,
	};
}

/** The anchor of a file's own prose block: `src/store.ts#file`. Reserved: a chunk whose name
 *  would be `file` becomes `file-2`. */
export const FILE_ANCHOR = "file";

/** @prose
 * # Content-derived anchors (spec §3.2)
 *
 * In order: the slug of the chunk's heading, then the first name its code declares (JS and TS
 * only), then `chunk-N` by position, the only kind that moves when a block is inserted above. The
 * heading comes first because it's what the reader sees: a `## Table rows` block is `#table-rows`,
 * not whichever helper its code happens to declare first.
 * A repeat within the file takes `-2`, `-3` in source order, and `file` is taken from the start.
 * Names keep their case, so `#addTodo` reads as the code does.
 */
function assignAnchors(sections: ProseSection[]): void {
	const used = new Set([FILE_ANCHOR]);
	const seen = new Map<string, number>();
	let position = 0;
	for (const section of sections) {
		for (const chunk of section.chunks) {
			position++;
			const base = chunk.heading
				? slugify(chunk.heading)
				: ([...declaredIdentifiers(chunk.code, chunk.codeLang)][0] ?? `chunk-${position}`);
			let n = seen.get(base) ?? 1;
			let anchor = n === 1 && !used.has(base) ? base : `${base}-${++n}`;
			while (used.has(anchor)) anchor = `${base}-${++n}`;
			seen.set(base, n);
			used.add(anchor);
			chunk.anchor = anchor;
		}
	}
}

/** Returns the first Markdown paragraph of `text`, skipping a leading heading line, for use as a summary. */
export function firstParagraph(text: string): string {
	const withoutTitle = text.replace(/^#{1,6}\s+.*(\n|$)/, "").trim();
	const paragraph = withoutTitle.split(/\n\s*\n/)[0] ?? "";
	return paragraph.trim();
}
