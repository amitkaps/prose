import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devframeViteBridge, devframeVitePlugin } from "@devframes/vite/single";
import { defineDevframe, defineRpcFunction } from "devframe";
import type { DevframeNodeContext } from "devframe/types";
import { isLoopbackAddress } from "devframe/utils/origin";
import type { SharedState } from "devframe/utils/shared-state";
import type { Plugin } from "vite";
import {
	handleAddNote,
	handleNode,
	handleNoteTarget,
	handleResolveNote,
	handleTree,
} from "./server/routes.js";
import type { TreeNode } from "./tree.js";

/** @prose
 * # The Prose Vite plugin
 *
 * A dev-only route at `/__prose/`, built on Devframe (spec §6).
 *
 * `devframeVitePlugin` serves the built client SPA at `/__prose/` (Devframe's default mount for
 * a hosted devframe, `/__<id>/`); `devframeViteBridge` mounts the RPC/WebSocket backend the SPA
 * connects to, on the same origin. Both come from `@devframes/vite/single` and go straight into
 * the app's own dev server, with no dependency on `@vitejs/devtools`: the DevTools hub's
 * dock/terminal/command surface and default trust handshake are more than one developer on one
 * machine needs (`prose/lessons.md` has how that was found). If Prose ever needs to dock beside
 * other tooling, `@vitejs/devtools-kit`'s `createPluginFromDevframe` is the way in. The bridge's
 * RPC endpoint gates behind an OTP by default; `auth: false` below skips that, since the dev
 * server's own loopback binding is the trust boundary for a local, single-developer tool
 * (spec §6, "Trust boundary", which also lists the guards writes still need).
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
/** @prose
 * # Stripping `@prose` from built HTML (spec §6.4)
 *
 * Vite keeps HTML comments verbatim in built pages, so without this, `<!-- @prose -->` (and any
 * unresolved `<!-- @note -->` still sitting in source) would be visible to anyone viewing a
 * built page's source — a comment written for `/__prose/`'s own audience, leaking into the
 * production app. Matches the same marker either style would produce (`extractMarkedBlock` in
 * `parser.ts` recognizes the same two), so this needs no knowledge of `parser.ts`'s own scanning
 * logic — just the literal text shape a marked HTML comment always has.
 *
 * Only `.html` output needs this at all: minifiers already drop `/** @prose *\/` from JS/CSS
 * (they keep only `@license`/`@preserve`/`/*!` comments), and the Svelte compiler drops markup
 * comments by default (`preserveComments: false`) — so a `.svelte` file's own `<!-- @prose -->`
 * never reaches a built page's HTML in the first place.
 */
const PROSE_HTML_COMMENT_RE = /[ \t]*<!--\s*@(?:prose|note)\b[\s\S]*?-->[ \t]*\r?\n?/g;

export function stripProseHtml(html: string): string {
	return html.replace(PROSE_HTML_COMMENT_RE, "");
}

/** @prose
 * # Live updates: the tree as synced state, not a poll (spec §6.1)
 *
 * `prose:tree` used to be a plain `query` — the client called it once on load and again on every
 * navigation, with no way to learn that a file changed underneath it. Devframe's `SharedState` is
 * the primitive spec §6.1 names for this ("through Devframe's synced state, no bespoke HMR-
 * websocket wiring"): the node side owns one `SharedState<TreeNode>`, mutating it recomputes and
 * pushes the *whole* new tree to every connected client automatically (no `enablePatches`, so no
 * diffing to get right for a project this small) — the client only ever reads `.value()` once and
 * listens for `'updated'` after that, never polls. `ProseShared` holds the one instance a given
 * `prose()` call creates, so `registerRpc` (Devframe's `setup`) and the file-watcher plugin below
 * (an ordinary Vite `configureServer` hook, which Devframe's own context doesn't expose a watcher
 * for — confirmed directly: `DevframeNodeContext` carries only a narrow, watcher-less slice of
 * Vite's dev server) can agree on the same state without a module-level global that would leak
 * across multiple `prose()` instances in one process.
 */
interface ProseShared {
	root: string;
	treeState: SharedState<TreeNode> | null;
	/** Set once the dev server is listening, and only if it listens on loopback (below). */
	writable: boolean;
}

