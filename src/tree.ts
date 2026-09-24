import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
	checkStaleness,
	checkSymbols,
	declaredIdentifiers,
	type Symbol,
	type Warning,
} from "./checks.js";
import { blameFile } from "./git.js";
import { type FileParse, firstParagraph, parseFile } from "./parser.js";

/** @prose
 * # Building the hierarchy
 *
 * Walks a project root into the L3→L0 tree (spec §4): project → folders → files → sections →
 * chunks. Each level's prose and structure come from a different place — a folder's `README.md`,
 * a file's first `@prose` block, a chunk's own block — so this module is mostly about combining
 * `parser.ts`'s per-file output with the filesystem's own folder structure into one shape the
 * client can render generically at any level.
 */
export interface TreeNode {
	name: string;
	kind: "project" | "folder" | "file" | "section" | "chunk";
	path: string;
	summary: string;
	pending?: boolean;
	prose?: string | null;
	code?: string;
	/** Chunk-only: inline code spans from this chunk's own prose, resolved per spec §5.1. */
	symbols?: Symbol[];
	/** This node's own warnings (chunks only, for now — §5 doesn't define file/folder-level checks). */
	warnings?: Warning[];
	/** Own warnings plus every descendant's, so a badge can show at any level without the client
	 *  walking the subtree itself (spec §6.1: "roll up to their ancestors"). */
	warningCount: number;
	children: TreeNode[];
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".svelte-kit", ".vscode", "prose"]);
const SOURCE_EXTENSIONS = new Set(["js", "ts", "css", "html", "svelte", "md"]);
// The one name inside `prose/` with special meaning (spec §3.4/§6.3) — not a document itself.
const RESERVED_PROSE_FILES = new Set(["remarks.md"]);

