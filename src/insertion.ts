/** @prose
 * # Where a line note may go (spec §6.2)
 *
 * A comment is legal in some places and not others: inside a template literal, a multi-line
 * string, a `<pre>` or `<textarea>`, an attribute list, or a YAML block scalar it becomes content
 * or breaks the syntax. So a line note is never inserted above the exact line picked in the view
 * but above the start of the construct that contains it: the statement (JS/TS, from the
 * `oxc-parser` AST), the element (HTML and markup), the rule or declaration (CSS), the key (YAML
 * and TOML). `landing` answers with the line the note goes above and the comment style to use,
 * and refuses a blank or comment-only line, which has nothing to annotate. The view asks for it
 * before a write, to show where the note will land; the write asks again, on the file as it is.
 */
import { parseSync } from "oxc-parser";
import { svelteParts } from "./parser.js";

export type CommentStyle = "js" | "html" | "hash";

export class NoAnchorError extends Error {
	override name = "NoAnchorError";
}

export interface Landing {
	/** 1-based line the note goes directly above. */
	line: number;
	style: CommentStyle;
}

interface Found {
	/** Offset in the text scanned that the note goes above (the start of its line is used). */
	offset: number;
}

function lineStart(text: string, offset: number): number {
	return text.lastIndexOf("\n", offset - 1) + 1;
}

function lineNumber(text: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset; i++) if (text[i] === "\n") line++;
	return line;
}

/** Offset of the first non-blank character on the 1-based `line`, or `null` if it is blank or
 *  past the end. */
function firstCode(text: string, line: number): number | null {
	const lines = text.split("\n");
	if (line < 1 || line > lines.length) return null;
	let offset = 0;
	for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1;
	const indent = /^[ \t]*/.exec(lines[line - 1])![0].length;
	return lines[line - 1].trim() === "" ? null : offset + indent;
}

function within(spans: readonly (readonly [number, number])[], offset: number): boolean {
	return spans.some(([start, end]) => offset >= start && offset < end);
}

/** @prose
 * `landing` finds which language the line is in (a `.svelte` file has three), asks that language's
 * finder for the offset to go above, and turns it into a line. Each finder is given only its own
 * part's text, so an offset is relative to the part and is shifted back afterwards.
 */
export function landing(source: string, ext: string, line: number): Landing {
	const code = firstCode(source, line);
	if (code === null) throw new NoAnchorError(`Line ${line} is blank, so there is nothing to note.`);
	let style: CommentStyle;
	let found: Found;
	if (ext === "svelte") {
		const part = svelteParts(source).find(
			(p) => code >= p.start && code <= p.end && p.end > p.start,
		);
		if (!part) throw new NoAnchorError(`Line ${line} has no code to note.`);
		const text = source.slice(part.start, part.end);
		const at = code - part.start;
		style = part.kind === "markup" ? "html" : "js";
		found =
			part.kind === "script"
				? jsFinder(text, at, "ts")
				: part.kind === "style"
					? cssFinder(text, at)
					: htmlFinder(text, at);
		found = { offset: found.offset + part.start };
	} else if (ext === "html") {
		style = "html";
		found = htmlFinder(source, code);
	} else if (ext === "css") {
		style = "js";
		found = cssFinder(source, code);
	} else if (ext === "yaml" || ext === "yml") {
		style = "hash";
		found = yamlFinder(source, line);
	} else if (ext === "toml") {
		style = "hash";
		found = tomlFinder(source, line);
	} else {
		style = "js";
		found = jsFinder(source, code, ext === "ts" ? "ts" : "js");
	}
	return { line: lineNumber(source, lineStart(source, found.offset)), style };
}

const isComment = (line: number) =>
	new NoAnchorError(`Line ${line} is a comment, so there is nothing to note.`);

/** @prose
 * # JS and TS: the smallest enclosing statement
 *
 * Every array of statements or members in the AST (`body`, `cases`, `consequent`) is a candidate
 * list, and the smallest element containing the line's first character is where the note goes
 * above. A line inside a template literal or a multi-line call therefore lands above the
 * statement it belongs to; a line inside a function body lands above its own statement, inside
 * the function. Ordinary comments attached directly above that statement (a JSDoc) stay attached:
 * the note goes above them, so it never splits a doc comment from its function.
 */
function jsFinder(text: string, at: number, lang: "js" | "ts"): Found {
	const { program, comments } = parseSync(`file.${lang}`, text);
	const commentSpans = comments.map((c) => [c.start, c.end] as const);
	if (within(commentSpans, at)) throw isComment(lineNumber(text, at));

	let best = null as { start: number; end: number } | null;
	const visit = (node: unknown) => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child);
			return;
		}
		if (!node || typeof node !== "object") return;
		const record = node as Record<string, unknown>;
		for (const [key, value] of Object.entries(record)) {
			if ((key === "body" || key === "cases" || key === "consequent") && Array.isArray(value)) {
				for (const item of value as { start: number; end: number }[]) {
					if (
						at >= item.start &&
						at < item.end &&
						(!best || item.end - item.start < best.end - best.start)
					) {
						best = item;
					}
				}
			}
			if (value && typeof value === "object") visit(value);
		}
	};
	visit(program);
	if (!best) throw new NoAnchorError(`Line ${lineNumber(text, at)} has no statement to note.`);

	let offset = best.start;
	for (;;) {
		const before = comments.find(
			(c) =>
				c.end <= offset &&
				!/\n[ \t]*\r?\n/.test(text.slice(c.end, offset)) &&
				text.slice(c.end, offset).trim() === "" &&
				!/^\/\*\*\s*@(prose|note)\b/.test(text.slice(c.start, c.end)),
		);
		if (!before) break;
		offset = before.start;
	}
	return { offset };
}

