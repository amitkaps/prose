/** @prose
 * # `prose build`
 *
 * The pages `prose .` serves, written as static files for any static host. The same
 * `renderRoute` in [server.ts](server.ts) writes them, so it isn't a second site. It builds one
 * commit, `HEAD`, as the public repository shows it.
 *
 * `git archive` exports the tracked files of that commit into a temporary folder, and the pages
 * are rendered from there. So no untracked file, no `.env` and no ignored output can reach the
 * site. Uncommitted edits can't either, and the build warns about them. The live parts drop out,
 * and the footer says which commit it is. The same commit always gives the same bytes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { BUILT_ASSETS } from "./assets.js";
import { escapeHtml, warmHighlighter } from "./highlight.js";
import { docsNav } from "./nav.js";
import { projectName, repoUrl } from "./repo.js";
import { notFoundPage, renderRoute, type Site } from "./server.js";
import { walkFiles } from "./tree.js";

export interface BuildOptions {
  /** Where the site goes; `.prose` inside the repository by default. */
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
 * A page keeps its local address ([reading](../docs/reading.md#local-and-published)). A
 * folder's page is `folder/index.html`. A file's page is its path plus `.html`, because a static
 * host answers `/src/store.ts` with `src/store.ts.html`, with no redirect.
 *
 * The one clash is a source file named `index.html`, whose address is its folder's page. So its
 * page is `index.html.html`, and links to it say so (`linkIndexPages`). A folder's `README.md` is
 * a page that redirects to the folder's, as the server's 301 does (`redirectPage`).
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

/** What a static host serves where the server would redirect: a folder's `README.md` goes to the
 *  folder's page, since a host can't answer with a 301 of its own. */
function redirectPage(location: string): string {
  const to = escapeHtml(location);
  return `<!doctype html>\n<meta charset="utf-8">\n<title>Redirecting</title>\n<link rel="canonical" href="${to}">\n<meta http-equiv="refresh" content="0; url=${to}">\n<p><a href="${to}">${to}</a></p>\n`;
}

/** @prose
 * # Caching the shared files
 *
 * The stylesheet and the script are written once, under `assets/` ([assets.ts](assets.ts)).
 * A `_headers` file tells the host to cache them for good, since a new text gets a new name.
 * Cloudflare and Netlify read it and don't serve it. Another host serves it as a small text file,
 * and its pages still work.
 */
const HEADERS = "/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n";

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
 * The build clears its output before writing, so it refuses any folder it didn't make. That's a
 * folder that holds the repository, one with tracked files in it, or a non-empty one without a
 * previous build's marker. It never edits `.gitignore`. It warns when the output would show as
 * untracked files instead, since committing them is rarely what's wanted.
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
  // A path inside it: `.prose/` in `.gitignore` matches a folder, which may not exist yet.
  if (inside && tryGit(root, ["check-ignore", "-q", "--no-index", join(out, MARKER)]) === null) {
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
  // Only a tag on `HEAD` itself: the nearest earlier tag would name a release this isn't.
  const tag = tryGit(root, ["describe", "--tags", "--exact-match", "HEAD"]) ?? undefined;
  const version = tag ? `${tag} · ${commit}` : commit;

  const warnings: string[] = [];
  if (git(root, ["status", "--porcelain", "--", "."])) {
    warnings.push(`uncommitted changes aren't in the build, which is ${commit}`);
  }
  const out = resolve(root, options.out ?? ".prose");
  prepareOut(root, out, warnings);

  void warmHighlighter();
  // `git archive` from a subfolder exports that subfolder, so `prose build tests/fixtures/simple` works.
  const snapshot = mkdtempSync(join(tmpdir(), "prose-build-"));
  try {
    const tar = execFileSync("git", ["archive", "--format=tar", "HEAD"], {
      cwd: root,
      maxBuffer: 1024 * 1024 * 1024,
    });
    execFileSync("tar", ["-x", "-C", snapshot], { input: tar });
    const files = walkFiles(snapshot, "").sort();
    const site: Site = {
      root: snapshot,
      project: projectName(root),
      files,
      live: false,
      snapshot: { commit, tag },
      repo: repoUrl(root),
      nav: docsNav(snapshot, files),
    };
    const paths = ["", ...folders(files), ...files];
    // Written first, so a source file named `404` keeps its page.
    writeFileSync(join(out, "404.html"), notFoundPage(site));
    for (const path of paths) {
      const route = await renderRoute(site, path);
      if (route.status === 404) continue;
      const target = join(out, pageFile(path));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(
        target,
        route.status === 301 ? redirectPage(route.location) : linkIndexPages(route.html),
      );
    }
    for (const asset of BUILT_ASSETS) {
      const target = join(out, asset.url);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, asset.body);
    }
    writeFileSync(join(out, "_headers"), HEADERS);
    writeFileSync(
      join(out, MARKER),
      "Written by prose build; the next build clears this folder.\n",
    );
    return { out, pages: paths.length, version, warnings };
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}
