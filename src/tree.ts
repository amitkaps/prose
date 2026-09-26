import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
	checkStaleness,
	checkSymbols,
	declaredIdentifiers,
	type Symbol,
	type Warning,
} from "./checks.js";
import { blameFile } from "./git.js";
import {
	blockHash,
	chunkAnchor,
	FILE_ANCHOR,
	type FileParse,
	firstParagraph,
	parseFile,
	type ProseChunk,
} from "./parser.js";

/** @prose
 * # Building the hierarchy
 *
 * Walks a project root into the L3→L1 tree (spec §4): project → folders → files, each file
 * carrying its blocks. Each level's prose and structure come from a different place — a folder's `README.md`,
 * a file's first `@prose` block, a chunk's own block — so this module is mostly about combining
 * `parser.ts`'s per-file output with the filesystem's own folder structure into one shape the
 * client can render generically at any level.
 */
export interface TreeNode {
	name: string;
	kind: "project" | "folder" | "file" | "raw" | "chunk";
	path: string;
	summary: string;
	pending?: boolean;
	prose?: string | null;
	code?: string;
	/** File-only: the code before its first `@prose` block (spec §3.2). Not shown by the client
	 *  yet (§6.1's "flagged, shown collapsed" is still open) — kept here so the symbol check
	 *  (§5.1) can resolve a chunk's prose against names this file imports/declares up top, e.g.
	 *  an `import { marked } from "marked"` that no individual chunk's own code repeats. */
	preamble?: string;
	/** File-only (not `.md`): the whole file's text, so the view can always show the code, whether or
	 *  not the file has any `@prose` (spec §6.1). */
	source?: string;
	/** File-only: every prose block in the file, the file prose first, in source order. A file is
	 *  the smallest unit the view navigates to (spec §3.2), so its blocks are laid out in place on
	 *  its page instead of being tree children — `children` is always empty for a file. */
	blocks?: TreeNode[];
	/** Chunk-only: the byte range `[start, end)` of this block's comment in the file's `source`, so
	 *  the view can put the rendered prose where the comment was and show the code around it. */
	span?: [number, number];
	/** Chunk-only: a hash of this block's prose and note (`blockHash` in `parser.ts`). The client
	 *  sends it back with a write, and the server refuses the write if the block on disk no longer
	 *  matches (spec §6.3). */
	hash?: string;
	/** Project-only: false when the dev server listens on a non-loopback address, so the view is
	 *  read-only (spec §6, "Trust boundary"). Set by `plugin.ts`, not by the walk. */
	writable?: boolean;
	/** Chunk-only: an `@note` left directly on this chunk — a direction or question for whoever
	 *  touches it next, not part of its prose (`src/notes.ts` writes/removes these). */
	note?: string;
	/** Chunk-only: which language this chunk's own code is in — gates whether the symbol check
	 *  (§5.1) attempts a JS/TS parse of it at all (`src/checks.ts`'s `declaredIdentifiers`). */
	codeLang?: "js" | "css" | "html" | "yaml" | "toml";
	/** Chunk-only: inline code spans from this chunk's own prose, resolved per spec §5.1. */
	symbols?: Symbol[];
	/** File-only: the `@note`s above lines of code, in source order (spec §6.2). Each is laid out in
	 *  place by its `span`; `path` is `file:line`, its address for a resolve. */
	lineNotes?: LineNoteNode[];
	/** This node's own warnings (chunks, and a file's misplaced blocks — §5 doesn't define file/folder-level checks). */
	warnings?: Warning[];
	/** Own warnings plus every descendant's, so a badge can show at any level without the client
	 *  walking the subtree itself (spec §6.1: "roll up to their ancestors"). */
	warningCount: number;
	children: TreeNode[];
}

