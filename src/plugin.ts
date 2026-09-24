import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devframeViteBridge, devframeVitePlugin } from "@devframes/vite/single";
import { defineDevframe, defineRpcFunction } from "devframe";
import type { DevframeNodeContext } from "devframe/types";
import type { Plugin } from "vite";
import { handleNode, handleTree } from "./server/routes.js";

/** @prose
 * # The Prose Vite plugin
 *
 * A dev-only route at `/__prose/`, built on Devframe (spec §6).
 *
 * `devframeVitePlugin` serves the built client SPA at `/__prose/`; `devframeViteBridge` mounts
 * the RPC/WebSocket backend the SPA connects to, on the same origin. Both are plain Vite
 * plugins with no dependency on `@vitejs/devtools` — see spec.md §6 for why: this tool targets
 * one developer on one machine, not the DevTools hub's dock/terminal/command surface. The
 * bridge's RPC endpoint gates behind an OTP by default; `auth: false` below skips that, since
 * the dev server's own loopback binding is already the trust boundary for a local,
 * single-developer tool (spec §2).
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @prose
 * # Registering the RPC functions
 *
 * Pulled out to its own top-level function, rather than an inline `setup` closure passed to
 * `defineDevframe`, so this prose block can attach to it — a comment inside an object literal
 * sits below depth 0 and is silently ignored (spec §3.1: prose blocks inside function/object
 * bodies aren't read). Confirmed the hard way: an earlier version of this file had exactly that
 * comment, nested inside the `setup(ctx) { ... }` closure, and it never showed up in `/__prose/`
 * at all — no error, just silence.
 *
 * `prose:tree`/`prose:node` are registered fully-qualified (not `tree`/`node`) because the
 * client's `client.scope("prose").rpc.call("tree")` auto-prefixes the outgoing call on the
 * client side only — Devframe does not auto-prefix a server-side registration to match. The two
 * sides only agree if the server names the function the same way the client will ask for it
 * (see `prose/lessons.md` for how this one surfaced).
 */
function registerRpc(ctx: DevframeNodeContext): void {
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
}

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
		setup: registerRpc,
	});

	return [
		devframeVitePlugin(devframeDefinition),
		// The bridge's RPC endpoint gates behind an OTP by default; auth: false skips that here
		// (see the file prose above for why) — a plain comment, not @prose, since a comment at
		// this depth (inside the function body) wouldn't be read as prose anyway.
		devframeViteBridge(devframeDefinition, { auth: false }),
	];
}
