/** @prose
 * # Writing `@note`s back into source (spec §6.2–§6.3)
 *
 * The write side of the annotator: given a chunk's stable path and some text, insert or replace
 * the `@note` comment attached to that chunk's own `@prose` block, or remove it entirely when
 * resolved. Every call re-reads and re-parses the target file fresh rather than trusting the
 * client's in-memory tree — the file on disk is the only truth, and `parseFile` already gives the
 * exact byte offsets (`proseEndIndex`/`noteStartIndex`/`noteEndIndex`) needed to edit it precisely
 * without disturbing anything else in the file.
 *
 * Three guards stand between the view and the source it writes (spec §6, "Trust boundary";
 * §6.2–§6.3): the path must name a file the tree holds, inside the root; the block's hash must
 * still match the one the client saw; and the note text is escaped so it can never end its
 * comment or start a block. `plugin.ts` adds the fourth: no writes at all unless the dev server
 * is bound to loopback.
 */
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { blockHash, chunkAnchor, FILE_ANCHOR, type ProseChunk, parseFile } from "./parser.js";
import { projectFiles } from "./tree.js";

const SOURCE_EXTENSIONS = new Set(["js", "ts", "css", "html", "svelte", "yaml", "yml", "toml"]);

function extensionOf(name: string): string {
	return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

/** A write the server refused: the block changed underneath the client (spec §6.3), or the path
 *  isn't one it may write. The message is shown in the view as is. */
export class NoteWriteError extends Error {
	override name = "NoteWriteError";
}

/** @prose
 * # Which file a write may touch
 *
 * The RPC endpoint has no authentication (spec §6), so a path from the client is untrusted. It
 * must resolve inside the root, including through symlinks, and name a file `projectFiles` lists,
 * the same list the tree is built from: nothing the view couldn't have shown is writable.
 */
function safeFile(root: string, relPath: string): string {
	const refuse = () => new NoteWriteError(`"${relPath}" isn't a file in this project.`);
	const abs = resolve(root, relPath);
	const rel = relative(root, abs);
	if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw refuse();
	let real: string;
	try {
		real = realpathSync(abs);
	} catch {
		throw refuse();
	}
	const realRel = relative(realpathSync(root), real);
	if (!realRel || realRel.startsWith("..") || isAbsolute(realRel)) throw refuse();
	if (!projectFiles(root).includes(rel.split("\\").join("/"))) throw refuse();
	return abs;
}

/** @prose
 * Splits a chunk's stable path (`src/store.ts#addTodo`, `src/store.ts#state/addTodo`, or
 * `src/store.ts#file` for the file prose) into the file it lives in and the anchor within it.
 * Only files that can hold a note get this far; a plain `.md` file is whole-file prose, with no
 * block to attach one to yet.
 */
function splitPath(path: string): { relPath: string; anchor: string; ext: string } {
	const hashIndex = path.indexOf("#");
	if (hashIndex === -1) throw new NoteWriteError(`"${path}" names a file, not a block.`);
	const relPath = path.slice(0, hashIndex);
	const ext = extensionOf(relPath);
	if (!SOURCE_EXTENSIONS.has(ext)) {
		throw new NoteWriteError(`"${relPath}" can't hold a note yet (spec §10).`);
	}
	return { relPath, anchor: path.slice(hashIndex + 1), ext };
}

/** @prose
 * Re-finds the block in a fresh parse of the file, with the same `chunkAnchor` `tree.ts` uses to
 * build the path in the first place, so the two can never disagree about what a path means. Then
 * checks it's still the block the client saw: its hash must match `expectedHash`, or the write is
 * refused (an agent or an editor changed it, or anchors moved because a block was inserted above).
 */
function locateChunk(
	source: string,
	ext: string,
	anchor: string,
	expectedHash: string,
): ProseChunk {
	const parsed = parseFile(source, ext);
	let chunk: ProseChunk | null = null;
	if (anchor === FILE_ANCHOR) chunk = parsed.fileBlock;
	else {
		for (const section of parsed.sections) {
			for (const c of section.chunks) if (chunkAnchor(section, c) === anchor) chunk ??= c;
		}
	}
	if (!chunk || blockHash(chunk) !== expectedHash) {
		throw new NoteWriteError(
			`The block at "#${anchor}" changed since the view loaded it, so nothing was written. Check the block and try again.`,
		);
	}
	return chunk;
}

function indentAt(source: string, index: number): string {
	const lineStart = source.lastIndexOf("\n", index - 1) + 1;
	const match = /^[ \t]*/.exec(source.slice(lineStart, index));
	return match ? match[0] : "";
}

/** @prose
 * The whole line(s) spanning `[start, end)`, trailing newline included — deleting exactly this
 * range removes a comment cleanly, with no blank line left behind in its place. A comment on the
 * file's last line has no newline after it, so the one before it goes instead: that's the newline
 * `addNote` inserted, which keeps add then resolve byte-identical.
 */
function wholeLineRange(source: string, start: number, end: number): [number, number] {
	const lineStart = source.lastIndexOf("\n", start - 1) + 1;
	const nextNewline = source.indexOf("\n", end);
	if (nextNewline !== -1) return [lineStart, nextNewline + 1];
	if (lineStart === 0) return [0, source.length];
	const before = source[lineStart - 2] === "\r" ? 2 : 1;
	return [lineStart - before, source.length];
}

/** @prose
 * # Escaping note text (spec §6.2)
 *
 * A note can say anything, including its own comment's closing delimiter, so the text is
 * normalized and escaped before it's formatted:
 *
 * - Line endings become `\n` (the file's own ending is applied later), and blank lines at either
 *   edge are dropped, since the parser drops them on read anyway.
 * - `/** *\/` style (JS, TS, CSS): a backslash goes between `*` and `/`, so the comment can't
 *   close early (the same `*\/` spelling this repo's own prose uses), and between `<` and `/`,
 *   so a note in a `<script>` or `<style>` of an `.html` or `.svelte` file can't end the element
 *   around it.
 * - `<!-- -->` style: `-->` and `--!>` (both close a comment in a browser) become `--&gt;` and
 *   `--!&gt;`.
 * - `#` style (YAML, TOML): a line that would read as a marker (`@prose`, `@note`) gets a
 *   backslash before its `@`, since a marker line starts a new block there.
 *
 * The escapes are left in place on read: the view shows the backslash, and saving that text again
 * changes nothing, since escaping is idempotent.
 */
export function escapeNote(text: string, commentStyle: "js" | "html" | "hash"): string {
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	while (lines.length && lines[0].trim() === "") lines.shift();
	while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
	const body = lines.join("\n");
	if (commentStyle === "js") return body.replaceAll("*/", "*\\/").replaceAll("</", "<\\/");
	if (commentStyle === "html") return body.replace(/--(!?)>/g, "--$1&gt;");
	return body.replace(/^([ \t]*)@(prose|note)/gm, "$1\\@$2");
}

/** No leading or trailing newline — callers are in the best position to know how many newlines
 *  belong on each side (a fresh insert needs exactly one before it; a replacement's surrounding
 *  newlines are already accounted for by `wholeLineRange`), so this only formats the comment text.
 *  `text` is already escaped. */
function formatNote(
	text: string,
	indent: string,
	commentStyle: "js" | "html" | "hash",
	eol: string,
): string {
	const lines = text.split("\n");
	if (commentStyle === "js") {
		const body = lines.map((line) => (line ? `${indent} * ${line}` : `${indent} *`)).join(eol);
		return `${indent}/** @note${eol}${body}${eol}${indent} */`;
	}
	if (commentStyle === "hash") {
		const body = lines.map((line) => (line ? `${indent}# ${line}` : `${indent}#`)).join(eol);
		return `${indent}# @note${eol}${body}`;
	}
	return `${indent}<!-- @note${eol}${lines.join(eol)}${eol}${indent}-->`;
}

/** @prose
 * # The edit itself, as a pure function of the file's text
 *
 * `withNote` and `withoutNote` take a file's source and return the new source, touching nothing
 * on disk, so the property tests can run them thousands of times. Adding a note when one already
 * exists replaces it in place, rather than stacking a second `@note` block — one open note per
 * chunk keeps "does this chunk have outstanding feedback" a yes/no question, matching how the
 * client shows it (a single note block, not a thread). New lines use the file's own line ending.
 */
export function withNote(
	source: string,
	ext: string,
	anchor: string,
	text: string,
	expectedHash: string,
): string {
	const chunk = locateChunk(source, ext, anchor, expectedHash);
	const escaped = escapeNote(text, chunk.commentStyle);
	if (!escaped.trim()) throw new NoteWriteError("A note needs some text.");
	const eol = source.includes("\r\n") ? "\r\n" : "\n";
	const indent = indentAt(source, chunk.startIndex);
	const formatted = formatNote(escaped, indent, chunk.commentStyle, eol);

	if (chunk.noteStartIndex !== undefined && chunk.noteEndIndex !== undefined) {
		const lineStart = source.lastIndexOf("\n", chunk.noteStartIndex - 1) + 1;
		return `${source.slice(0, lineStart)}${formatted}${source.slice(chunk.noteEndIndex)}`;
	}
	return `${source.slice(0, chunk.proseEndIndex)}${eol}${formatted}${source.slice(chunk.proseEndIndex)}`;
}

/** Removes an existing `@note` outright — nothing is kept once resolved (spec: fold anything
 *  worth remembering into the `@prose` block itself, not into a second, disposable log). A no-op
 *  is an error, not a silent success: resolving a note that isn't there means the client's view is
 *  already stale, and the caller should know that rather than assume it worked. */
export function withoutNote(
	source: string,
	ext: string,
	anchor: string,
	expectedHash: string,
): string {
	const chunk = locateChunk(source, ext, anchor, expectedHash);
	if (chunk.noteStartIndex === undefined || chunk.noteEndIndex === undefined) {
		throw new NoteWriteError(`The block at "#${anchor}" has no note to resolve.`);
	}
	const [start, end] = wholeLineRange(source, chunk.noteStartIndex, chunk.noteEndIndex);
	return source.slice(0, start) + source.slice(end);
}

/** @prose
 * The two writes the RPC calls: check the path (`safeFile`), then read, edit and write the file
 * in one synchronous step, so nothing else in this process can interleave. `expectedHash` is the
 * block's `hash` from the tree the client holds.
 */
export function addNote(root: string, path: string, text: string, expectedHash: string): void {
	const { relPath, anchor, ext } = splitPath(path);
	const file = safeFile(root, relPath);
	const source = readFileSync(file, "utf-8");
	writeFileSync(file, withNote(source, ext, anchor, text, expectedHash), "utf-8");
}

export function resolveNote(root: string, path: string, expectedHash: string): void {
	const { relPath, anchor, ext } = splitPath(path);
	const file = safeFile(root, relPath);
	const source = readFileSync(file, "utf-8");
	writeFileSync(file, withoutNote(source, ext, anchor, expectedHash), "utf-8");
}
