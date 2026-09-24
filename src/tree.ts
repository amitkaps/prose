import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { type FileParse, firstParagraph, parseFile } from "./parser.js";

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

/**
 * `prose/*.md` (except `remarks.md`) are cross-cutting project prose (spec §3.4), surfaced at
 * L3 rather than nested as an ordinary folder — `prose` itself stays in `SKIP_DIRS` so the
 * recursive walk never turns it into a folder node.
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

/** Builds the L3→L0 hierarchy (spec §4) for the project rooted at `root`. */
export function buildTree(root: string): TreeNode {
	const projectNode = folderToNode(root, root, "project");
	projectNode.kind = "project";
	projectNode.path = ".";
	projectNode.children = [...proseDocs(root), ...projectNode.children];
	return projectNode;
}

/** Finds the node at `path` within `tree`, as produced by {@link buildTree}. */
export function findNode(tree: TreeNode, path: string): TreeNode | null {
	if (tree.path === path) return tree;
	for (const child of tree.children) {
		const found = findNode(child, path);
		if (found) return found;
	}
	return null;
}