/** A line note as the client sees it. */
export interface LineNoteNode {
	/** `src/store.ts:42`: the file and the line the note starts on. */
	path: string;
	text: string;
	/** `noteHash` of the text: sent back with a resolve. */
	hash: string;
	span: [number, number];
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
// Structure a human orienting in `/__prose/` wants to see (dependencies, scripts, compiler
// options), but JSON has no comment syntax for `@prose` to attach to — shown as `raw` nodes.
const RAW_EXTENSIONS = new Set(["json", "jsonc"]);
const RAW_MAX_BYTES = 200_000;
// Generated, never authored — a package manager's own record, not something a project "writes
// prose about." Excluded by filename rather than left to fall out of the extension allowlist,
// since `.yaml`/`.toml` are otherwise fair game (spec §2's "In" list doesn't name these, but the
// same "prose lives with the code" argument applies to config as much as to source).
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
 * A `.md` file that isn't a `README.md` skips `parser.ts` entirely — the whole file (frontmatter
 * stripped) is its prose, no chunking, since spec §3.1 treats a plain Markdown file as already
 * being prose. Every other recognized extension goes through `parseFile`, whose sections/chunks
 * become this file's children: an unheaded section's chunks attach directly, a headed section
 * becomes its own `section` node wrapping its chunks.
 */
function fileToNode(root: string, relPath: string): TreeNode {
	const source = readFileSync(join(root, relPath), "utf-8");
	const ext = extensionOf(relPath);
	// A plain .md file is prose by convention (spec §3.1) — no @prose marker or chunking needed.
	// YAML frontmatter, if present, is metadata rather than prose, so it's stripped here too.
	const parsed: FileParse =
		ext === "md"
			? {
					fileProse: source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim(),
					fileBlock: null,
					preamble: "",
					sections: [],
					lineNotes: [],
					misplaced: [],
				}
			: SOURCE_EXTENSIONS.has(ext)
				? parseFile(source, ext)
				: {
						fileProse: null,
						fileBlock: null,
						preamble: source.trim(),
						sections: [],
						lineNotes: [],
						misplaced: [],
					};

	// One blame read per file, reused across every chunk in it (spec §5.2) — computed lazily,
	// only if there's actually a chunk with code to compare, since `git blame` is a subprocess call.
	const hasCode =
		Boolean(parsed.fileBlock?.code) ||
		parsed.sections.some((s) => s.chunks.some((c) => !c.pending));
	const blame = hasCode ? blameFile(root, relPath) : null;

	function chunkNode(chunk: ProseChunk, anchor: string): TreeNode {
		// The file block's "code" is only the preamble (imports), which its prose doesn't describe,
		// so comparing their ages would only produce noise: no staleness check for it.
		const warnings =
			chunk.pending || !chunk.code || anchor === FILE_ANCHOR
				? []
				: checkStaleness(
						blame,
						chunk.startLine,
						chunk.proseEndLine,
						chunk.proseEndLine,
						chunk.endLine,
					);
		return {
			name: chunk.heading ?? chunk.anchor,
			kind: "chunk",
			path: `${relPath}#${anchor}`,
			summary: firstParagraph(chunk.prose),
			hash: blockHash(chunk),
			pending: chunk.pending,
			prose: chunk.prose,
			code: chunk.code,
			note: chunk.note,
			codeLang: chunk.codeLang,
			span: [chunk.startIndex, chunk.endIndex],
			warnings,
			warningCount: warnings.length,
			children: [],
		};
	}

	const blocks: TreeNode[] = [];
	if (parsed.fileBlock) blocks.push(chunkNode(parsed.fileBlock, FILE_ANCHOR));
	for (const section of parsed.sections) {
		for (const chunk of section.chunks) blocks.push(chunkNode(chunk, chunkAnchor(chunk)));
	}

	const misplaced: Warning[] = parsed.misplaced.map((line) => ({
		kind: "misplaced-block",
		message: `Line ${line}: a \`@prose\` block inside a function, class or rule is ignored. Move it to the top level.`,
	}));

	return {
		name: relPath,
		kind: "file",
		path: relPath,
		summary: parsed.fileProse ? firstParagraph(parsed.fileProse) : "undocumented",
		prose: parsed.fileProse,
		preamble: parsed.preamble,
		source: ext === "md" ? undefined : source,
		blocks: ext === "md" ? undefined : blocks,
		lineNotes: parsed.lineNotes.map((n) => ({
			path: `${relPath}:${n.startLine}`,
			text: n.text,
			hash: n.hash,
			span: [n.startIndex, n.endIndex],
		})),
		warnings: misplaced,
		warningCount: sumWarnings(blocks) + misplaced.length,
		children: [],
	};
}