function extensionOf(name: string): string {
	return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

function readReadme(dir: string): string | null {
	try {
		return readFileSync(join(dir, "README.md"), "utf-8");
	} catch {
		return null;
	}
}

/** @prose
 * # One file's node
 *
 * A `.md` file that isn't a `README.md` skips `parser.ts` entirely — the whole file (frontmatter
 * stripped) is its prose, no chunking, since spec §3.3 treats a plain Markdown file as already
 * being prose. Every other recognized extension goes through `parseFile`, whose sections/chunks
 * become this file's children: an unheaded section's chunks attach directly, a headed section
 * becomes its own `section` node wrapping its chunks.
 */
function fileToNode(root: string, absPath: string): TreeNode {
	const relPath = relative(root, absPath);
	const source = readFileSync(absPath, "utf-8");
	const ext = extensionOf(absPath);
	// A plain .md file is prose by convention (spec §3.3) — no @prose marker or chunking needed.
	// YAML frontmatter, if present, is metadata rather than prose, so it's stripped here too.
	const parsed: FileParse =
		ext === "md"
			? {
					fileProse: source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim(),
					preamble: "",
					sections: [],
				}
			: SOURCE_EXTENSIONS.has(ext)
				? parseFile(source, ext)
				: { fileProse: null, preamble: source.trim(), sections: [] };

	// One blame read per file, reused across every chunk in it (spec §5.2) — computed lazily,
	// only if there's actually a chunk with code to compare, since `git blame` is a subprocess call.
	const hasCode = parsed.sections.some((s) => s.chunks.some((c) => !c.pending));
	const blame = hasCode ? blameFile(root, relPath) : null;

	function chunkNode(
		chunk: FileParse["sections"][number]["chunks"][number],
		path: string,
	): TreeNode {
		const warnings = chunk.pending
			? []
			: checkStaleness(
					blame,
					chunk.startLine,
					chunk.proseEndLine,
					chunk.proseEndLine,
					chunk.endLine,
				);
		return {
			name: chunk.heading ?? chunk.slug,
			kind: "chunk",
			path,
			summary: firstParagraph(chunk.prose),
			pending: chunk.pending,
			prose: chunk.prose,
			code: chunk.code,
			warnings,
			warningCount: warnings.length,
			children: [],
		};
	}

	const children: TreeNode[] = [];
	for (const section of parsed.sections) {
		if (section.heading === null) {
			for (const chunk of section.chunks) {
				children.push(chunkNode(chunk, `${relPath}#${chunk.slug}`));
			}
			continue;
		}
		const sectionChildren = section.chunks.map((chunk) =>
			chunkNode(chunk, `${relPath}#${section.slug}/${chunk.slug}`),
		);
		children.push({
			name: section.heading,
			kind: "section",
			path: `${relPath}#${section.slug}`,
			summary: firstParagraph(section.chunks[0]?.prose ?? ""),
			warningCount: sectionChildren.reduce((sum, c) => sum + c.warningCount, 0),
			children: sectionChildren,
		});
	}

	return {
		name: relPath,
		kind: "file",
		path: relPath,
		summary: parsed.fileProse ? firstParagraph(parsed.fileProse) : "undocumented",
		prose: parsed.fileProse,
		warningCount: sumWarnings(children),
		children,
	};
}

/** Rolls a node's own warning count up from its children — every non-chunk level's count is
 *  purely derived, never computed directly (spec §6.1: badges "roll up to their ancestors"). */
function sumWarnings(children: TreeNode[]): number {
	return children.reduce((sum, child) => sum + child.warningCount, 0);
}

/** @prose
 * # One folder's node
 *
 * Recurses into subfolders and files, skipping `SKIP_DIRS` (tooling/VCS folders no project
 * wants walked) and anything dotfile-named. A folder with no prose and no children (an empty
 * subtree) is dropped rather than shown as a dead end — only folders that actually have
 * something to say make it into the tree.
 */
function folderToNode(root: string, dir: string, name: string): TreeNode {
	const relPath = relative(root, dir);
	const readme = readReadme(dir);
	const children: TreeNode[] = [];

	for (const entry of readdirSync(dir).sort()) {
		if (entry.startsWith(".") || SKIP_DIRS.has(entry) || entry === "README.md") continue;
		const absPath = join(dir, entry);
		const stat = statSync(absPath);
		if (stat.isDirectory()) {
			const sub = folderToNode(root, absPath, entry);
			if (sub.children.length > 0 || sub.prose) children.push(sub);
		} else if (SOURCE_EXTENSIONS.has(extensionOf(entry))) {
			children.push(fileToNode(root, absPath));
		}
	}

	return {
		name,
		kind: "folder",
		path: relPath || ".",
		summary: readme ? firstParagraph(readme) : "undocumented",
		prose: readme,
		warningCount: sumWarnings(children),
		children,
	};
}

/** @prose
 * # Cross-cutting docs at L3
 *
 * `prose/*.md` (except `remarks.md`) are cross-cutting project prose (spec §3.4), surfaced at
 * L3 rather than nested as an ordinary folder — `prose` itself stays in `SKIP_DIRS` so the
 * recursive walk never turns it into a folder node. Reuses `fileToNode` for each one, so a
 * `prose/*.md` document gets exactly the same frontmatter-stripping and summary treatment as any
 * other `.md` file — the only special thing about it is *where* it gets attached in the tree.
 */
function proseDocs(root: string): TreeNode[] {
	const dir = join(root, "prose");
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	return entries
		.filter((entry) => extensionOf(entry) === "md" && !RESERVED_PROSE_FILES.has(entry))
		.sort()
		.map((entry) => fileToNode(root, join(dir, entry)));
}

function collectChunks(node: TreeNode, acc: TreeNode[]): void {
	if (node.kind === "chunk") acc.push(node);
	for (const child of node.children) collectChunks(child, acc);
}

/** @prose
 * # The symbol check's second pass (spec §5.1)
 *
 * Staleness is computed per-file, as each file is walked (`fileToNode`), because it only ever
 * needs that one file's own blame. The symbol check can't work that way — "declared elsewhere in
 * the project" is only knowable once every chunk's code has been seen — so this runs once, after
 * the whole tree exists: first build one project-wide `identifier → declaring chunk` table, then
 * resolve every chunk's prose spans against it.
 *
 * **Known gap**: a file's preamble (the code before its first `@prose` block) isn't a chunk —
 * `fileToNode` parses it but never turns it into a `TreeNode` — so an identifier declared only in
 * the preamble (e.g. a module-level constant above the first prose block) never enters this
 * table, and prose elsewhere that names it reads as unresolved. Real example: `client/main.ts`'s
 * `SHIKI_LANG` is declared in its preamble and gets flagged this way. Fixing it means giving the
 * preamble a place in the tree first (spec §3.2 already calls for showing it, collapsed) — not a
 * one-line change here.
 */
function applySymbolChecks(root: TreeNode): void {
	const chunks: TreeNode[] = [];
	collectChunks(root, chunks);

	const table = new Map<string, string>();
	for (const chunk of chunks) {
		if (!chunk.code) continue;
		for (const id of declaredIdentifiers(chunk.code)) {
			if (!table.has(id)) table.set(id, chunk.path);
		}
	}

	for (const chunk of chunks) {
		if (!chunk.prose) continue;
		const { symbols, warnings } = checkSymbols(chunk.prose, chunk.code ?? "", chunk.path, table);
		if (symbols.length > 0) chunk.symbols = symbols;
		if (warnings.length > 0) {
			chunk.warnings = [...(chunk.warnings ?? []), ...warnings];
			chunk.warningCount += warnings.length;
		}
	}
}

/** Recomputes every ancestor's `warningCount` bottom-up — needed after `applySymbolChecks` adds
 *  warnings to chunks *after* `fileToNode`/`folderToNode` already summed the staleness-only counts. */
function rerollWarnings(node: TreeNode): number {
	if (node.kind === "chunk") return node.warningCount;
	node.warningCount = node.children.reduce((sum, child) => sum + rerollWarnings(child), 0);
	return node.warningCount;
}

/** @prose
 * The project node is just the root folder's node, relabeled — `folderToNode` already does
 * everything a folder needs (README prose, recursive children); the project-specific steps are
 * prepending the cross-cutting `prose/*.md` docs ahead of the folder tree, then running the
 * symbol check's cross-file pass and re-rolling warning counts up from it (§5).
 */
export function buildTree(root: string): TreeNode {
	const projectNode = folderToNode(root, root, "project");
	projectNode.kind = "project";
	projectNode.path = ".";
	projectNode.children = [...proseDocs(root), ...projectNode.children];
	applySymbolChecks(projectNode);
	rerollWarnings(projectNode);
	return projectNode;
}

/** @prose A plain recursive search by stable path — the tree is small enough (a dev tool's own
 *  project, not a monorepo) that an index would be premature; every `node` RPC call just walks
 *  the tree fresh. */
export function findNode(tree: TreeNode, path: string): TreeNode | null {
	if (tree.path === path) return tree;
	for (const child of tree.children) {
		const found = findNode(child, path);
		if (found) return found;
	}
	return null;
}
