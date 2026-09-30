/** @prose
 * # The server
 *
 * A small read-only HTTP server on a repository (spec §4). It renders each page when it's
 * requested, from the files on disk, and caches nothing but the highlighter, so what it shows is
 * always the working tree. It binds to loopback, serves only files the walk lists, and writes
 * nothing.
 */
import { type FSWatcher, watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, resolve, sep } from "node:path";
import { escapeHtml, warmHighlighter } from "./highlight.js";
import { folderBody, markdownBody, page, rawBody, sourceBody } from "./render.js";
import { renderRail } from "./rail.js";
import { fileToNode, folderListing, projectFiles, rawToNode } from "./tree.js";

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

/** The path the page's live reload listens on. A dot segment never names a repository file,
 *  since the walk leaves dot-folders out. */
const EVENTS_PATH = "/.prose/events";
const PORT_ATTEMPTS = 20;

/** @prose
 * # Routing
 *
 * URLs mirror repo paths (spec §4.1). `/` and any path ending in `/` is a folder; a folder asked
 * for without its slash is redirected to it, so relative links in its README resolve from inside
 * it. A path is served only if the walk lists it: anything else, a path outside the root
 * included, is a 404.
 */
async function respond(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
	let path: string;
	try {
		path = decodeURIComponent((req.url ?? "/").split("?")[0]!.replace(/^\/+/, ""));
	} catch {
		return send(res, 400, "Bad request");
	}
	const project = basename(resolve(root));
	const files = projectFiles(root);
	const shell = (body: string, editorLink: string | null = null, hasCode = false) =>
		page({
			project,
			path,
			rail: renderRail(files, path, project),
			body,
			editorLink,
			hasCode,
		});
	const notFound = () =>
		send(
			res,
			404,
			shell(
				`<p class="missing">Nothing at <code>${escapeHtml(path)}</code> in this repository.</p>`,
			),
		);

	if (path === "" || path.endsWith("/")) {
		const node = folderListing(root, files, path.replace(/\/$/, ""));
		if (!node) return notFound();
		return send(res, 200, shell(await folderBody(node)));
	}

	if (files.includes(path)) {
		const editorLink = `vscode://file${resolve(root, path).split(sep).join("/")}`;
		const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
		if (ext === "md") {
			return send(res, 200, shell(await markdownBody(fileToNode(root, path)), editorLink));
		}
		if (ext === "json" || ext === "jsonc") {
			const node = rawToNode(root, path);
			const body = node ? await rawBody(node) : `<p class="missing">Too large to show.</p>`;
			return send(res, 200, shell(body, editorLink, node !== null));
		}
		return send(res, 200, shell(await sourceBody(fileToNode(root, path)), editorLink, true));
	}

	if (folderListing(root, files, path)) {
		res.writeHead(301, { location: `/${path.split("/").map(encodeURIComponent).join("/")}/` });
		res.end();
		return;
	}
	return notFound();
}

function send(res: ServerResponse, status: number, body: string): void {
	res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
	res.end(body);
}

/** @prose
 * # Live reload
 *
 * One recursive watcher on the root records each changed path, repo-relative, with the time it
 * changed. A page connects with its own path and the time it was rendered, and is told to reload
 * only when a change touches what it shows: its own file, or anything inside the folder it lists.
 * A page connects only while it's visible (`render.ts`), since a browser allows six connections to
 * one server and each open page would otherwise hold one, so a few idle tabs could leave a new
 * page waiting to load. A page that comes back into view reconnects with its render time, and
 * hears at once about anything it missed. Changes inside dot-folders and `node_modules` are
 * dropped, as the walk drops them. Where the platform has no recursive watch, pages don't reload.
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
			if (path.split("/").some((s) => s.startsWith(".") || s === "node_modules")) return;
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
