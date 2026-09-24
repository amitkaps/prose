/** @prose
 * # Parsing `@prose` comments
 *
 * Turns one source file's text into file prose, a preamble, and its sections/chunks (spec
 * §3.2): scan the source for `@prose`-marked comments (language-specific — §3.1), then slice the
 * code between consecutive comments into chunks. No AST, no compiler — a source file is just
 * text with comment syntax, and that's all this needs to find.
 */
export interface ProseChunk {
	slug: string;
	heading: string | null;
	prose: string;
	code: string;
	pending: boolean;
	startLine: number;
	endLine: number;
}

export interface ProseSection {
	heading: string | null;
	slug: string;
	chunks: ProseChunk[];
}

export interface FileParse {
	fileProse: string | null;
	preamble: string;
	sections: ProseSection[];
}

interface RawBlock {
	body: string;
	startIndex: number;
	endIndex: number;
	startLine: number;
	/** For `.svelte` files: the end of this block's own part (script/style/markup), so its
	 *  trailing code never bleeds across a part boundary into the next `<script>`/`<style>` tag. */
	partEnd?: number;
}

const HEADING_RE = /^#{1,6}\s+(.*)$/;

function lineAt(source: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i++) {
		if (source[i] === "\n") line++;
	}
	return line;
}

/** @prose
 * `.replaceAll("\`", "")`, not a `` /`/g `` regex literal — this file's own `scanJsLike` doesn't
 * disambiguate a regex literal from the start of a template string, so a bare backtick inside a
 * regex here would make it treat everything after it, up to the next backtick anywhere in the
 * file, as one unterminated template literal — corrupting the depth count this parser's own
 * prose-block detection depends on for the rest of the file. Found by dogfooding: annotating
 * this file's later functions with `@prose` silently stopped working, with no error, until this
 * one line changed. A real tokenizer would disambiguate regex literals properly; this one
 * doesn't, so the workaround is avoiding the trap in this file's own source instead.
 */
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
 * A comment only counts as a prose block if its first line, trimmed, starts with `@prose` — any
 * other comment (unmarked JSDoc, `//`, a tool pragma) returns `null` here and is left as an
 * ordinary code comment (spec §3.1). `stripContinuation` is the JS/TS/CSS-vs-HTML difference:
 * JS-like comments carry a ` * ` gutter on every continuation line (which this strips); HTML
 * comments don't, so their lines are taken as-is.
 */
function extractBody(inner: string, stripContinuation: boolean): string | null {
	const lines = inner.split("\n");
	const trimmedFirst = lines[0].trim();
	if (!trimmedFirst.startsWith("@prose")) return null;
	let rest = trimmedFirst.slice("@prose".length);
	if (rest.startsWith(" ")) rest = rest.slice(1);
	const out: string[] = [];
	if (rest.length > 0) out.push(rest);
	for (let i = 1; i < lines.length; i++) {
		out.push(stripContinuation ? lines[i].replace(/^[ \t]*\*[ \t]?/, "") : lines[i]);
	}
	while (out.length && out[0].trim() === "") out.shift();
	while (out.length && out[out.length - 1].trim() === "") out.pop();
	return out.join("\n");
}

/** @prose
 * Disambiguates a regex literal (`/pattern/flags`) from division, using the last significant
 * character seen: a value (identifier char, `)`, `]`, a closed string/regex) means `/` divides;
 * anything else (an operator, an opening bracket, start of file) means `/` opens a regex. This
 * is the standard heuristic every JS tokenizer uses, minus keyword lookback (`return /x/` is
 * misread as division, since the last char of `return` is a letter) — good enough for scanning
 * real source for comments, not a full lexer. Returns the index just past the regex and its
 * flags, or `-1` if no closing `/` appears before a newline (regex literals can't span lines),
 * in which case the caller falls back to treating the `/` as an ordinary character.
 */