/** @prose
 * # CSS: the rule or the declaration
 *
 * A small pass turns the text into nested items: a rule is a prelude and a `{}` body of more
 * items, a declaration or at-rule statement runs to its `;` (or to the `}` that closes the
 * rule). Strings, comments and `url(...)` are skipped so a `;` or `{` inside them ends nothing.
 * The deepest item containing the line's first character is where the note goes above.
 */
interface CssItem {
	start: number;
	end: number;
	children: CssItem[];
}

function cssItems(text: string): { items: CssItem[]; comments: [number, number][] } {
	const comments: [number, number][] = [];
	const n = text.length;
	const skipBlank = (from: number): number => {
		let i = from;
		while (i < n) {
			if (/\s/.test(text[i])) i++;
			else if (text[i] === "/" && text[i + 1] === "*") {
				const close = text.indexOf("*/", i + 2);
				const end = close === -1 ? n : close + 2;
				comments.push([i, end]);
				i = end;
			} else break;
		}
		return i;
	};
	const body = (from: number, nested: boolean): { items: CssItem[]; end: number } => {
		const items: CssItem[] = [];
		let i = skipBlank(from);
		while (i < n) {
			if (text[i] === "}") {
				if (nested) return { items, end: i + 1 };
				i = skipBlank(i + 1);
				continue;
			}
			const item: CssItem = { start: i, end: n, children: [] };
			let paren = 0;
			while (i < n) {
				const c = text[i];
				if (c === '"' || c === "'") {
					i++;
					while (i < n && text[i] !== c) i += text[i] === "\\" ? 2 : 1;
					i++;
				} else if (c === "/" && text[i + 1] === "*") {
					const close = text.indexOf("*/", i + 2);
					const end = close === -1 ? n : close + 2;
					comments.push([i, end]);
					i = end;
				} else if (c === "(") {
					paren++;
					i++;
				} else if (c === ")") {
					paren = Math.max(0, paren - 1);
					i++;
				} else if (paren === 0 && c === ";") {
					i++;
					item.end = i;
					break;
				} else if (paren === 0 && c === "{") {
					const inner = body(i + 1, true);
					item.children = inner.items;
					i = inner.end;
					item.end = i;
					break;
				} else if (paren === 0 && c === "}") {
					item.end = i;
					break;
				} else i++;
			}
			items.push(item);
			i = skipBlank(i);
		}
		return { items, end: n };
	};
	return { items: body(0, false).items, comments };
}

function cssFinder(text: string, at: number): Found {
	const { items, comments } = cssItems(text);
	if (within(comments, at)) throw isComment(lineNumber(text, at));
	let list = items;
	let hit: CssItem | null = null;
	for (;;) {
		const next = list.find((item) => at >= item.start && at < item.end);
		if (!next) break;
		hit = next;
		list = next.children;
	}
	if (!hit) throw new NoAnchorError(`Line ${lineNumber(text, at)} has no rule to note.`);
	return { offset: hit.start };
}

/** @prose
 * # HTML and markup: the element
 *
 * A tag scan builds the elements with their start tag's extent. A line in an element's start tag
 * (its attribute list) or anywhere inside a `<pre>`, `<textarea>`, `<script>` or `<style>` lands
 * above that element; a line in an element's text or between its children lands above itself,
 * inside the element. Quoted attribute values and `{...}` expressions (Svelte) don't end a tag.
 * The deepest element containing the line's first character decides.
 */
interface El {
	name: string;
	start: number;
	tagEnd: number;
	end: number;
	children: El[];
}

const VOID = new Set(
	"area base br col embed hr img input link meta param source track wbr".split(" "),
);
const RAW = new Set(["pre", "textarea", "script", "style"]);

