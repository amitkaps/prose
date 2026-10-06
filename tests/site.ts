/** @prose
 * # This repository's site, in Chrome
 *
 * What the browser checks share. They build the site from `HEAD` with the renderer in `dist/`, and
 * serve it to a page in the Chrome installed on the machine, so nothing is downloaded. The page
 * asks for `http://site/…`, and each request is answered from the built files as a static host
 * would answer it, so no server runs.
 */
// The checks also run code in the page, so they're typed with the DOM.
/// <reference lib="dom" />
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { type Browser, chromium, type Page } from "playwright-core";

/** The built site, a browser, and a way to open a page on it. */
export interface Site {
  /** Every page, as the path a reader would ask for. */
  pages: string[];
  browser: Browser;
  /** A new tab that answers `http://site/…` from the built files. */
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

export async function openSite(): Promise<Site> {
  const dir = mkdtempSync(join(tmpdir(), "prose-site-"));
  execFileSync("node", ["dist/cli.js", "build", ".", "--out", dir], { stdio: "ignore" });
  const browser = await chromium.launch({ channel: "chrome" });
  return {
    pages: pages(dir),
    browser,
    async newPage() {
      const page = await browser.newPage();
      await page.route("http://site/**", (route) => {
        const file = fileFor(dir, new URL(route.request().url()).pathname);
        return file ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
      });
      return page;
    },
    async close() {
      await browser.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Every page in the site. A redirect, like a folder's `README.md` to the folder, isn't a page,
 *  and its target is a page anyway. */
function pages(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "assets" ? [] : pages(path, root);
    if (!name.endsWith(".html") || name === "404.html") return [];
    if (readFileSync(path, "utf8").includes('http-equiv="refresh"')) return [];
    return [
      "/" +
        relative(root, path)
          .replace(/(^|\/)index\.html$/, "$1")
          .replace(/\.html$/, ""),
    ];
  });
}

/** The site's file for a request, as a static host would find it. */
function fileFor(site: string, pathname: string): string | undefined {
  const base = join(site, decodeURIComponent(pathname));
  return [base, `${base}.html`, join(base, "index.html")].find(
    (file) => existsSync(file) && statSync(file).isFile(),
  );
}