function skipRegexLiteral(source: string, start: number, lastSignificant: string): number {
	if (/[\w$)\]"'`]/.test(lastSignificant)) return -1;
	let i = start + 1;
	let inCharClass = false;
	while (i < source.length) {
		const c = source[i];
		if (c === "\n") return -1;
		if (c === "\\") {
			i += 2;
			continue;
		}
		if (c === "[") inCharClass = true;
		else if (c === "]") inCharClass = false;
		else if (c === "/" && !inCharClass) {
			i++;
			while (i < source.length && /[a-zA-Z]/.test(source[i])) i++;
			return i;
		}
		i++;
	}
	return -1;
}

/** @prose
 * # Scanning JS/TS/CSS
 *
 * A single left-to-right pass tracking string/template-literal state, regex literals, and `{}`
 * depth, so a `/** @prose *\/`-shaped comment only counts when it sits at depth 0 — top-level,
 * not inside a function, class, or rule body (spec §3.1). That's a deliberate limitation, not
 * an oversight: `defineDevframe({ ..., setup(ctx) { /** @prose *\/ ... } })` in this very
 * package's own `plugin.ts` used to put a prose block inside that nested `setup` closure, and it
 * was silently ignored — no error, the block just never became a chunk. The fix there was moving
 * the function to the top level so its own doc comment could sit at depth 0, not changing this
 * rule.
 *
 * Regex literals need their own handling, not just strings: this file's own `slugify()` used to
 * write `/\`/g` (a regex matching a backtick) directly, and without recognizing it as a regex,
 * the scanner read that bare backtick as the start of a template literal — one that only
 * "closed" at the next backtick anywhere later in the file, permanently corrupting the depth
 * count for everything after it. Found by dogfooding this file against itself.
 */
function scanJsLike(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	let i = 0;
	let depth = 0;
	let lastSignificant = "";
	const n = source.length;
	while (i < n) {
		const c = source[i];
		if (c === '"' || c === "'" || c === "`") {
			const quote = c;
			i++;
			while (i < n) {
				if (source[i] === "\\") {
					i += 2;
					continue;
				}
				if (source[i] === quote) {
					i++;
					break;
				}
				i++;
			}
			lastSignificant = quote;
			continue;
		}
		if (c === "/" && source[i + 1] === "/") {
			i += 2;
			while (i < n && source[i] !== "\n") i++;
			continue;
		}
		if (c === "/" && source[i + 1] === "*") {
			const start = i;
			const close = source.indexOf("*/", i + 2);
			const end = close === -1 ? n : close + 2;
			const text = source.slice(start, end);
			if (depth === 0 && text.startsWith("/**")) {
				const inner = text.slice(3, text.endsWith("*/") ? text.length - 2 : text.length);
				const body = extractBody(inner, true);
				if (body !== null) {
					blocks.push({ body, startIndex: start, endIndex: end, startLine: lineAt(source, start) });
				}
			}
			i = end;
			continue;
		}
		if (c === "/") {
			const regexEnd = skipRegexLiteral(source, i, lastSignificant);
			if (regexEnd !== -1) {
				i = regexEnd;
				lastSignificant = "/";
				continue;
			}
		}
		if (c === "{") {
			depth++;
			i++;
			lastSignificant = c;
			continue;
		}
		if (c === "}") {
			depth = Math.max(0, depth - 1);
			i++;
			lastSignificant = c;
			continue;
		}
		if (!/\s/.test(c)) lastSignificant = c;
		i++;
	}
	return blocks;
}

