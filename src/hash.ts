/** @prose
 * # Small hashes shared by server and client (spec §6.3)
 *
 * A line note is written against a line the client saw, and resolved against a note it saw, so
 * both sides need the same cheap fingerprint. This module has no Node imports, so the browser
 * bundle can use it: the client hashes the line it is about to annotate and the server checks the
 * hash against the line now on disk. FNV-1a over UTF-16 code units, 32 bits, as 8 hex digits:
 * a guard against a stale view, not a security boundary.
 */
function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/** A line's identity for an add: its text with the indentation and any `\r` ignored, so a
 *  reindent or CRLF conversion doesn't refuse a write about the same line. */
export function lineHash(line: string): string {
	return fnv1a(line.trim());
}

/** A line note's identity for a resolve: its text as the parser reads it. */
export function noteHash(text: string): string {
	return fnv1a(text);
}