function htmlElements(text: string): { roots: El[]; comments: [number, number][] } {
	const n = text.length;
	const roots: El[] = [];
	const comments: [number, number][] = [];
	const stack: El[] = [];
	const add = (el: El) => (stack.length ? stack[stack.length - 1].children : roots).push(el);
	let i = 0;
	while (i < n) {
		if (text[i] !== "<") {
			i++;
			continue;
		}
		if (text.startsWith("<!--", i)) {
			const close = text.indexOf("-->", i + 4);
			const end = close === -1 ? n : close + 3;
			comments.push([i, end]);
			i = end;
			continue;
		}
		if (text[i + 1] === "/") {
			const close = text.indexOf(">", i);
			const end = close === -1 ? n : close + 1;
			const name = /^<\/\s*([^\s>]+)/.exec(text.slice(i, end))?.[1]?.toLowerCase();
			const at = stack.map((el) => el.name).lastIndexOf(name ?? "");
			if (at !== -1) {
				while (stack.length > at + 1) stack.pop()!.end = i;
				stack.pop()!.end = end;
			}
			i = end;
			continue;
		}
		const open = /^<([A-Za-z][^\s/>{]*)/.exec(text.slice(i, i + 80));
		if (!open) {
			i++;
			continue;
		}
		const name = open[1].toLowerCase();
		let j = i + open[0].length;
		let brace = 0;
		while (j < n && !(text[j] === ">" && brace === 0)) {
			const c = text[j];
			if (c === '"' || c === "'") {
				if (brace === 0) {
					const close = text.indexOf(c, j + 1);
					j = close === -1 ? n : close + 1;
					continue;
				}
			} else if (c === "{") brace++;
			else if (c === "}") brace = Math.max(0, brace - 1);
			j++;
		}
		const tagEnd = Math.min(n, j + 1);
		const el: El = { name, start: i, tagEnd, end: tagEnd, children: [] };
		add(el);
		i = tagEnd;
		const selfClosed = text[j - 1] === "/";
		if (selfClosed || VOID.has(name)) continue;
		if (name === "script" || name === "style" || name === "textarea") {
			const close = new RegExp(`</${name}\\s*>`, "i").exec(text.slice(i));
			el.end = close ? i + close.index + close[0].length : n;
			i = el.end;
			continue;
		}
		el.end = n;
		stack.push(el);
	}
	return { roots, comments };
}

function htmlFinder(text: string, at: number): Found {
	const { roots, comments } = htmlElements(text);
	if (within(comments, at)) throw isComment(lineNumber(text, at));
	let list = roots;
	for (;;) {
		const next = list.find((el) => at >= el.start && at < el.end);
		if (!next) break;
		if (at < next.tagEnd || RAW.has(next.name)) return { offset: next.start };
		list = next.children;
	}
	return { offset: at };
}

/** @prose
 * # YAML: the key, not the block scalar
 *
 * Lines are read top to bottom keeping one bit of state: whether the last key opened a block
 * scalar (`|` or `>`), whose indented lines are text, not YAML. A line inside one lands above the
 * key that opened it. Any other line lands above itself, which is above its key or list item.
 * Multi-line quoted and plain scalars are not detected: a note above a continuation line is
 * written where the line is, so pick the key line.
 */
function yamlFinder(text: string, line: number): Found {
	const lines = text.split("\n");
	const offsetOf = (index: number) =>
		lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
	let scalar: { keyLine: number; indent: number } | null = null;
	for (let i = 0; i < line; i++) {
		const current = lines[i].replace(/\r$/, "");
		const indent = /^[ \t]*/.exec(current)![0].length;
		if (scalar) {
			if (current.trim() === "" || indent > scalar.indent) {
				if (i === line - 1) return { offset: offsetOf(scalar.keyLine) };
				continue;
			}
			scalar = null;
		}
		if (/(?::|-)[ \t]+[|>][+-]?\d?[+-]?[ \t]*(?:#.*)?$/.test(current)) {
			scalar = { keyLine: i, indent };
		}
	}
	const target = lines[line - 1].trim();
	if (target.startsWith("#")) throw isComment(line);
	return { offset: offsetOf(line - 1) };
}

/** @prose
 * # TOML: the entry
 *
 * A TOML entry is a table header or a `key = value`, and a value may run over several lines: a
 * multi-line string (`"""` or `'''`), or an array or inline table left open. Reading lines with
 * the open-string and bracket-depth state, each entry starts on the line where both are clear; a
 * line inside one lands above the line that started it.
 */
function tomlFinder(text: string, line: number): Found {
	const lines = text.split("\n");
	const offsetOf = (index: number) =>
		lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
	let multi: string | null = null;
	let depth = 0;
	let entry = 0;
	for (let i = 0; i < line - 1; i++) {
		const current = lines[i].replace(/\r$/, "");
		if (multi === null && depth === 0 && current.trim() !== "" && !current.trim().startsWith("#")) {
			entry = i;
		}
		let j = 0;
		while (j < current.length) {
			if (multi) {
				const close = current.indexOf(multi, j);
				if (close === -1) break;
				j = close + 3;
				multi = null;
				continue;
			}
			const c = current[j];
			if (c === "#") break;
			if (current.startsWith('"""', j) || current.startsWith("'''", j)) {
				multi = current.slice(j, j + 3);
				j += 3;
			} else if (c === '"' || c === "'") {
				j++;
				while (j < current.length && current[j] !== c)
					j += c === '"' && current[j] === "\\" ? 2 : 1;
				j++;
			} else {
				if (c === "[" || c === "{") depth++;
				else if (c === "]" || c === "}") depth = Math.max(0, depth - 1);
				j++;
			}
		}
	}
	if (multi !== null || depth > 0) return { offset: offsetOf(entry) };
	if (lines[line - 1].trim().startsWith("#")) throw isComment(line);
	return { offset: offsetOf(line - 1) };
}
