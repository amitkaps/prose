/** @prose
 * # The server
 *
 * A small, read-only HTTP server on a repository ([reading](../docs/reading.md)). It renders
 * each page from the files on disk when it's asked for, so what it shows is always the working
 * tree. It binds to loopback, serves only the files the walk lists, and writes nothing.
 */
import { type FSWatcher, watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve, sep } from "node:path";
import { escapeHtml, warmHighlighter } from "./highlight.js";
import { binaryBody, folderBody, markdownBody, page, rawBody, sourceBody } from "./render.js";
import { docsNav, type NavItem } from "./nav.js";
import { renderRail, railFooter, type Snapshot } from "./rail.js";
import { projectName, repoUrl } from "./repo.js";
import {
  extensionOf,
  fileToNode,
  folderListing,
  ignoredIn,
  isSource,
  projectFiles,
  rawToNode,
} from "./tree.js";

export interface ServeOptions {
  /** The port to try first; the next free one is used if it's taken. `0` lets the OS pick. */
  port?: number;
  host?: string;
  /** Watch the repository and tell open pages to reload. On by default. */
  watch?: boolean;
}

export interface Served {
  url: string;
  close(): Promise<void>;
}

/** The path the page's live reload listens on, in `.prose/`, the folder prose keeps its own
 *  output in (`prose build`), which a repository ignores. */
const EVENTS_PATH = "/.prose/events";
const PORT_ATTEMPTS = 20;

/** @prose
 * # Routing
 *
 * An address is a repo path. `/`, and any path that ends in `/`, is a folder. A folder asked for
 * without its slash redirects to it, so the relative links in its README resolve from inside it.
 * A folder's `README.md` redirects there too, since it's the same page. A path is served only if
 * the walk lists it. Anything else is a 404, including a path outside the root.
 *
 * `renderRoute` is all of routing, with no HTTP in it. The server answers each request with it,
 * and `prose build` calls it once a page ([build.ts](build.ts)). So the static site is these
 * same pages.
 */
export interface Site {
  /** Where the files are read from: the repository, or a build's export of one commit. */
  root: string;
  project: string;
  /** The files the walk lists (`projectFiles`), repo-relative. */
  files: string[];
  /** A local page: live reload, its render time, and **Open in editor**. A built page has none of
   *  them, and says which commit it is in the rail's footer instead. */
  live: boolean;
  snapshot?: Snapshot;
  /** The repository's GitHub address, read from the real repository: a build's `root` is an export with no `.git`. */
  repo?: string;
  /** The docs linked in the bar (`nav.ts`). */
  nav: NavItem[];
}

export type Route = { status: 200 | 404; html: string } | { status: 301; location: string };

/** @prose
 * # The host's 404 page
 *
 * A static host serves `404.html`, at the site's root, for any address the site doesn't have.
 * So a missing page still shows the file tree, not the host's own page. It's served at whatever
 * address was missing, so it can't name that address. Its links are absolute, so they work from
 * any address. GitHub Pages also serves it for everything under `.github/`, which it never
 * publishes.
 */
const footerOf = (site: Site) =>
  railFooter({ live: site.live, snapshot: site.snapshot, repo: site.repo });

export function notFoundPage(site: Site): string {
  return page({
    project: site.project,
    path: "",
    rail: renderRail(site.files, "", site.project, footerOf(site)),
    body: `<p class="missing">Nothing at this address in this repository.</p>`,
    editorLink: null,
    hasCode: false,
    live: site.live,
    nav: site.nav,
  });
}

export async function renderRoute(site: Site, path: string): Promise<Route> {
  const { root, project, files, live } = site;
  const shell = (body: string, editorLink: string | null = null, hasCode = false, readme = false) =>
    page({
      project,
      path,
      rail: renderRail(files, path, project, footerOf(site)),
      body,
      editorLink: live ? editorLink : null,
      hasCode,
      live,
      readme,
      nav: site.nav,
    });
  const notFound = (): Route => ({
    status: 404,
    html: shell(
      `<p class="missing">Nothing at <code>${escapeHtml(path)}</code> in this repository.</p>`,
    ),
  });

  if (path === "" || path.endsWith("/")) {
    const node = folderListing(root, files, path.replace(/\/$/, ""));
    if (!node) return notFound();
    // What's ignored exists only on this machine, so a built page doesn't list it.
    const ignored = live ? ignoredIn(root, path.replace(/\/$/, "")) : [];
    return {
      status: 200,
      html: shell(await folderBody(node, ignored), null, false, Boolean(node.prose)),
    };
  }

  // A folder's README.md is that folder's page, so its own address goes there.
  if (files.includes(path) && path.split("/").at(-1) === "README.md") {
    const folder = path.slice(0, -"README.md".length).split("/").map(encodeURIComponent).join("/");
    return { status: 301, location: `/${folder}` };
  }

  if (files.includes(path)) {
    const editorLink = `vscode://file${resolve(root, path).split(sep).join("/")}`;
    if (extensionOf(path) === "md") {
      return { status: 200, html: shell(await markdownBody(fileToNode(root, path)), editorLink) };
    }
    if (isSource(root, path)) {
      return {
        status: 200,
        html: shell(await sourceBody(fileToNode(root, path)), editorLink, true),
      };
    }
    const node = rawToNode(root, path);
    if (node.kind === "binary") return { status: 200, html: shell(binaryBody(node), editorLink) };
    return { status: 200, html: shell(await rawBody(node), editorLink, true) };
  }

  if (folderListing(root, files, path)) {
    return { status: 301, location: `/${path.split("/").map(encodeURIComponent).join("/")}/` };
  }
  return notFound();
}

