/** @prose
 * # `prose build`
 *
 * The reader as static files, for any static host: the pages `prose .` serves, written out by
 * the same `renderRoute` (`server.ts`), not a second site. It publishes one commit, `HEAD`, as
 * the public repository shows it: `git archive` exports the committed, tracked files into a
 * temporary folder and the pages are rendered from there, so no untracked scratch file, no
 * `.env` and no ignored output can reach the site, and uncommitted edits don't either (it warns
 * about them). The live parts drop out, and the bar says which commit it is. The same commit
 * always gives the same bytes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { warmHighlighter } from "./highlight.js";
import { renderRoute, type Site } from "./server.js";
import { showable, walkFiles } from "./tree.js";

export interface BuildOptions {
  /** Where the site goes; `.prose/site` inside the repository by default. */
  out?: string;
}

export interface Built {
  out: string;
  pages: number;
  /** `v0.1.0 · 1c77293`: the nearest tag and the commit, or the commit alone before a first tag. */
  version: string;
  warnings: string[];
}

/** Marks a folder as a build's output, so a later build may clear it and nothing else. */
const MARKER = ".prose-build";

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 256 * 1024 * 1024,
  }).trim();
}

function tryGit(root: string, args: string[]): string | null {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

/** @prose
 * # Where a page is written
 *
 * A page keeps its local URL (spec §4). A folder's page is `folder/index.html`, and a file's is
 * its path plus `.html`: GitHub Pages answers `/src/expression.ts` with `src/expression.ts.html`,
 * with no redirect (the spike, `docs/plan.md` 2b). The one clash is a source file named
 * `index.html`, whose URL is its folder's page there; its page is `index.html.html`, and links to
 * it say so (`linkIndexPages`).
 */
function pageFile(path: string): string {
  return path === "" || path.endsWith("/") ? `${path}index.html` : `${path}.html`;
}

/** Points links at a source `index.html` to its page, `index.html.html`. A folder's own page is
 *  always linked as `folder/`, so a link ending in `index.html` is always to a source file. */
function linkIndexPages(html: string): string {
  return html.replace(
    /href="((?:[^"#:]*\/)?index\.html)(#[^"]*)?"/g,
    (_, target: string, hash = "") => `href="${target}.html${hash}"`,
  );
}

/** Every folder that holds a listed file, with its slash: `src/`, `src/lib/`. */
function folders(files: string[]): string[] {
  const out = new Set<string>();
  for (const file of files) {
    const segments = file.split("/").slice(0, -1);
    for (let i = 1; i <= segments.length; i++) out.add(`${segments.slice(0, i).join("/")}/`);
  }
  return [...out].sort();
}

/** @prose
 * # A safe output folder
 *
 * The build clears its output before writing, so it refuses any folder it didn't make: one that
 * holds the repository, one with tracked files in it, or a non-empty one without a previous
 * build's marker. It never edits `.gitignore`; it warns when the output would show up as
 * untracked files, since committing them to the source branch is rarely what's wanted.
 */
function prepareOut(root: string, out: string, warnings: string[]): void {
  const rel = relative(out, root);
  if (rel === "" || !rel.startsWith("..")) {
    throw new Error(`the output folder ${out} holds the repository itself`);
  }
  const inside = !relative(root, out).startsWith("..");
  if (inside && tryGit(root, ["ls-files", "--", out])) {
    throw new Error(`the output folder ${out} holds tracked files`);
  }
  if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, MARKER))) {
    throw new Error(`${out} isn't empty and isn't a previous build; choose another --out`);
  }
  if (inside && tryGit(root, ["check-ignore", "-q", "--no-index", out]) === null) {
    warnings.push(
      `${relative(root, out)} isn't in .gitignore; add ${relative(root, out).split(sep)[0]}/ to keep the site out of the repository`,
    );
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
}

export async function build(dir: string, options: BuildOptions = {}): Promise<Built> {
  const root = resolve(dir);
  if (tryGit(root, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    throw new Error(`${root} isn't a git repository; prose build publishes a commit`);
  }
  const commit = tryGit(root, ["rev-parse", "--short", "HEAD"]);
  if (!commit) throw new Error("there's no commit to build yet");
  const tag = tryGit(root, ["describe", "--tags", "--abbrev=0", "HEAD"]);
  const version = tag ? `${tag} · ${commit}` : commit;

  const warnings: string[] = [];
  if (git(root, ["status", "--porcelain", "--", "."])) {
    warnings.push(`uncommitted changes aren't in the build, which is ${commit}`);
  }
  const out = resolve(root, options.out ?? join(".prose", "site"));
  prepareOut(root, out, warnings);

  void warmHighlighter();
  // `git archive` from a subfolder exports that subfolder, so `prose build examples/single` works.
  const snapshot = mkdtempSync(join(tmpdir(), "prose-build-"));
  try {
    const tar = execFileSync("git", ["archive", "--format=tar", "HEAD"], {
      cwd: root,
      maxBuffer: 1024 * 1024 * 1024,
    });
    execFileSync("tar", ["-x", "-C", snapshot], { input: tar });
    const files = showable(walkFiles(snapshot, ""));
    const site: Site = { root: snapshot, project: basename(root), files, live: false, version };
    const paths = ["", ...folders(files), ...files];
    for (const path of paths) {
      const route = await renderRoute(site, path);
      if (route.status !== 200) continue;
      const target = join(out, pageFile(path));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, linkIndexPages(route.html));
    }
    writeFileSync(
      join(out, MARKER),
      "Written by prose build; the next build clears this folder.\n",
    );
    return { out, pages: paths.length, version, warnings };
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}
