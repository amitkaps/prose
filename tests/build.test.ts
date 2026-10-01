/** @prose
 * # Build tests
 *
 * `prose build`: the static site for `tests/fixtures/simple` and for a git repository, every page rendered the same
 * way the server renders it, and the output folder it will and won't clear.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { build } from "../src/build.js";
import { renderRoute, type Site } from "../src/server.js";
import { projectFiles } from "../src/tree.js";

const temps: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** Every file under `dir`, relative, with `/` separators. */
function listAll(dir: string, rel = ""): string[] {
  return readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((entry) => {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listAll(dir, path) : [path];
  });
}

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    stdio: "ignore",
  });
}

describe("build: tests/fixtures/simple", () => {
  let out: string;
  let pages: string[];
  beforeAll(async () => {
    out = join(temp("prose-build-out-"), "site");
    await build(resolve("tests/fixtures/simple"), { out });
    pages = listAll(out).filter((p) => p.endsWith(".html"));
  });

  it("writes a page per folder and per file, a source index.html as index.html.html", () => {
    expect(pages.sort()).toEqual(
      [
        ".gitignore.html",
        "404.html",
        "index.html",
        "index.html.html",
        "main.js.html",
        "package.json.html",
        "pnpm-lock.yaml.html",
        "README.md.html",
        "style.css.html",
      ].sort(),
    );
  });

  // A folder's README.md is a redirect to its folder's page, not a page of its own.
  const shown = () => pages.filter((page) => page !== "README.md.html");

  it("writes a folder's README.md as a redirect to the folder's page", () => {
    const html = readFileSync(join(out, "README.md.html"), "utf-8");
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=/">');
    expect(html).toContain('<link rel="canonical" href="/">');
  });

  it("puts the rail on every page, and a source page's blocks", () => {
    for (const page of shown())
      expect(readFileSync(join(out, page), "utf-8")).toContain('<nav class="rail"');
    const main = readFileSync(join(out, "main.js.html"), "utf-8");
    expect(main).toContain('id="state"');
    expect(main).toContain('class="code-head"');
  });

  it("writes the host's 404 page with the file tree, since it's served at any missing address", () => {
    const missing = readFileSync(join(out, "404.html"), "utf-8");
    expect(missing).toContain('<nav class="rail"');
    expect(missing).toContain("Nothing at this address");
    expect(missing).toContain('href="/main.js"');
  });

  it("leaves the live parts out and says which commit it is", () => {
    let headTag = "";
    try {
      headTag = execFileSync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {}
    for (const page of shown()) {
      const html = readFileSync(join(out, page), "utf-8");
      expect(html).not.toContain("new EventSource");
      expect(html).not.toContain("data-rendered=");
      expect(html).not.toContain('href="vscode://');
      // The tag is named only when HEAD is exactly that tag (a release run builds a tagged HEAD),
      // so the nearest earlier tag must not stand in for one.
      expect(html).toMatch(
        headTag
          ? new RegExp(`Snapshot · (?:<a [^>]*>)?${headTag.replace(/\./g, "\\.")}(?:</a>)? · `)
          : /Snapshot · (?:<a [^>]*>)?[0-9a-f]{7,}/,
      );
      if (!headTag) expect(html).not.toMatch(/Snapshot · (?:<a [^>]*>)?v\d/);
    }
  });

  it("resolves every link to a page it wrote", () => {
    for (const page of pages) {
      const html = readFileSync(join(out, page), "utf-8");
      // The page's URL: a folder's `index.html` is served at its folder.
      const url = `/${page.endsWith("/index.html") || page === "index.html" ? page.slice(0, -"index.html".length) : page.slice(0, -".html".length)}`;
      for (const [, href] of html.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
        if (href!.includes(":")) continue;
        // A link above the project's root (the example's README points into this repo's docs)
        // has no page on any host; it's a link out of the project, not a missing page.
        if (posix.normalize(posix.join(posix.dirname(`${url}x`).slice(1), href!)).startsWith(".."))
          continue;
        const target =
          decodeURIComponent(posix.resolve(posix.dirname(`${url}x`), href!)) +
          (href!.endsWith("/") ? "/" : "");
        // As Pages does: the file at that path, else that path plus `.html`.
        const file = target.endsWith("/")
          ? `${target}index.html`
          : existsSync(join(out, target))
            ? target
            : `${target}.html`;
        expect(existsSync(join(out, file)), `${page} → ${href}`).toBe(true);
      }
    }
  });
});

describe("build: a repository", () => {
  let root: string;
  beforeAll(() => {
    root = temp("prose-build-repo-");
    const files: Record<string, string> = {
      ".gitignore": ".prose/\n",
      "README.md": "# Demo\n\nSee [a](src/a.ts).\n",
      "src/a.ts": "/** @prose\n * Does a.\n */\nexport const a = 1;\n",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    git(root, "init", "-q");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "first");
  });

  it("publishes the commit: no untracked file, no uncommitted edit, and a warning about them", async () => {
    writeFileSync(join(root, "scratch.ts"), "export const secret = 1;\n");
    writeFileSync(join(root, "src/a.ts"), "/** @prose\n * Edited.\n */\nexport const a = 2;\n");
    try {
      const built = await build(root);
      expect(built.out).toBe(join(root, ".prose", "site"));
      expect(existsSync(join(built.out, "scratch.ts.html"))).toBe(false);
      expect(readFileSync(join(built.out, "src/a.ts.html"), "utf-8")).toContain("Does a.");
      expect(built.warnings.join()).toContain("uncommitted changes");
      expect(built.warnings.join()).not.toContain(".gitignore");
    } finally {
      rmSync(join(root, "scratch.ts"));
      git(root, "checkout", "--", "src/a.ts");
    }
  });

  it("gives the same bytes for the same commit", async () => {
    const one = join(temp("prose-build-a-"), "site");
    const two = join(temp("prose-build-b-"), "site");
    await build(root, { out: one });
    await build(root, { out: two });
    const files = listAll(one).sort();
    expect(listAll(two).sort()).toEqual(files);
    for (const file of files) {
      expect(readFileSync(join(two, file), "utf-8")).toBe(readFileSync(join(one, file), "utf-8"));
    }
  });

  it("refuses an output folder it didn't make, or one holding the repository or tracked files", async () => {
    const other = temp("prose-build-other-");
    writeFileSync(join(other, "keep.txt"), "mine\n");
    await expect(build(root, { out: other })).rejects.toThrow("isn't a previous build");
    expect(existsSync(join(other, "keep.txt"))).toBe(true);
    await expect(build(root, { out: root })).rejects.toThrow("holds the repository");
    await expect(build(root, { out: join(root, "src") })).rejects.toThrow("tracked files");
  });

  it("clears its own previous output, and warns when the output isn't ignored", async () => {
    const built = await build(root, { out: "site" });
    writeFileSync(join(built.out, "stale.html"), "old\n");
    const again = await build(root, { out: "site" });
    expect(existsSync(join(again.out, "stale.html"))).toBe(false);
    expect(again.warnings.join()).toContain("isn't in .gitignore");
    rmSync(again.out, { recursive: true });
  });

  it("renders the same page as the server, less the live parts", async () => {
    const site: Site = { root, project: "demo", files: projectFiles(root), live: true };
    const main = (html: string) =>
      html.slice(html.indexOf("</div>", html.indexOf("<main>")), html.indexOf("</main>"));
    const live = await renderRoute(site, "src/a.ts");
    const built = await renderRoute(
      { ...site, live: false, snapshot: { commit: "abc1234" } },
      "src/a.ts",
    );
    if (live.status !== 200 || built.status !== 200) throw new Error("expected pages");
    expect(main(built.html)).toBe(main(live.html));
    expect(live.html).toContain("new EventSource");
    expect(built.html).not.toContain("new EventSource");
  });

  it("names what's ignored on a local folder page, never on a built one", async () => {
    writeFileSync(join(root, ".env"), "SECRET=1\n");
    writeFileSync(join(root, ".gitignore"), ".prose/\n.env\n");
    try {
      const site: Site = { root, project: "demo", files: projectFiles(root), live: true };
      const live = await renderRoute(site, "");
      const built = await renderRoute({ ...site, live: false }, "");
      if (live.status !== 200 || built.status !== 200) throw new Error("expected pages");
      expect(live.html).toContain('<p class="ignored">Ignored here: <code>.env</code>');
      expect(built.html).not.toContain("Ignored here");
    } finally {
      rmSync(join(root, ".env"));
      git(root, "checkout", "--", ".gitignore");
    }
  });
});
