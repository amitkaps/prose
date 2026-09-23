import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DevTools } from "@vitejs/devtools";
import { createPluginFromDevframe } from "@vitejs/devtools-kit/node";
import { defineDevframe, defineRpcFunction } from "devframe";
import type { Plugin } from "vite";
import { handleNode, handleTree } from "./server/routes.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The Prose Vite plugin: a dev-only route at `/__prose/`, built on Devframe (spec §6). */
export async function prose(): Promise<Plugin[]> {
	const devtools = await DevTools();

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
					name: "tree",
					type: "query",
					jsonSerializable: true,
					handler: () => handleTree(ctx.workspaceRoot),
				}),
			);
			ctx.rpc.register(
				defineRpcFunction({
					name: "node",
					type: "query",
					jsonSerializable: true,
					handler: (path: string) => handleNode(ctx.workspaceRoot, path),
				}),
			);
		},
	});

	return [...devtools, createPluginFromDevframe(devframeDefinition)];
}
