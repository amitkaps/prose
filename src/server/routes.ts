/** @prose
 * The `prose:*` RPC handlers registered by `plugin.ts` (spec §6.3). Kept as plain functions
 * of `(root, ...)` rather than closures over a devframe context, so they're callable directly
 * from a test or a script without spinning up Devframe at all — `plugin.ts` is the only place
 * that knows about RPC.
 */
import { addNote, resolveNote } from "../notes.js";
import { buildTree, findNode, type TreeNode } from "../tree.js";

/** @prose The full hierarchy, with summaries — one `buildTree` walk per call, not cached,
 *  since a dev-only tool re-walking a small project on every request is cheap enough that
 *  caching would just be a staleness bug waiting to happen. */
export function handleTree(root: string): TreeNode {
	return buildTree(root);
}

/** @prose One node's prose, code, and children summaries, given its stable path. Rebuilds the
 *  whole tree first — same reasoning as `handleTree` — then looks the single node up in it. */
export function handleNode(root: string, path: string): TreeNode | null {
	const tree = buildTree(root);
	return findNode(tree, path);
}

/** @prose Writes (or replaces) the `@note` on the chunk at `path`, then returns its fresh node —
 *  same round trip as `handleNode`, so the client can just swap in the response without a second
 *  RPC call to see its own write reflected. `hash` is the block's hash from the caller's tree;
 *  a mismatch refuses the write (spec §6.3). */
export function handleAddNote(
	root: string,
	path: string,
	text: string,
	hash: string,
): TreeNode | null {
	addNote(root, path, text, hash);
	return findNode(buildTree(root), path);
}

/** @prose Removes the `@note` on the chunk at `path`, then returns its fresh node — same
 *  round-trip reasoning as `handleAddNote`. */
export function handleResolveNote(root: string, path: string, hash: string): TreeNode | null {
	resolveNote(root, path, hash);
	return findNode(buildTree(root), path);
}
