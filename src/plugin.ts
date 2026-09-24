import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devframeViteBridge, devframeVitePlugin } from "@devframes/vite/single";
import { defineDevframe, defineRpcFunction } from "devframe";
import type { Plugin } from "vite";
import { handleNode, handleTree } from "./server/routes.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The Prose Vite plugin: a dev-only route at `/__prose/`, built on Devframe (spec §6).
 *
 * `devframeVitePlugin` serves the built client SPA at `/__prose/`; `devframeViteBridge` mounts
 * the RPC/WebSocket backend the SPA connects to, on the same origin. Both are plain Vite
 * plugins with no dependency on `@vitejs/devtools` — see spec.md §6 for why: this tool targets
 * one developer on one machine, not the DevTools hub's dock/terminal/command surface.
 */
export function prose(): Plugin[] {
	const devframeDefinition = defineDevframe({
		id: "prose",
		name: "Prose",
		version: "0.0.1",
		packageName: "@amitkaps/prose",
		importMetaUrl: import.meta.url,
		homepage: "https://prose.amitkaps.com",
		description: "Hierarchical prose + code, read from @prose comments.",
		icon: "ph:book-open-text-duotone",
		clientAssets: join(packageRoot, "client", "dist"),
		setup(ctx) {
			ctx.rpc.register(
				defineRpcFunction({
					name: "prose:tree",
					type: "query",
					jsonSerializable: true,
					handler: () => handleTree(ctx.workspaceRoot),
				}),
			);
			ctx.rpc.register(
				defineRpcFunction({
					name: "prose:node",
					type: "query",
					jsonSerializable: true,
					handler: (path: string) => handleNode(ctx.workspaceRoot, path),
				}),
			);
		},
	});

	return [
		devframeVitePlugin(devframeDefinition),
		// The bridge's RPC endpoint gates behind an OTP by default; this tool is local and
		// single-developer (spec §2), so the dev server's own loopback binding is the trust
		// boundary already — no second gate on top of it.
		devframeViteBridge(devframeDefinition, { auth: false }),
	];
}