function currentTree(shared: ProseShared): TreeNode {
	return { ...handleTree(shared.root), writable: shared.writable };
}

function refreshTree(shared: ProseShared): void {
	if (!shared.treeState) return;
	const next = currentTree(shared);
	shared.treeState.mutate((state) => Object.assign(state, next));
}

/** @prose
 * # Writes only on loopback (spec §6, "Trust boundary")
 *
 * Devframe already refuses WebSocket connections from a non-loopback browser origin, but it lets
 * through clients that send no `Origin` header at all, since those are native tools, not web
 * pages. That's fine while the dev server listens only on loopback. With `vite --host` anything on
 * the network could connect and call `add-note`. So writes start refused and are allowed only
 * once the HTTP server is listening on a loopback address; `vite --host`, or a middleware-mode
 * server with no HTTP server of its own, stays read-only. The tree carries the flag so the view
 * can hide its write controls.
 */
function assertWritable(shared: ProseShared): void {
	if (!shared.writable) {
		throw new Error(
			"Notes are read-only here: the dev server listens on a non-loopback address (spec §6).",
		);
	}
}

async function registerRpc(ctx: DevframeNodeContext, shared: ProseShared): Promise<void> {
	shared.root = ctx.workspaceRoot;
	shared.treeState = await ctx.rpc.sharedState.get<TreeNode>("prose:tree", {
		initialValue: currentTree(shared),
	});
	ctx.rpc.register(
		defineRpcFunction({
			name: "prose:node",
			type: "query",
			jsonSerializable: true,
			handler: (path: string) => handleNode(ctx.workspaceRoot, path),
		}),
	);
	ctx.rpc.register(
		defineRpcFunction({
			name: "prose:add-note",
			type: "action",
			jsonSerializable: true,
			handler: (path: string, text: string, hash: string) => {
				assertWritable(shared);
				const node = handleAddNote(ctx.workspaceRoot, path, text, hash);
				refreshTree(shared);
				return node;
			},
		}),
	);
	ctx.rpc.register(
		defineRpcFunction({
			name: "prose:note-target",
			type: "query",
			jsonSerializable: true,
			handler: (path: string, hash: string) => handleNoteTarget(ctx.workspaceRoot, path, hash),
		}),
	);
	ctx.rpc.register(
		defineRpcFunction({
			name: "prose:resolve-note",
			type: "action",
			jsonSerializable: true,
			handler: (path: string, hash: string) => {
				assertWritable(shared);
				const node = handleResolveNote(ctx.workspaceRoot, path, hash);
				refreshTree(shared);
				return node;
			},
		}),
	);
}

export function prose(): Plugin[] {
	const shared: ProseShared = { root: "", treeState: null, writable: false };
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
		setup: (ctx) => registerRpc(ctx, shared),
	});

	return [
		devframeVitePlugin(devframeDefinition),
		// The bridge's RPC endpoint gates behind an OTP by default; auth: false skips that here
		// (see the file prose above for why) — a plain comment, not @prose, since a comment at
		// this depth (inside the function body) wouldn't be read as prose anyway. `mcp: false`
		// keeps Devframe's MCP route unmounted until plan step 6 decides what it exposes.
		devframeViteBridge(devframeDefinition, { auth: false, mcp: false }),
		// Dev-only route aside, this is the plugin's only footprint in `vite build` output (§6.4).
		{
			name: "prose:strip-html",
			apply: "build",
			transformIndexHtml(html) {
				return stripProseHtml(html);
			},
		},
		// File-change -> recomputed tree -> pushed to every connected client, via the SharedState
		// above. Vite's own watcher already excludes node_modules/.git; a broader recompute-on-any-
		// change (no per-extension filtering) is deliberate — `handleTree` is a full re-walk anyway
		// (see `server/routes.ts`'s own reasoning for why that's cheap enough not to cache), so
		// there's no correctness reason to guess which changed files might matter.
		{
			name: "prose:watch",
			apply: "serve",
			configureServer(server) {
				server.watcher.on("all", (event) => {
					if (event === "change" || event === "add" || event === "unlink") refreshTree(shared);
				});
				server.httpServer?.on("listening", () => {
					const address = server.httpServer?.address();
					shared.writable =
						typeof address === "object" && address !== null && isLoopbackAddress(address.address);
					refreshTree(shared);
				});
			},
		},
	];
}