/** Scans HTML source for `<!-- @prose ... -->` comments. */
function scanHtml(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	const re = /<!--([\s\S]*?)-->/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(source))) {
		const body = extractBody(match[1], false);
		if (body !== null) {
			blocks.push({
				body,
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
		body: block.body,
		startIndex,
		endIndex: block.endIndex + offset,
		startLine: lineAt(fullSource, startIndex),
		partEnd,
	};
}

/** @prose
 * # Scanning `.svelte` files
 *
 * Each part follows its own language's rule (spec §3.3) — `<script>` and `<style>` bodies as
 * JS/TS/CSS, everything else as HTML — and the blocks are merged back in source order. Each
 * block also carries a `partEnd`: the end of its own part, so a chunk's trailing code is clipped
 * there instead of running past a `</script>`/`<style>` tag into the next part's code. Without
 * that clipping, a chunk's "code" field would literally include the closing tag and leading
 * whitespace of whatever came next — caught by a fixture test before it ever reached a real
 * `.svelte` file.
 */
function scanSvelte(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	const tagRe = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = tagRe.exec(source))) {
		const [full, , inner] = match;
		const tagStart = match.index;
		const markup = source.slice(last, tagStart);
		for (const block of scanHtml(markup)) blocks.push(shiftBlock(block, last, source, tagStart));
		const innerOffset = tagStart + full.indexOf(inner);
		const innerEnd = innerOffset + inner.length;
		for (const block of scanJsLike(inner))
			blocks.push(shiftBlock(block, innerOffset, source, innerEnd));
		last = tagStart + full.length;
	}
	for (const block of scanHtml(source.slice(last)))
		blocks.push(shiftBlock(block, last, source, source.length));
	blocks.sort((a, b) => a.startIndex - b.startIndex);
	return blocks;
}

/** @prose
 * # Building chunks from blocks
 *
 * The first block is file prose (L1); everything before the next block is the preamble. Every
 * later block starts a chunk, running to the next block (or EOF). A block whose first line is a
 * Markdown heading also opens a new section — the heading block itself stays a chunk too, so a
 * section with only a heading and no other prose isn't invisible. A chunk with no code before
 * the next block is `pending`: a plan item, not a bug (spec §3.2).
 */
export function parseFile(source: string, extension: string): FileParse {
	const blocks =
		extension === "html"
			? scanHtml(source)
			: extension === "svelte"
				? scanSvelte(source)
				: scanJsLike(source);

	if (blocks.length === 0) {
		return { fileProse: null, preamble: source.trim(), sections: [] };
	}

	const [fileBlock, ...rest] = blocks;
	const nextStart = rest.length > 0 ? rest[0].startIndex : source.length;
	const preambleEnd =
		fileBlock.partEnd !== undefined ? Math.min(nextStart, fileBlock.partEnd) : nextStart;
	const preamble = source.slice(fileBlock.endIndex, preambleEnd).trim();

	const sections: ProseSection[] = [];
	let currentSection: ProseSection = { heading: null, slug: "top", chunks: [] };
	let hasOpenedSection = false;

	for (let i = 0; i < rest.length; i++) {
		const block = rest[i];
		const nextBlockStart = i + 1 < rest.length ? rest[i + 1].startIndex : source.length;
		const codeEnd =
			block.partEnd !== undefined ? Math.min(nextBlockStart, block.partEnd) : nextBlockStart;
		const code = source.slice(block.endIndex, codeEnd).trim();
		const endLine = lineAt(source, codeEnd);

		const headingMatch = block.body.split("\n")[0]?.match(HEADING_RE);
		if (headingMatch) {
			if (hasOpenedSection || currentSection.chunks.length > 0) sections.push(currentSection);
			const heading = headingMatch[1].trim();
			currentSection = { heading, slug: slugify(heading), chunks: [] };
			hasOpenedSection = true;
		}

		const chunkSlug = headingMatch
			? currentSection.slug
			: `${currentSection.slug}-chunk-${currentSection.chunks.length}`;

		currentSection.chunks.push({
			slug: chunkSlug,
			heading: headingMatch ? currentSection.heading : null,
			prose: block.body,
			code,
			pending: code.length === 0,
			startLine: block.startLine,
			endLine,
		});
	}
	sections.push(currentSection);

	return { fileProse: fileBlock.body, preamble, sections };
}

/** Returns the first Markdown paragraph of `text`, skipping a leading heading line, for use as a summary. */
export function firstParagraph(text: string): string {
	const withoutTitle = text.replace(/^#{1,6}\s+.*(\n|$)/, "").trim();
	const paragraph = withoutTitle.split(/\n\s*\n/)[0] ?? "";
	return paragraph.trim();
}
