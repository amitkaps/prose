/** @prose
 * # Building the hierarchy
 *
 * Walks a repository into a tree of folders and files (spec §4), each with its summary: a
 * folder's from its `README.md`, a Markdown file's from its first paragraph, a source file's
 * from its file prose. A source file also carries its text and its blocks, so a renderer can lay
 * it out as one document. `prose/` is an ordinary folder here (spec §3.4).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { type CodeLang, firstParagraph, parseFile, type ProseChunk } from "./parser.js";

export interface TreeNode {
	name: string;
	kind: "project" | "folder" | "file" | "raw" | "chunk";
	/** The repo path, with `#anchor` for a chunk: `src/store.ts#addTodo`. */
	path: string;
	summary: string;
	pending?: boolean;
	prose?: string | null;
	code?: string;
	/** File-only (not `.md`): the whole file's text, so its code shows whether or not it has prose. */
	source?: string;
	/** File-only: every prose block in the file, the file prose first, in source order. A file is
	 *  the smallest unit (spec §3.2), so `children` is always empty for a file. */
	blocks?: TreeNode[];
	/** Chunk-only: the byte range `[start, end)` of this block's comment in the file's `source`,
	 *  so a renderer can put the prose where the comment was and show the code around it. */
	span?: [number, number];
	/** Chunk-only: the 1-based line the comment starts on. */
	line?: number;
	/** Chunk-only: the language of this chunk's code. */
	codeLang?: CodeLang;
	children: TreeNode[];
}

/** Only used outside a git repository; inside one, `.gitignore` decides (`projectFiles`). */
const SKIP_DIRS = new Set(["node_modules", "dist"]);
const SOURCE_EXTENSIONS = new Set([
	"js",
	"ts",
	"css",
	"html",
	"svelte",
	"md",
	"yaml",
	"yml",
	"toml",
]);
// JSON has no comment for `@prose` to live in, but its structure (dependencies, scripts,
// compiler options) is worth reading, so it's shown as `raw` text.
const RAW_EXTENSIONS = new Set(["json", "jsonc"]);
const RAW_MAX_BYTES = 200_000;
// Generated, never written by hand: excluded by name, since `.yaml` and `.json` are otherwise shown.
const RESERVED_FILENAMES = new Set([
	"pnpm-lock.yaml",
	"package-lock.json",
	"yarn.lock",
	"bun.lock",
	"bun.lockb",
]);

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
 * A `.md` file that isn't a `README.md` is prose as it is, with any frontmatter stripped: no
 * marker, no chunks. Every other source file goes through `parseFile`, and its blocks hang off
 * the file node in source order, the file prose first.
 */
function fileToNode(root: string, relPath: string): TreeNode {
	const source = readFileSync(join(root, relPath), "utf-8");
	if (extensionOf(relPath) === "md") {
		const prose = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
		return {
			name: relPath,
			kind: "file",
			path: relPath,
			summary: firstParagraph(prose),
			prose,
			children: [],
		};
	}

	const parsed = parseFile(source, extensionOf(relPath));
	const chunkNode = (chunk: ProseChunk): TreeNode => ({
		name: chunk.heading ?? chunk.anchor,
		kind: "chunk",
		path: `${relPath}#${chunk.anchor}`,
		summary: firstParagraph(chunk.prose),
		pending: chunk.pending,
		prose: chunk.prose,
		code: chunk.code,
		codeLang: chunk.codeLang,
		line: chunk.startLine,
		span: [chunk.startIndex, chunk.endIndex],
		children: [],
	});
	const blocks: TreeNode[] = [];
	if (parsed.fileBlock) blocks.push(chunkNode(parsed.fileBlock));
	for (const section of parsed.sections) {
		for (const chunk of section.chunks) blocks.push(chunkNode(chunk));
	}

	return {
		name: relPath,
		kind: "file",
		path: relPath,
		summary: parsed.fileProse ? firstParagraph(parsed.fileProse) : "undocumented",
		prose: parsed.fileProse,
		source,
		blocks,
		children: [],
	};
}

/** A file that can't carry prose (JSON has no comments): its text, shown as it is, and counted
 *  as neither documented nor undocumented. Oversized files are skipped. */
function rawToNode(root: string, relPath: string): TreeNode | null {
	const absPath = join(root, relPath);
	if (statSync(absPath).size > RAW_MAX_BYTES) return null;
	return {
		name: relPath,
		kind: "raw",
		path: relPath,
		summary: "",
		prose: null,
		code: readFileSync(absPath, "utf-8"),
		children: [],
	};
}

