import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
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

	const children: TreeNode[] = [];
	for (const section of parsed.sections) {
		if (section.heading === null) {
			for (const chunk of section.chunks) {
				children.push({
					name: chunk.heading ?? chunk.slug,
					kind: "chunk",
					path: `${relPath}#${chunk.slug}`,
					summary: firstParagraph(chunk.prose),
					pending: chunk.pending,
					prose: chunk.prose,
					code: chunk.code,
					children: [],
				});
			}
			continue;
		}
		children.push({
			name: section.heading,
			kind: "section",
			path: `${relPath}#${section.slug}`,
			summary: firstParagraph(section.chunks[0]?.prose ?? ""),
			children: section.chunks.map((chunk) => ({
				name: chunk.heading ?? chunk.slug,
				kind: "chunk",
				path: `${relPath}#${section.slug}/${chunk.slug}`,
				summary: firstParagraph(chunk.prose),
				pending: chunk.pending,
				prose: chunk.prose,
				code: chunk.code,
				children: [],
			})),
		});
	}

	return {
		name: relPath,
		kind: "file",
		path: relPath,
		summary: parsed.fileProse ? firstParagraph(parsed.fileProse) : "undocumented",
		prose: parsed.fileProse,
		children,
	};
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

/** @prose
 * The project node is just the root folder's node, relabeled — `folderToNode` already does
 * everything a folder needs (README prose, recursive children); the only project-specific step
 * is prepending the cross-cutting `prose/*.md` docs ahead of the folder tree.
 */
export function buildTree(root: string): TreeNode {
	const projectNode = folderToNode(root, root, "project");
	projectNode.kind = "project";
	projectNode.path = ".";
	projectNode.children = [...proseDocs(root), ...projectNode.children];
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
