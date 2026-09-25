/** @prose
 * Pure helpers over the `TreeNode` tree the server pushes (`src/tree.ts`). The tree is the client's
 * only data source — every node already carries its prose, code and note — so finding "the node
 * for this URL" is a local search, not an RPC call. Type-only import from `src/`: the server module
 * uses `node:fs` and must never be bundled into the browser.
 */
import type { TreeNode } from "../src/tree.js";

export type { TreeNode };

export function findNode(tree: TreeNode, path: string): TreeNode | null {
	return pathTo(tree, path).at(-1) ?? null;
}

/** @prose
 * # Resolving a URL to a node
 *
 * The rail's leaves are files (spec §3.2), so a path naming a block (`src/store.ts#addTodo`, or a
 * `linked` symbol's target) resolves to its *file*, plus a `focus` telling the page which block to
 * scroll to. An unknown path falls back to the project root. This keeps every block linkable
 * without making it a page of its own.
 */
export function resolvePath(
	tree: TreeNode,
	path: string,
): { node: TreeNode; focus: string | null } {
	const exact = findNode(tree, path);
	if (exact) return { node: exact, focus: null };
	const hash = path.indexOf("#");
	if (hash > 0) {
		const file = findNode(tree, path.slice(0, hash));
		if (file) return { node: file, focus: file.blocks?.some((b) => b.path === path) ? path : null };
	}
	return { node: tree, focus: null };
}

/** The chain of nodes from the project root down to `path`, inclusive; empty if it isn't in the tree. */
export function pathTo(tree: TreeNode, path: string): TreeNode[] {
	if (tree.path === path) return [tree];
	for (const child of tree.children) {
		const chain = pathTo(child, path);
		if (chain.length > 0) return [tree, ...chain];
	}
	return [];
}

/** Every node, depth-first, in the order the rail shows them. */
export function flatten(tree: TreeNode): TreeNode[] {
	return [tree, ...tree.children.flatMap(flatten)];
}

/** A short display name: files and folders carry their full relative path as `name`, but next to
 *  their parent only the last segment is useful. */
export function label(node: TreeNode): string {
	return node.name.slice(node.name.lastIndexOf("/") + 1);
}

/** @prose
 * Children in explorer order: folders first, then files (raw files alongside them), each group
 * alphabetical as the walker already produced it. The project's own `prose/*.md` docs stay ahead of everything (spec §4: L3 is
 * the project prose first, then the folder tree).
 */
export function ordered(children: TreeNode[]): TreeNode[] {
	const rank = (n: TreeNode) =>
		n.path.startsWith("prose/") && n.kind === "file" ? 0 : n.kind === "folder" ? 1 : 2;
	return children
		.map((node, i) => ({ node, i }))
		.sort((a, b) => rank(a.node) - rank(b.node) || a.i - b.i)
		.map((x) => x.node);
}

export type Segment = { kind: "code"; text: string } | { kind: "block"; block: TreeNode };

/** @prose
 * # A file, in order
 *
 * Lays a file out as it was written: the code between the prose comments, and each prose block at
 * the byte range its comment occupied (`span`). The comment text itself is dropped (the page renders
 * it as prose in its place), so the whole file is shown and nothing is repeated. Blank lines at the
 * edges of each code run are trimmed; a run that is only whitespace disappears.
 */
export function segments(source: string, blocks: TreeNode[]): Segment[] {
	const out: Segment[] = [];
	const pushCode = (raw: string) => {
		const text = raw.replace(/^(?:[ \t]*\r?\n)+/, "").replace(/\s+$/, "");
		if (text) out.push({ kind: "code", text });
	};
	let at = 0;
	const spanned = blocks.filter((b) => b.span).sort((a, b) => a.span![0] - b.span![0]);
	for (const block of spanned) {
		const [start, end] = block.span!;
		pushCode(source.slice(at, start));
		out.push({ kind: "block", block });
		at = end;
	}
	pushCode(source.slice(at));
	return out;
}
