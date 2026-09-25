/** @prose
 * # Attention and health
 *
 * Everything derived from the tree, computed on the client from data already on every node — no new
 * server work. `rollup` gives each node the sum of what needs attention at or below it (pending
 * chunks, unresolved symbols, stale chunks, open notes), so one badge system can render at any level
 * (spec §6.1). `health` aggregates the same data for the project pane: documentation coverage,
 * pending and stale ratios, the symbol-check split, and the chunks with the least prose per line of
 * code, which is where a summary is most likely to be too thin.
 */
import { flatten, type TreeNode } from "./nav.js";

export interface Attention {
	pending: number;
	unresolved: number;
	stale: number;
	notes: number;
}

const none = (): Attention => ({ pending: 0, unresolved: 0, stale: 0, notes: 0 });

const own = (node: TreeNode): Attention => {
	const a = none();
	if (node.pending) a.pending += 1;
	if (node.note) a.notes += 1;
	for (const w of node.warnings ?? []) {
		if (w.kind === "stale") a.stale += 1;
		else a.unresolved += 1;
	}
	return a;
};

const add = (into: Attention, from: Attention) => {
	into.pending += from.pending;
	into.unresolved += from.unresolved;
	into.stale += from.stale;
	into.notes += from.notes;
};

/** Attention at every node, summed over its subtree. A file's own count is its blocks' (blocks live
 *  on the file, not in `children`), so the rail badge on a file says what is waiting inside it. */
export function rollup(tree: TreeNode): Map<string, Attention> {
	const out = new Map<string, Attention>();
	const visit = (node: TreeNode): Attention => {
		const total = own(node);
		for (const block of node.blocks ?? []) add(total, own(block));
		for (const child of node.children) add(total, visit(child));
		out.set(node.path, total);
		return total;
	};
	visit(tree);
	return out;
}

export interface ThinFile {
	path: string;
	codeLines: number;
	proseWords: number;
}

export interface Health {
	files: { total: number; documented: number };
	blocks: number;
	pending: number;
	stale: number;
	warnings: number;
	notes: number;
	symbols: { local: number; linked: number; unresolved: number };
	codeLines: { median: number; max: number };
	thinnest: ThinFile[];
}

const countLines = (code: string) => code.split("\n").filter((l) => l.trim()).length;
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function health(tree: TreeNode): Health {
	const files = flatten(tree).filter((n) => n.kind === "file" && !n.path.endsWith(".md"));
	const blocks = files.flatMap((f) => f.blocks ?? []);
	const perFile: ThinFile[] = files
		.filter((f) => f.blocks?.length)
		.map((f) => ({
			path: f.path,
			codeLines: (f.blocks ?? []).reduce((sum, b) => sum + countLines(b.code ?? ""), 0),
			proseWords: (f.blocks ?? []).reduce((sum, b) => sum + countWords(b.prose ?? ""), 0),
		}));
	const lines = perFile.map((s) => s.codeLines).sort((a, b) => a - b);
	const symbols = { local: 0, linked: 0, unresolved: 0 };
	for (const b of blocks) for (const s of b.symbols ?? []) symbols[s.status] += 1;
	const attention = rollup(tree).get(tree.path) ?? none();
	return {
		files: {
			total: files.length,
			documented: files.filter((f) => f.summary !== "undocumented").length,
		},
		blocks: blocks.length,
		pending: attention.pending,
		stale: attention.stale,
		warnings: attention.stale + attention.unresolved,
		notes: attention.notes,
		symbols,
		codeLines: { median: lines[Math.floor(lines.length / 2)] ?? 0, max: lines.at(-1) ?? 0 },
		thinnest: perFile
			.filter((s) => s.codeLines >= 20)
			.sort((a, b) => a.proseWords / a.codeLines - b.proseWords / b.codeLines)
			.slice(0, 5),
	};
}