/** @prose
 * # Which files the tree holds (spec §4.2)
 *
 * The files git would track: `git ls-files` with `--others --exclude-standard`, so an untracked
 * new file shows up before it's committed while ignored output stays out. Outside a git
 * repository, a plain walk with the fixed `SKIP_DIRS` list stands in. Either way, dot-folders
 * and dotfiles, lockfiles and extensions the tree can't show are dropped. Paths are relative to
 * the root, with `/` separators.
 */
export function projectFiles(root: string): string[] {
	const listed = gitFiles(root) ?? walkFiles(root, "");
	return listed
		.filter((path) => {
			const segments = path.split("/");
			const name = segments.at(-1)!;
			if (segments.some((segment) => segment.startsWith("."))) return false;
			if (RESERVED_FILENAMES.has(name)) return false;
			const ext = extensionOf(name);
			return SOURCE_EXTENSIONS.has(ext) || RAW_EXTENSIONS.has(ext);
		})
		.sort();
}

/** Tracked files plus untracked ones not ignored, or `null` outside a git repository. A file
 *  deleted from the working tree but still in the index is dropped, as is a submodule's entry
 *  (a directory, not a file). */
function gitFiles(root: string): string[] | null {
	let output: string;
	try {
		output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch {
		return null;
	}
	const files = [...new Set(output.split("\0").filter(Boolean))];
	return files.filter((path) => {
		try {
			return statSync(join(root, path)).isFile();
		} catch {
			return false;
		}
	});
}

function walkFiles(root: string, relDir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(join(root, relDir))) {
		if (entry.startsWith(".") || SKIP_DIRS.has(entry)) continue;
		const relPath = relDir ? `${relDir}/${entry}` : entry;
		const stat = statSync(join(root, relPath));
		if (stat.isDirectory()) files.push(...walkFiles(root, relPath));
		else if (stat.isFile()) files.push(relPath);
	}
	return files;
}

interface DirIndex {
	files: string[];
	dirs: Map<string, DirIndex>;
}

function indexFiles(paths: string[]): DirIndex {
	const top: DirIndex = { files: [], dirs: new Map() };
	for (const path of paths) {
		const segments = path.split("/");
		let dir = top;
		for (const segment of segments.slice(0, -1)) {
			let next = dir.dirs.get(segment);
			if (!next) {
				next = { files: [], dirs: new Map() };
				dir.dirs.set(segment, next);
			}
			dir = next;
		}
		dir.files.push(segments.at(-1)!);
	}
	return top;
}

/** @prose
 * # One folder's node
 *
 * Built from `projectFiles`' list rather than from the disk. A folder's `README.md` is its
 * prose, not a child. A folder with no prose and no children is dropped rather than shown as a
 * dead end.
 */
function folderToNode(root: string, relDir: string, name: string, index: DirIndex): TreeNode {
	const readme = index.files.includes("README.md")
		? readReadme(relDir ? join(root, relDir) : root)
		: null;
	const children: TreeNode[] = [];
	const entries = [...index.dirs.keys(), ...index.files].sort();

	for (const entry of entries) {
		const relPath = relDir ? `${relDir}/${entry}` : entry;
		const sub = index.dirs.get(entry);
		if (sub) {
			const node = folderToNode(root, relPath, entry, sub);
			if (node.children.length > 0 || node.prose) children.push(node);
		} else if (entry === "README.md") {
			continue;
		} else if (SOURCE_EXTENSIONS.has(extensionOf(entry))) {
			children.push(fileToNode(root, relPath));
		} else {
			const raw = rawToNode(root, relPath);
			if (raw) children.push(raw);
		}
	}

	return {
		name,
		kind: "folder",
		path: relDir || ".",
		summary: readme ? firstParagraph(readme) : "undocumented",
		prose: readme,
		children,
	};
}

/** The project is the root folder's node, relabeled. */
export function buildTree(root: string): TreeNode {
	const projectNode = folderToNode(
		root,
		"",
		basename(resolve(root)),
		indexFiles(projectFiles(root)),
	);
	projectNode.kind = "project";
	return projectNode;
}

/** Finds a node by its path, a block included (`src/store.ts#addTodo`). A plain recursive search:
 *  the tree is small enough (spec §2) that an index would be premature. */
export function findNode(tree: TreeNode, path: string): TreeNode | null {
	if (tree.path === path) return tree;
	for (const block of tree.blocks ?? []) if (block.path === path) return block;
	for (const child of tree.children) {
		const found = findNode(child, path);
		if (found) return found;
	}
	return null;
}
