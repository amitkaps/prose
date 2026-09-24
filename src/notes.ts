/** @prose
 * # Writing `@note`s back into source (spec §6.3-equivalent)
 *
 * The write side of the annotator: given a chunk's stable path and some text, insert or replace
 * the `@note` comment attached to that chunk's own `@prose` block, or remove it entirely when
 * resolved. Every call re-reads and re-parses the target file fresh rather than trusting the
 * client's in-memory tree — the file on disk is the only truth, and `parseFile` already gives the
 * exact byte offsets (`proseEndIndex`/`noteStartIndex`/`noteEndIndex`) needed to edit it precisely
 * without disturbing anything else in the file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkAnchor, type ProseChunk, parseFile } from "./parser.js";

const SOURCE_EXTENSIONS = new Set(["js", "ts", "css", "html", "svelte", "yaml", "yml", "toml"]);

function extensionOf(name: string): string {
	return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

/** @prose
 * Splits a chunk's stable path (`src/store.ts#addTodo` or `src/store.ts#state/addTodo`) into the
 * file it lives in and re-finds that exact chunk in a fresh parse of it — the same `chunkAnchor`
 * `tree.ts` uses to build the path in the first place, so the two can never disagree about what a
 * path means. Returns `null` for a path this module can't act on: a plain `.md` file (whole-file
 * prose, no chunks to attach a note to) or a chunk that no longer exists (the file changed since
 * the client last loaded its tree).
 */
function findChunk(root: string, path: string): { source: string; chunk: ProseChunk } | null {
	const hashIndex = path.indexOf("#");
	if (hashIndex === -1) return null; // file/folder/project-level nodes have no chunk to attach to
	const relPath = path.slice(0, hashIndex);
	const anchor = path.slice(hashIndex + 1);
	const ext = extensionOf(relPath);
	if (!SOURCE_EXTENSIONS.has(ext)) return null;

	const source = readFileSync(join(root, relPath), "utf-8");
	const parsed = parseFile(source, ext);
	for (const section of parsed.sections) {
		for (const chunk of section.chunks) {
			if (chunkAnchor(section, chunk) === anchor) return { source, chunk };
		}
	}
	return null;
}

function indentAt(source: string, index: number): string {
	const lineStart = source.lastIndexOf("\n", index - 1) + 1;
	const match = /^[ \t]*/.exec(source.slice(lineStart, index));
	return match ? match[0] : "";
}

/** The whole line(s) spanning `[start, end)`, trailing newline included — deleting exactly this
 *  range removes a comment cleanly, with no blank line left behind in its place. */
function wholeLineRange(source: string, start: number, end: number): [number, number] {
	const lineStart = source.lastIndexOf("\n", start - 1) + 1;
	const nextNewline = source.indexOf("\n", end);
	const lineEnd = nextNewline === -1 ? source.length : nextNewline + 1;
	return [lineStart, lineEnd];
}

/** No leading or trailing newline — callers are in the best position to know how many newlines
 *  belong on each side (a fresh insert needs exactly one before it; a replacement's surrounding
 *  newlines are already accounted for by `wholeLineRange`), so this only formats the comment text. */
function formatNote(text: string, indent: string, commentStyle: "js" | "html" | "hash"): string {
	const lines = text.split("\n");
	if (commentStyle === "js") {
		const body = lines.map((line) => `${indent} * ${line}`).join("\n");
		return `${indent}/** @note\n${body}\n${indent} */`;
	}
	if (commentStyle === "hash") {
		const body = lines.map((line) => (line ? `${indent}# ${line}` : `${indent}#`)).join("\n");
		return `${indent}# @note\n${body}`;
	}
	const body = lines.join("\n");
	return `${indent}<!-- @note\n${body}\n${indent}-->`;
}

/** @prose
 * Adding a note when one already exists replaces it in place, rather than stacking a second
 * `@note` block — one open note per chunk keeps "does this chunk have outstanding feedback" a
 * yes/no question, matching how the client shows it (a single note block, not a thread).
 */
export function addNote(root: string, path: string, text: string): void {
	const found = findChunk(root, path);
	if (!found) throw new Error(`No chunk found at "${path}" to attach a note to.`);
	const { source, chunk } = found;
	const indent = indentAt(source, chunk.startIndex);
	const formatted = formatNote(text, indent, chunk.commentStyle);

	let next: string;
	if (chunk.noteStartIndex !== undefined && chunk.noteEndIndex !== undefined) {
		const [start, end] = wholeLineRange(source, chunk.noteStartIndex, chunk.noteEndIndex);
		next = `${source.slice(0, start)}${formatted}\n${source.slice(end)}`;
	} else {
		next = `${source.slice(0, chunk.proseEndIndex)}\n${formatted}${source.slice(chunk.proseEndIndex)}`;
	}
	writeFileSync(join(root, path.slice(0, path.indexOf("#"))), next, "utf-8");
}

/** Removes an existing `@note` outright — nothing is kept once resolved (spec: fold anything
 *  worth remembering into the `@prose` block itself, not into a second, disposable log). A no-op
 *  is an error, not a silent success: resolving a note that isn't there means the client's view is
 *  already stale, and the caller should know that rather than assume it worked. */
export function resolveNote(root: string, path: string): void {
	const found = findChunk(root, path);
	if (!found) throw new Error(`No chunk found at "${path}" to resolve a note on.`);
	const { source, chunk } = found;
	if (chunk.noteStartIndex === undefined || chunk.noteEndIndex === undefined) {
		throw new Error(`Chunk at "${path}" has no note to resolve.`);
	}
	const [start, end] = wholeLineRange(source, chunk.noteStartIndex, chunk.noteEndIndex);
	const next = source.slice(0, start) + source.slice(end);
	writeFileSync(join(root, path.slice(0, path.indexOf("#"))), next, "utf-8");
}
