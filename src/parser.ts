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
	/** The comment block's own first line (spec §5.2's "prose" side of a staleness comparison). */
	startLine: number;
	/** Byte offset of the `@prose` comment's own opening delimiter — where its indentation is
	 *  measured from (`notes.ts`), not the closing line's, which carries the gutter's own leading
	 *  space and would be misread as the block's column. */
	startIndex: number;
	/** The comment block's last line / the code's first line — an approximation (a blank line or
	 *  two may separate them), close enough for the staleness check's line-range heuristic. */
	proseEndLine: number;
	/** The chunk's trailing code's last line (spec §5.2's "code" side). */
	endLine: number;
	/** An `@note` immediately following this chunk's `@prose` block, if one exists (a direction or
	 *  question left for whoever — human or agent — touches this chunk next). */
	note?: string;
	/** `/**`-delimited (with a ` * ` gutter), `<!--`-delimited, or `#`-delimited (YAML/TOML,
	 *  one `#` per line, no closing delimiter) — which style a *new* `@note` should be written in,
	 *  matching whichever style this chunk's own `@prose` block used. */
	commentStyle: "js" | "html" | "hash";
	/** Which language this chunk's own trailing *code* is in — not always the same as
	 *  `commentStyle` (a `.svelte` file's `<style>` block uses JS-style `/** *\/` comments but its
	 *  code is CSS). `src/checks.ts`'s symbol check only attempts a JS/TS parse when this is
	 *  `"js"` — CSS, HTML, YAML and TOML aren't in scope yet (spec §5.1). */
	codeLang: "js" | "css" | "html" | "yaml" | "toml";
	/** Byte offset just past this chunk's `@prose` comment — where a brand-new `@note` is
	 *  inserted when `note` is unset. */
	proseEndIndex: number;
	/** Byte offset just past everything this block's comment consumes — its `@prose` block plus its
	 *  `@note`, if any. With `startIndex` it is the comment's exact span, so a view can lay the
	 *  file's code out around the comments (`src/tree.ts` sends these as a block's `span`). */
	endIndex: number;
	/** Set only when `note` is set — the exact byte span of the existing `@note` comment, so it
	 *  can be replaced (a new note overwrites it) or removed (resolving it) precisely. */
	noteStartIndex?: number;
	noteEndIndex?: number;
}

export interface ProseSection {
	heading: string | null;
	slug: string;
	chunks: ProseChunk[];
}

export interface FileParse {
	fileProse: string | null;
	/** The file prose as a block in its own right (slug `file`), so it can carry a note and be
	 *  laid out in place like any chunk. Its `code` is the preamble. Null for a file with no block. */
	fileBlock: ProseChunk | null;
	preamble: string;
	sections: ProseSection[];
}

interface RawBlock {
	kind: "prose" | "note";
	commentStyle: "js" | "html" | "hash";
	/** Which language this block's own *trailing code* is in — distinct from `commentStyle` (a
	 *  CSS file's comments are `/** *\/`-delimited too, same as JS, but its code obviously isn't
	 *  JS). `src/checks.ts`'s symbol check only attempts a JS/TS parse when this is `"js"`. */
	codeLang: "js" | "css" | "html" | "yaml" | "toml";
	body: string;
	startIndex: number;
	endIndex: number;
	startLine: number;
	/** For `.svelte` files: the end of this block's own part (script/style/markup), so its
	 *  trailing code never bleeds across a part boundary into the next `<script>`/`<style>` tag. */
	partEnd?: number;
}

/** A `RawBlock` after `mergeNotes` has folded any following `@note` into its preceding `@prose`
 *  block — one entry per prose block, each optionally carrying the note attached to it. */
