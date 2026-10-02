/** @prose
 * # Building the hierarchy
 *
 * Walks a repository into a tree of folders and files, each with a summary: a folder's from
 * its `README.md`, a Markdown file's from its first paragraph, a source file's from its file
 * prose. A source file also carries its text and its prose comments, so a renderer can lay it out as
 * one document.
 *
 * What a page shows is [reading](../docs/reading.md#pages); `docs/` is an ordinary folder here.
 */
import { execFileSync } from "node:child_process";
import {
  closeSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { firstParagraph, parseFile, type ProseComment } from "./parser.js";

export interface TreeNode {
  name: string;
  kind: "project" | "folder" | "file" | "raw" | "binary";
  /** The repo path: `src/store.ts`, or `src/` for a folder. */
  path: string;
  summary: string;
  prose?: string | null;
  /** Raw-only: the text shown, cut short when the file is long. */
  code?: string;
  /** File-only (not `.md`): the whole file's text, so its code shows whether or not it has prose. */
  source?: string;
  /** File-only: every prose comment in the file, the summary first, in source order. A file is
   *  the smallest unit, so `children` is always empty for a file. */
  comments?: ProseComment[];
  /** Raw-only: what's past the shown text, `4,213 more lines`, when the file is cut short. */
  more?: string;
  /** Binary-only: what it is and how big, `PNG image · 12 KB`, and an image as a `data:` URL. */
  about?: string;
  image?: string;
  children: TreeNode[];
}

/** Only used outside a git repository; inside one, `.gitignore` decides (`projectFiles`). */
const SKIP_DIRS = new Set(["node_modules", "dist"]);
/** The languages whose comments can hold `@prose`; `.md` is prose as it is. */
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
  "gitignore",
]);
/** Past this size a file is read as text, not parsed: nobody writes prose into a generated file. */
const SOURCE_MAX_BYTES = 200_000;
// Generated, never written by hand, so never parsed for prose: shown as text, cut short.
const GENERATED_FILENAMES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

/** `ts` for `a.ts`; `gitignore` for `.gitignore`; none for `LICENSE` or other dotfiles. */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name === ".gitignore") return "gitignore";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** @prose
 * # Which files are read for prose
 *
 * Markdown, and source in a language `@prose` lives in, unless it's generated: a
 * lockfile by name, or anything past 200 KB. Every other file git lists still has a page, as text
 * or as a binary file (`rawToNode`).
 */
export function isSource(root: string, relPath: string): boolean {
  const name = relPath.slice(relPath.lastIndexOf("/") + 1);
  if (!SOURCE_EXTENSIONS.has(extensionOf(name)) || GENERATED_FILENAMES.has(name)) return false;
  return extensionOf(name) === "md" || statSync(join(root, relPath)).size <= SOURCE_MAX_BYTES;
}

function readReadme(dir: string): string | null {
  try {
    return withoutMetadata(readFileSync(join(dir, "README.md"), "utf-8"));
  } catch {
    return null;
  }
}