async function respond(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let path: string;
  try {
    path = decodeURIComponent((req.url ?? "/").split("?")[0]!.replace(/^\/+/, ""));
  } catch {
    return send(res, 400, "Bad request");
  }
  const files = projectFiles(root);
  const site: Site = {
    root,
    project: projectName(root),
    files,
    live: true,
    repo: repoUrl(root),
    nav: docsNav(root, files),
  };
  const route = await renderRoute(site, path);
  if (route.status === 301) {
    res.writeHead(301, { location: route.location });
    res.end();
    return;
  }
  send(res, route.status, route.html);
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

/** @prose
 * # Live reload
 *
 * One recursive watcher on the root records each changed path, with the time it changed. A page
 * connects with its own path and the time it was rendered. It's told to reload only when a change
 * touches what it shows, which is its own file or anything in the folder it lists.
 *
 * A page connects only while it's visible ([render.ts](render.ts)). A browser allows six
 * connections to one server, so a few idle tabs could otherwise leave a new page waiting. A page
 * that comes back into view reconnects with its render time, and hears at once about anything it
 * missed.
 *
 * Changes inside `.git`, `node_modules` and `.prose/` are dropped, since they aren't pages.
 * Where the platform has no recursive watch, pages don't reload.
 */
interface Listener {
  res: ServerResponse;
  /** The page's repo path: `""`, `src/` or `src/store.ts`. */
  path: string;
}

/** Whether a change to `changed` alters the page at `page`. */
export function touches(changed: string, page: string): boolean {
  return page === "" || changed === page || (page.endsWith("/") && changed.startsWith(page));
}

const CHANGES_KEPT = 2000;

class Changes {
  private log: { path: string; at: number }[] = [];
  readonly listeners = new Set<Listener>();

  record(path: string): void {
    this.log.push({ path, at: Date.now() });
    if (this.log.length > CHANGES_KEPT) this.log.splice(0, this.log.length - CHANGES_KEPT);
    for (const listener of this.listeners) {
      if (touches(path, listener.path)) listener.res.write("data: reload\n\n");
    }
  }

  /** Whether anything the page at `path` shows changed after `since`. */
  missed(path: string, since: number): boolean {
    return this.log.some((change) => change.at > since && touches(change.path, path));
  }
}

function watchRoot(root: string, changes: Changes): FSWatcher | null {
  try {
    return watch(root, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const path = filename.toString().split(sep).join("/");
      const segments = path.split("/");
      if (segments[0] === ".prose" || segments.some((s) => s === ".git" || s === "node_modules")) {
        return;
      }
      changes.record(path);
    });
  } catch {
    return null;
  }
}

function listenForChanges(req: IncomingMessage, res: ServerResponse, changes: Changes): void {
  const query = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
  const listener: Listener = { res, path: query.get("path") ?? "" };
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write(": connected\n\n");
  if (changes.missed(listener.path, Number(query.get("since") ?? 0))) res.write("data: reload\n\n");
  changes.listeners.add(listener);
  req.on("close", () => changes.listeners.delete(listener));
}

/** @prose
 * # A free port
 *
 * The server tries the port it's given, then the next ones, up to 20 in all. So a second
 * `prose .` opens beside the first instead of failing. Port `0` lets the system pick.
 */
function listen(
  server: ReturnType<typeof createServer>,
  port: number,
  host: string,
): Promise<number> {
  return new Promise((resolvePort, reject) => {
    let attempt = 0;
    const tryPort = (p: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE" && p !== 0 && ++attempt < PORT_ATTEMPTS) tryPort(p + 1);
        else reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address();
        resolvePort(typeof address === "object" && address ? address.port : p);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(p, host);
    };
    tryPort(port);
  });
}

export async function serve(root: string, options: ServeOptions = {}): Promise<Served> {
  const { port = 1234, host = "127.0.0.1" } = options;
  const changes = new Changes();
  // Start the highlighter now, so the first source page doesn't wait for it.
  void warmHighlighter();
  const server = createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Read-only");
    if (req.url?.split("?")[0] === EVENTS_PATH) return listenForChanges(req, res, changes);
    respond(root, req, res).catch((error: unknown) => {
      if (!res.headersSent) send(res, 500, `<pre>${escapeHtml(String(error))}</pre>`);
      else res.end();
    });
  });
  const actualPort = await listen(server, port, host);
  const watcher = options.watch === false ? null : watchRoot(root, changes);
  return {
    url: `http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}/`,
    close: () =>
      new Promise<void>((done) => {
        watcher?.close();
        for (const listener of changes.listeners) listener.res.end();
        server.close(() => done());
      }),
  };
}
