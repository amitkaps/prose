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
}

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
			.replace(/`/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "section"
	);
}

/** Strips a JSDoc-style `/** ... *\/` wrapper and the `@prose` marker, returning the Markdown body. */
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

/** Scans JS/TS/CSS source for top-level (depth-0) `/** @prose ... *\/` block comments. */
function scanJsLike(source: string): RawBlock[] {
	const blocks: RawBlock[] = [];
	let i = 0;
	let depth = 0;
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
		if (c === "{") {
			depth++;
			i++;
			continue;
		}
		if (c === "}") {
			depth = Math.max(0, depth - 1);
			i++;
			continue;
		}
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

/** Parses one source file into file prose, a preamble, and its sections/chunks (spec §3.2). */
export function parseFile(source: string, extension: string): FileParse {
	const blocks = extension === "html" ? scanHtml(source) : scanJsLike(source);

	if (blocks.length === 0) {
		return { fileProse: null, preamble: source.trim(), sections: [] };
	}

	const [fileBlock, ...rest] = blocks;
	const nextStart = rest.length > 0 ? rest[0].startIndex : source.length;
	const preamble = source.slice(fileBlock.endIndex, nextStart).trim();

	const sections: ProseSection[] = [];
	let currentSection: ProseSection = { heading: null, slug: "top", chunks: [] };
	let hasOpenedSection = false;

	for (let i = 0; i < rest.length; i++) {
		const block = rest[i];
		const codeEnd = i + 1 < rest.length ? rest[i + 1].startIndex : source.length;
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