/** A Markdown file's text without its metadata block, which is for tools, not the reader. */
export function withoutMetadata(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

/** @prose
 * # One file's node
 *
 * A `.md` file that isn't a `README.md` is prose as it is, with any metadata block stripped, and
 * needs no marker. Every other source file goes through `parseFile`, and its prose comments hang
 * off the file node in source order, the summary first.
 */
export function fileToNode(root: string, relPath: string): TreeNode {
  const absPath = join(root, relPath);
  const stat = statSync(absPath);
  const cached = parseCache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.node;
  const node = readFileNode(absPath, relPath);
  parseCache.set(absPath, { mtimeMs: stat.mtimeMs, size: stat.size, node });
  return node;
}

/** @prose
 * Parsed files are kept by path, with the modification time and size they were read at, so a
 * folder page doesn't parse every child again on each visit: an edited file has a new time and is
 * read afresh. `fileToNode` checks the cache; the nodes it hands out are never changed.
 */
const parseCache = new Map<string, { mtimeMs: number; size: number; node: TreeNode }>();

function readFileNode(absPath: string, relPath: string): TreeNode {
  const source = readFileSync(absPath, "utf-8");
  if (extensionOf(relPath) === "md") {
    const prose = withoutMetadata(source);
    return {
      name: relPath,
      kind: "file",
      path: relPath,
      summary: firstParagraph(prose),
      prose,
      children: [],
    };
  }

  const comments = parseFile(source, extensionOf(relPath));
  const fileProse = comments[0]?.body ?? null;
  return {
    name: relPath,
    kind: "file",
    path: relPath,
    summary: fileProse ? firstParagraph(fileProse) : "undocumented",
    prose: fileProse,
    source,
    comments,
    children: [],
  };
}

/** @prose
 * # Every other file
 *
 * A file that isn't read for prose is shown as it is. Text, JSON and `LICENSE` and a
 * lockfile alike, is one highlighted run, cut at 1,000 lines or 100 KB, whichever comes first,
 * with how much is left said at the end. A file is binary when its first 8 KB hold a NUL byte, as
 * git decides; its page says what it is and how big, and an image up to 1 MB is shown, inline as
 * a `data:` URL, so a built site needs no copy of the file beside its page.
 */
export function rawToNode(root: string, relPath: string): TreeNode {
  const absPath = join(root, relPath);
  const size = statSync(absPath).size;
  const base = { name: relPath, path: relPath, summary: "", prose: null, children: [] };
  const ext = extensionOf(relPath);
  const image = IMAGE_TYPES[ext];
  if (image && size <= IMAGE_MAX_BYTES) {
    const data = readFileSync(absPath).toString("base64");
    const about = `${image.label} · ${formatSize(size)}`;
    return { ...base, kind: "binary", about, image: `data:${image.type};base64,${data}` };
  }
  if (image || isBinary(absPath)) {
    const about = `${image?.label ?? (ext ? `${ext.toUpperCase()} file` : "Binary file")} · ${formatSize(size)}`;
    return { ...base, kind: "binary", about };
  }
  const { text, more } = cut(readFileSync(absPath, "utf-8"));
  return { ...base, kind: "raw", code: text, ...(more ? { more } : {}) };
}

const TEXT_MAX_LINES = 1000;
const TEXT_MAX_CHARS = 100_000;
const IMAGE_MAX_BYTES = 1_000_000;
const IMAGE_TYPES: Record<string, { type: string; label: string }> = {
  png: { type: "image/png", label: "PNG image" },
  jpg: { type: "image/jpeg", label: "JPEG image" },
  jpeg: { type: "image/jpeg", label: "JPEG image" },
  gif: { type: "image/gif", label: "GIF image" },
  webp: { type: "image/webp", label: "WebP image" },
  avif: { type: "image/avif", label: "AVIF image" },
  ico: { type: "image/x-icon", label: "Icon" },
  svg: { type: "image/svg+xml", label: "SVG image" },
};

function isBinary(absPath: string): boolean {
  const fd = openSync(absPath, "r");
  try {
    const head = Buffer.alloc(8000);
    return head.subarray(0, readSync(fd, head, 0, head.length, 0)).includes(0);
  } finally {
    closeSync(fd);
  }
}

/** The text up to the caps, and what's left: whole lines where it can, else the characters. */
function cut(text: string): { text: string; more?: string } {
  const lines = text.replace(/\n$/, "").split("\n");
  let shown = 0;
  let chars = 0;
  while (shown < lines.length && shown < TEXT_MAX_LINES) {
    if (chars + lines[shown]!.length > TEXT_MAX_CHARS) break;
    chars += lines[shown]!.length + 1;
    shown++;
  }
  if (shown === lines.length) return { text };
  if (shown === 0) {
    return {
      text: lines[0]!.slice(0, TEXT_MAX_CHARS),
      more: `${formatSize(text.length - TEXT_MAX_CHARS)} more`,
    };
  }
  const rest = lines.length - shown;
  return {
    text: lines.slice(0, shown).join("\n"),
    more: `${rest.toLocaleString("en")} more line${rest === 1 ? "" : "s"}`,
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** @prose
 * # Which files the tree holds
 *
 * Every file git would track: `git ls-files` with `--others --exclude-standard`, so an untracked
 * new file shows up before it's committed while ignored output stays out. Dotfiles, `LICENSE`,
 * lockfiles and images included: what the repository holds, not a set of extensions. Outside a
 * git repository, a plain walk stands in, leaving out dot-folders and the fixed `SKIP_DIRS`.
 * Paths are relative to the root, with `/` separators, sorted.
 */
export function projectFiles(root: string): string[] {
  const skip = (name: string) => name.startsWith(".") || SKIP_DIRS.has(name);
  return (gitFiles(root) ?? walkFiles(root, "", skip)).sort();
}

/** @prose
 * What `.gitignore` leaves out of one folder, for the line at the end of its page,
 * at the level it's named: `node_modules/`, never its contents, so nothing ignored is walked.
 * Empty outside a git repository.
 */
export function ignoredIn(root: string, relDir: string): string[] {
  let output: string;
  try {
    output = execFileSync(
      "git",
      ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory"],
      {
        cwd: root,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch {
    return [];
  }
  const prefix = relDir ? `${relDir}/` : "";
  return output
    .split("\0")
    .filter(
      (path) => path && path.startsWith(prefix) && !path.slice(prefix.length, -1).includes("/"),
    )
    .map((path) => path.slice(prefix.length))
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

/** Every file under `relDir`, entries `skip` names left out. A symbolic link is never followed:
 *  `prose build` walks a commit's export, and a tracked link to a file outside it mustn't
 *  publish that file. */
export function walkFiles(
  root: string,
  relDir: string,
  skip: (name: string) => boolean = () => false,
): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(root, relDir))) {
    if (skip(entry)) continue;
    const relPath = relDir ? `${relDir}/${entry}` : entry;
    const stat = lstatSync(join(root, relPath));
    if (stat.isDirectory()) files.push(...walkFiles(root, relPath, skip));
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
    } else if (isSource(root, relPath)) {
      children.push(fileToNode(root, relPath));
    } else {
      children.push(rawToNode(root, relPath));
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

/** @prose
 * # One folder, one level deep
 *
 * What a folder page needs, and no more: its `README.md` as prose, then its
 * subfolders, each summarized by its own `README.md`, and its files, each summarized by its
 * first paragraph. Subfolders aren't walked and other files aren't read, so a page costs the files
 * directly in the folder, whatever the size of the repository. Returns `null` for a folder that
 * holds nothing the walk lists.
 */
export function folderListing(root: string, files: string[], relDir: string): TreeNode | null {
  let index: DirIndex | undefined = indexFiles(files);
  for (const segment of relDir ? relDir.split("/") : []) index = index?.dirs.get(segment);
  if (!index) return null;

  const readme = index.files.includes("README.md")
    ? readReadme(relDir ? join(root, relDir) : root)
    : null;
  const children: TreeNode[] = [];
  for (const name of [...index.dirs.keys()].sort()) {
    const path = relDir ? `${relDir}/${name}` : name;
    const sub = index.dirs.get(name)!;
    const subReadme = sub.files.includes("README.md") ? readReadme(join(root, path)) : null;
    children.push({
      name,
      kind: "folder",
      path,
      summary: subReadme ? firstParagraph(subReadme) : "undocumented",
      prose: subReadme,
      children: [],
    });
  }
  for (const name of [...index.files].sort()) {
    if (name === "README.md") continue;
    const path = relDir ? `${relDir}/${name}` : name;
    children.push(
      isSource(root, path)
        ? fileToNode(root, path)
        : { name: path, kind: "raw", path, summary: "", prose: null, children: [] },
    );
  }
  return {
    name: relDir ? relDir.split("/").at(-1)! : basename(resolve(root)),
    kind: relDir ? "folder" : "project",
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

/** Finds a node by its path. A plain recursive search: the tree is small enough that an index
 *  would be premature. */
export function findNode(tree: TreeNode, path: string): TreeNode | null {
  if (tree.path === path) return tree;
  for (const child of tree.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}
