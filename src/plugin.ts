import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { handleNode, handleTree } from "./server/routes.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = join(packageRoot, "client");

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
}

async function serveShell(server: ViteDevServer, url: string, res: import("node:http").ServerResponse) {
	const template = readFileSync(join(clientDir, "index.html"), "utf-8")
		.replace("%PROSE_MAIN%", `/@fs/${join(clientDir, "main.ts")}`)
		.replace("%PROSE_STYLE%", `/@fs/${join(clientDir, "style.css")}`);
	const html = await server.transformIndexHtml(url, template);
	res.statusCode = 200;
	res.setHeader("content-type", "text/html");
	res.end(html);
}

/** The Prose Vite plugin: a dev-only route at `/__prose/` (spec §6). */
export function prose(): Plugin {
	let root = process.cwd();

	return {
		name: "prose",
		apply: "serve",
		configResolved(config) {
			root = config.root;
		},
		configureServer(server: ViteDevServer) {
			const allow = server.config.server.fs.allow;
			if (allow && !allow.includes(packageRoot)) allow.push(packageRoot);

			server.middlewares.use((req, res, next) => {
				const url = req.url ?? "";
				const pathname = url.split("?")[0];

				if (pathname === "/__prose" || pathname === "/__prose/") {
					serveShell(server, url, res);
					return;
				}
				if (pathname === "/__prose/api/tree") {
					sendJson(res, 200, handleTree(root));
					return;
				}
				if (pathname === "/__prose/api/node") {
					const path = new URL(url, "http://localhost").searchParams.get("path") ?? ".";
					const node = handleNode(root, path);
					if (!node) {
						sendJson(res, 404, { error: `no node at "${path}"` });
						return;
					}
					sendJson(res, 200, node);
					return;
				}
				next();
			});
		},
	};
}