interface ProseRawBlock {
	commentStyle: "js" | "html" | "hash";
	codeLang: "js" | "css" | "html" | "yaml" | "toml";
	body: string;
	startIndex: number;
	startLine: number;
	partEnd?: number;
	/** End of the `@prose` comment itself, before any note — where a brand-new `@note` goes. */
	proseEndIndex: number;
	note?: string;
	noteStartIndex?: number;
	noteEndIndex?: number;
	/** End of everything this block consumes — the `@prose` comment plus its note, if any. Chunk
	 *  code starts here. */
	endIndex: number;
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
 * # Recognizing a prose block or a note
 *
 * A comment only counts if its first line, trimmed, starts with `@prose` or `@note` — any other
 * comment (unmarked JSDoc, `//`, a tool pragma) returns `null` here and is left as an ordinary
 * code comment (spec §3.1). `@note` is a direction or question left for whoever touches this
 * chunk next — human or agent — always immediately following the `@prose` block it's about
 * (`mergeNotes` below folds it in); it's not prose in its own right, so it never opens a chunk or
 * a section on its own. `stripContinuation` is the JS/TS/CSS-vs-HTML difference: JS-like comments
 * carry a ` * ` gutter on every continuation line (which this strips); HTML comments don't, so
 * their lines are taken as-is.
 */
const MARKERS = ["@prose", "@note"] as const;

/** The marker check + trimming shared by every comment style — a comment counts only if its
 *  first line, trimmed, starts with `@prose` or `@note`; blank lines at either edge of the body
 *  are dropped. `lines` are already gutter-stripped by the caller (each style strips its own
 *  gutter differently: JS's ` * `, hash-style's `# `, HTML's none at all). */
function extractMarkedFromLines(lines: string[]): { kind: "prose" | "note"; body: string } | null {
	const trimmedFirst = lines[0].trim();
	const marker = MARKERS.find((m) => trimmedFirst.startsWith(m));
	if (!marker) return null;
	let rest = trimmedFirst.slice(marker.length);
	if (rest.startsWith(" ")) rest = rest.slice(1);
	const out: string[] = [];
	if (rest.length > 0) out.push(rest);
	for (let i = 1; i < lines.length; i++) out.push(lines[i]);
	while (out.length && out[0].trim() === "") out.shift();
	while (out.length && out[out.length - 1].trim() === "") out.pop();
	return { kind: marker === "@prose" ? "prose" : "note", body: out.join("\n") };
}

function extractMarkedBlock(
	inner: string,
	stripContinuation: boolean,
): { kind: "prose" | "note"; body: string } | null {
	const lines = inner.split("\n");
	const stripped = lines.map((line, i) =>
		i === 0 || !stripContinuation ? line : line.replace(/^[ \t]*\*[ \t]?/, ""),
	);
	return extractMarkedFromLines(stripped);
}

/** @prose
 * # Folding a note into its prose block
 *
 * A `@note` is only ever meaningful directly after the `@prose` block it's about (the convention
 * this tool writes it in) — so it's found by adjacency, not by any anchor syntax: if nothing but
 * whitespace sits between a block's end and the next block, and that next block is a `@note`, it
 * belongs to the first. A note with nowhere to attach (no preceding prose block, or real code in
 * between) has no defined position and is dropped — there is no anchor for it to fall back to.
 */
function mergeNotes(blocks: RawBlock[], source: string): ProseRawBlock[] {
	const merged: ProseRawBlock[] = [];
	for (const block of blocks) {
		if (block.kind === "note") {
			const prev = merged[merged.length - 1];
			if (prev && source.slice(prev.endIndex, block.startIndex).trim() === "") {
				prev.note = block.body;
				prev.noteStartIndex = block.startIndex;
				prev.noteEndIndex = block.endIndex;
				prev.endIndex = block.endIndex;
			}
			continue;
		}
		merged.push({
			commentStyle: block.commentStyle,
			codeLang: block.codeLang,
			body: block.body,
			startIndex: block.startIndex,
			startLine: block.startLine,
			partEnd: block.partEnd,
			proseEndIndex: block.endIndex,
			endIndex: block.endIndex,
		});
	}
	return merged;
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
function scanJsLike(source: string, codeLang: "js" | "css" = "js"): RawBlock[] {
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
				const marked = extractMarkedBlock(inner, true);
				if (marked) {
					blocks.push({
						...marked,
						commentStyle: "js",
						codeLang,
						startIndex: start,
						endIndex: end,
						startLine: lineAt(source, start),
					});
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

/** @prose
 * # Scanning YAML/TOML
 *
 * Both languages use `#` for a line comment, with no closing delimiter, so a block's boundary
 * can't come from a delimiter the way `/** *\/` or `<!-- -->` gives one — it comes from the
 * marker itself: a block starts at a `#`-line whose stripped content is `@prose`/`@note`, and
 * runs through following `#`-lines up to (not including) the next marker line or the first
 * non-`#` line, whichever comes first. That's what lets two markers sit back-to-back with no
 * blank line between them (a `@prose` block immediately followed by its own `@note`, same as the
 * JS/HTML styles support) without the second marker's lines bleeding into the first block's body.
 * Only counts as top-level when the `#` sits at column 0 — indented inside a nested
 * mapping/table it's an ordinary comment, mirroring the depth-0 rule `scanJsLike` applies to
 * braces (spec §3.1's "prose blocks... at top level").
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
	const isMarkerLine = (stripped: string): boolean => {
		const trimmed = stripped.trim();
		return MARKERS.some((m) => trimmed.startsWith(m));
	};

	let i = 0;
	while (i < lines.length) {
		const stripped = lines[i].startsWith("#") ? lines[i].replace(/^#[ \t]?/, "") : null;
		if (stripped === null || !isMarkerLine(stripped)) {
			i++;
			continue;
		}
		const startLine = i;
		const commentLines = [stripped];
		i++;
		while (i < lines.length && lines[i].startsWith("#")) {
			const next = lines[i].replace(/^#[ \t]?/, "");
			if (isMarkerLine(next)) break;
			commentLines.push(next);
			i++;
		}
		const marked = extractMarkedFromLines(commentLines);
		if (marked) {
			// `endIndex` lands right after the last comment line's own content, before its trailing
			// newline — matching `scanJsLike`/`scanHtml`'s convention (their `end` sits right after
			// `*/`/`-->`, also before any newline), so `notes.ts`'s insertion logic (which always
			// prepends its own `"\n"`) works identically regardless of comment style.
			const lastLine = i - 1;
			blocks.push({
				...marked,
				commentStyle: "hash",
				codeLang,
				startIndex: lineOffsets[startLine],
				endIndex: lineOffsets[lastLine] + lines[lastLine].length,
				startLine: startLine + 1,
			});
		}
	}
	return blocks;
}

/** Scans HTML source for `<!-- @prose ... -->` and `<!-- @note ... -->` comments. */
function scanHtml(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	const re = /<!--([\s\S]*?)-->/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(source))) {
		const marked = extractMarkedBlock(match[1], false);
		if (marked) {
			blocks.push({
				...marked,
				commentStyle: "html",
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
		kind: block.kind,
		commentStyle: block.commentStyle,
		codeLang: block.codeLang,
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
		const [full, tagName, inner] = match;
		const tagStart = match.index;
		const markup = source.slice(last, tagStart);
		for (const block of scanHtml(markup)) blocks.push(shiftBlock(block, last, source, tagStart));
		const innerOffset = tagStart + full.indexOf(inner);
		const innerEnd = innerOffset + inner.length;
		const codeLang = tagName === "style" ? "css" : "js";
		for (const block of scanJsLike(inner, codeLang))
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
	const rawBlocks =
		extension === "html"
			? scanHtml(source)
			: extension === "svelte"
				? scanSvelte(source)
				: extension === "yaml" || extension === "yml"
					? scanHashComments(source, "yaml")
					: extension === "toml"
						? scanHashComments(source, "toml")
						: scanJsLike(source, extension === "css" ? "css" : "js");
	// `mergeNotes` folds a `@note` into whichever `@prose` block precedes it, the file prose's
	// included, so the file block carries its own note like any chunk.
	const blocks = mergeNotes(rawBlocks, source);

	if (blocks.length === 0) {
		return { fileProse: null, fileBlock: null, preamble: source.trim(), sections: [] };
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
		const proseEndLine = lineAt(source, block.endIndex);
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
			startIndex: block.startIndex,
			proseEndLine,
			endLine,
			note: block.note,
			commentStyle: block.commentStyle,
			codeLang: block.codeLang,
			proseEndIndex: block.proseEndIndex,
			endIndex: block.endIndex,
			noteStartIndex: block.noteStartIndex,
			noteEndIndex: block.noteEndIndex,
		});
	}
	sections.push(currentSection);

	const fileChunk: ProseChunk = {
		slug: FILE_ANCHOR,
		heading: null,
		prose: fileBlock.body,
		code: preamble,
		pending: false,
		startLine: fileBlock.startLine,
		startIndex: fileBlock.startIndex,
		proseEndLine: lineAt(source, fileBlock.endIndex),
		endLine: lineAt(source, preambleEnd),
		note: fileBlock.note,
		commentStyle: fileBlock.commentStyle,
		codeLang: fileBlock.codeLang,
		proseEndIndex: fileBlock.proseEndIndex,
		endIndex: fileBlock.endIndex,
		noteStartIndex: fileBlock.noteStartIndex,
		noteEndIndex: fileBlock.noteEndIndex,
	};
	return { fileProse: fileBlock.body, fileBlock: fileChunk, preamble, sections };
}

/** The anchor of a file's own prose block: `src/store.ts#file`. No chunk can collide with it,
 *  since an unheaded chunk is `top-chunk-N` and a headed one is `<section>/<slug>`. */
export const FILE_ANCHOR = "file";

/** The anchor half of a chunk's stable path (`tree.ts` prefixes it with `<relPath>#`) — shared
 *  with `notes.ts`, which needs to re-derive the exact same anchor from a fresh parse to find the
 *  chunk a note write targets, without duplicating this slug logic a second time. */
export function chunkAnchor(section: ProseSection, chunk: ProseChunk): string {
	return section.heading === null ? chunk.slug : `${section.slug}/${chunk.slug}`;
}

/** Returns the first Markdown paragraph of `text`, skipping a leading heading line, for use as a summary. */
export function firstParagraph(text: string): string {
	const withoutTitle = text.replace(/^#{1,6}\s+.*(\n|$)/, "").trim();
	const paragraph = withoutTitle.split(/\n\s*\n/)[0] ?? "";
	return paragraph.trim();
}
