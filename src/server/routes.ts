import { buildTree, findNode, type TreeNode } from "../tree.js";

/** GET /__prose/api/tree — the full hierarchy, with summaries (subset of spec §6.4). */
export function handleTree(root: string): TreeNode {
	return buildTree(root);
}

/** GET /__prose/api/node?path=… — one node's prose, code, and children summaries. */
export function handleNode(root: string, path: string): TreeNode | null {
	const tree = buildTree(root);
	return findNode(tree, path);
}
