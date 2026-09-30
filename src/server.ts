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
import { escapeHtml } from "./highlight.js";
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
		path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname).slice(1);
	} catch {
		return send(res, 400, "Bad request");
	}
	const project = basename(resolve(root));
	const files = projectFiles(root);
	const shell = (body: string, editorLink: string | null = null, hasProseAndCode = false) =>
		page({
			project,
			path,
			rail: renderRail(files, path, project),
			body,
			editorLink,
			hasProseAndCode,
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
			return send(res, 200, shell(body, editorLink));
		}
		const node = fileToNode(root, path);
		const hasProseAndCode = (node.blocks?.length ?? 0) > 0;
		return send(res, 200, shell(await sourceBody(node), editorLink, hasProseAndCode));
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
 * One recursive watcher on the root sends each changed path, repo-relative, to every open page
 * as a server-sent event, and each page decides whether the change is one it shows (`render.ts`).
 * Changes inside dot-folders and `node_modules` are dropped, as the walk drops them. Where the
 * platform has no recursive watch, pages simply don't reload.
 */
function watchRoot(root: string, clients: Set<ServerResponse>): FSWatcher | null {
	try {
		return watch(root, { recursive: true }, (_event, filename) => {
			if (!filename) return;
			const path = filename.toString().split(sep).join("/");
			const segments = path.split("/");
			if (segments.some((s) => s.startsWith(".") || s === "node_modules")) return;
			for (const client of clients) client.write(`data: ${path}\n\n`);
		});
	} catch {
		return null;
	}
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
	const clients = new Set<ServerResponse>();
	const server = createServer((req, res) => {
		if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Read-only");
		if (req.url?.split("?")[0] === EVENTS_PATH) {
			res.writeHead(200, {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			});
			res.write(": connected\n\n");
			clients.add(res);
			req.on("close", () => clients.delete(res));
			return;
		}
		respond(root, req, res).catch((error: unknown) => {
			if (!res.headersSent) send(res, 500, `<pre>${escapeHtml(String(error))}</pre>`);
			else res.end();
		});
	});
	const actualPort = await listen(server, port, host);
	const watcher = options.watch === false ? null : watchRoot(root, clients);
	return {
		url: `http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}/`,
		close: () =>
			new Promise<void>((done) => {
				watcher?.close();
				for (const client of clients) client.end();
				server.close(() => done());
			}),
	};
}