/** @prose
 * # Raw files
 *
 * A `raw` node is a file that can't carry prose (JSON has no comments): its text is shown
 * highlighted, with no chunks, symbols or warnings, and it counts as neither documented nor
 * undocumented. Oversized files are skipped, since the whole tree is pushed to the client.
 */
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
		warningCount: 0,
		children: [],
	};
}

/** Rolls a node's own warning count up from its children — every non-chunk level's count is
 *  purely derived, never computed directly (spec §6.1: badges "roll up to their ancestors"). */
function sumWarnings(children: TreeNode[]): number {
	return children.reduce((sum, child) => sum + child.warningCount, 0);
}

/** @prose
 * # Which files the tree holds (spec §3.4)
 *
 * The files git would track: `git ls-files` with `--others --exclude-standard`, so an untracked
 * new file shows up before it's committed while `coverage/`, `.wrangler/` and other ignored
 * output stay out. Outside a git repository, a plain walk with the fixed `SKIP_DIRS` list stands
 * in. Either way, dot-folders and dotfiles, lockfiles and extensions the view can't show are
 * dropped here, so this one list is what the tree is built from and what a note write is checked
 * against (`src/notes.ts`): a write can only name a file the view could have shown.
 *
 * Paths are relative to the root, with `/` separators. The root `prose/` folder is included;
 * `buildTree` pulls its Markdown out to L3 rather than showing it as a folder.
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
 * Built from `projectFiles`' list rather than from the disk, so the tree and the write check
 * agree on what exists. A folder's `README.md` is its prose, not a child. A folder with no prose
 * and no children (an empty subtree) is dropped rather than shown as a dead end — only folders
 * that actually have something to say make it into the tree.
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
		warningCount: sumWarnings(children),
		children,
	};
}

/** @prose
 * # Cross-cutting docs at L3
 *
 * Every Markdown file directly in the root `prose/` is cross-cutting project prose (spec §3.4),
 * surfaced at L3 rather than nested as an ordinary folder. Only the root one is special: a
 * `src/prose/` folder is walked like any other. Reuses `fileToNode` for each one, so a
 * `prose/*.md` document gets exactly the same frontmatter-stripping and summary treatment as any
 * other `.md` file — the only special thing about it is *where* it gets attached in the tree.
 */
function proseDocs(root: string, index: DirIndex): TreeNode[] {
	const dir = index.dirs.get("prose");
	if (!dir) return [];
	return dir.files
		.filter((entry) => extensionOf(entry) === "md")
		.sort()
		.map((entry) => fileToNode(root, `prose/${entry}`));
}

interface ChunkRef {
	chunk: TreeNode;
	/** Identifiers declared in the containing file's preamble — its imports and any module-level
	 *  code above the first `@prose` block. Every chunk in that file shares this scope, even
	 *  though it's not repeated in any one chunk's own code. */
	fileScope: ReadonlySet<string>;
}

/** Gathers every block in the tree with its file's preamble scope — re-derived once per `file`
 *  node, since a block's own file never changes. Blocks live on file nodes (`blocks`), not in
 *  `children`. */
function collectChunks(node: TreeNode, acc: ChunkRef[]): void {
	if (node.kind === "file") {
		const blocks = node.blocks ?? [];
		const fileScope = declaredIdentifiers(node.preamble ?? "");
		// The file prose describes the whole file, so it resolves against everything the file declares.
		const wholeFile = new Set(fileScope);
		for (const b of blocks) {
			for (const id of declaredIdentifiers(b.code ?? "", b.codeLang)) wholeFile.add(id);
		}
		for (const chunk of blocks) {
			acc.push({
				chunk,
				fileScope: chunk.path.endsWith(`#${FILE_ANCHOR}`) ? wholeFile : fileScope,
			});
		}
		return;
	}
	for (const child of node.children) collectChunks(child, acc);
}

/** @prose
 * # The symbol check's second pass (spec §5.1)
 *
 * Staleness is computed per-file, as each file is walked (`fileToNode`), because it only ever
 * needs that one file's own blame. The symbol check can't work that way — "declared elsewhere in
 * the project" is only knowable once every chunk's code has been seen — so this runs once, after
 * the whole tree exists: first build one project-wide `identifier → declaring chunk` table, then
 * resolve every chunk's prose spans against it, plus each chunk's own file-scope preamble names
 * (found by dogfooding: `amitkaps/base`'s `docs.ts` names its own `import { marked } from
 * "marked"` in prose, and a preamble-only import wasn't visible to any chunk until this scope was
 * threaded through — see `checkSymbols`'s `fileScope` parameter).
 */
/** @prose
 * `package.json`'s own declared dependency names — read once per `buildTree` call, the same way
 * `git blame` is read once per file, not once per chunk. Missing or unparseable `package.json` is
 * just "no known packages," not an error (a project without one, or with a malformed one, still
 * gets a working symbol check — it just won't recognize library names as such).
 */
function readPackageNames(root: string): Set<string> {
	try {
		const raw = readFileSync(join(root, "package.json"), "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const names = new Set<string>();
		for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
			const deps = pkg[field];
			if (deps && typeof deps === "object") {
				for (const name of Object.keys(deps)) names.add(name);
			}
		}
		return names;
	} catch {
		return new Set();
	}
}

function applySymbolChecks(root: TreeNode, knownPackages: ReadonlySet<string>): void {
	const chunkRefs: ChunkRef[] = [];
	collectChunks(root, chunkRefs);

	const table = new Map<string, string>();
	for (const { chunk } of chunkRefs) {
		// The file block's "code" is the preamble: imports it holds are file scope, not declarations
		// another file's prose should link to.
		if (!chunk.code || chunk.path.endsWith(`#${FILE_ANCHOR}`)) continue;
		for (const id of declaredIdentifiers(chunk.code, chunk.codeLang)) {
			if (!table.has(id)) table.set(id, chunk.path);
		}
	}

	for (const { chunk, fileScope } of chunkRefs) {
		if (!chunk.prose) continue;
		const { symbols, warnings } = checkSymbols(
			chunk.prose,
			chunk.code ?? "",
			chunk.path,
			table,
			fileScope,
			knownPackages,
			chunk.codeLang,
		);
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
	if (node.kind === "file") {
		node.warningCount = sumWarnings(node.blocks ?? []) + (node.warnings?.length ?? 0);
		return node.warningCount;
	}
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
	const index = indexFiles(projectFiles(root));
	const docs = proseDocs(root, index);
	index.dirs.delete("prose");
	const projectNode = folderToNode(root, "", basename(resolve(root)), index);
	projectNode.kind = "project";
	projectNode.children = [...docs, ...projectNode.children];
	applySymbolChecks(projectNode, readPackageNames(root));
	rerollWarnings(projectNode);
	return projectNode;
}

/** @prose A plain recursive search by stable path — the tree is small enough (a dev tool's own
 *  project, not a monorepo) that an index would be premature; every `node` RPC call just walks
 *  the tree fresh. */
export function findNode(tree: TreeNode, path: string): TreeNode | null {
	if (tree.path === path) return tree;
	for (const block of tree.blocks ?? []) if (block.path === path) return block;
	for (const child of tree.children) {
		const found = findNode(child, path);
		if (found) return found;
	}
	return null;
}
