/** @prose
 * # Client state
 *
 * One store holds everything the view reads: the live `tree`, the current `path` (the URL hash),
 * and the per-viewer rail state. The current node is *derived* from the tree by path, not fetched:
 * the tree Devframe pushes already carries every node's prose, code and note, so navigating is a
 * local lookup and a live update re-renders the open node with no extra round trip. (The server's
 * `node` RPC stays for agents, not for this client.) It is a `.svelte.ts` module so the class fields
 * can be `$state`/`$derived`; pure logic lives in plain `.ts` modules (`nav.ts`, `stats.ts`) where
 * Node-side tests can reach it.
 */
import { connectDevframe } from "devframe/client";
import { pathTo, resolvePath, type TreeNode } from "./nav.js";
import { rollup } from "./stats.js";

const RAIL_STORAGE_KEY = "prose:rail";
/** Nodes at this depth or deeper start collapsed in the rail. */
const DEFAULT_OPEN_DEPTH = 2;

/** @prose
 * Expand/collapse state is a per-viewer convenience, so it lives in `sessionStorage` (never synced,
 * and allowed to be missing: private windows and blocked storage throw). Only the nodes the viewer
 * has explicitly toggled, or that were auto-opened to reveal the active node, are stored; every
 * other node falls back to the depth default, so a changing tree never leaves stale entries that matter.
 */
function loadOverrides(): Record<string, boolean> {
	try {
		return JSON.parse(sessionStorage.getItem(RAIL_STORAGE_KEY) ?? "{}") as Record<string, boolean>;
	} catch {
		return {};
	}
}

function saveOverrides(overrides: Record<string, boolean>): void {
	try {
		sessionStorage.setItem(RAIL_STORAGE_KEY, JSON.stringify(overrides));
	} catch {
		// Storage unavailable: the rail simply doesn't remember its state.
	}
}

class Store {
	tree = $state<TreeNode | null>(null);
	path = $state(".");
	error = $state<string | null>(null);
	paletteOpen = $state(false);
	overrides = $state<Record<string, boolean>>(loadOverrides());

	/** What the URL points at: a rail node (a block path resolves to its file) plus, for a block, the
	 *  path to scroll to. An unknown path falls back to the project root. */
	resolved = $derived(this.tree ? resolvePath(this.tree, this.path) : null);
	node = $derived(this.resolved?.node ?? null);
	focus = $derived(this.resolved?.focus ?? null);
	/** Root-to-node chain, for the breadcrumb. */
	chain = $derived(this.tree && this.node ? pathTo(this.tree, this.node.path) : []);
	attention = $derived(this.tree ? rollup(this.tree) : new Map());

	isOpen(path: string, depth: number): boolean {
		return this.overrides[path] ?? depth < DEFAULT_OPEN_DEPTH;
	}

	toggle(path: string, depth: number): void {
		this.overrides[path] = !this.isOpen(path, depth);
		saveOverrides(this.overrides);
	}

	/** Opens every ancestor of the current node so the active row is visible in the rail. */
	reveal(): void {
		let changed = false;
		for (const ancestor of this.chain.slice(0, -1)) {
			if (this.overrides[ancestor.path] !== true) {
				this.overrides[ancestor.path] = true;
				changed = true;
			}
		}
		if (changed) saveOverrides(this.overrides);
	}
}

export const store = new Store();

/** The hash *is* the node path, URL-encoded (a path can contain `#` itself for a section or chunk
 *  anchor, like `main.js#addTodo`). An empty hash means the project root (spec §6.1). */
function syncPath(): void {
	store.path = decodeURIComponent(location.hash.replace(/^#/, "")) || ".";
	store.reveal();
}

export function hrefFor(path: string): string {
	return `#${encodeURIComponent(path)}`;
}

export function go(path: string): void {
	location.hash = encodeURIComponent(path);
}

/** Copies the stable URL of a node; false when the clipboard isn't available. */
export async function copyLink(path: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(`${location.origin}${location.pathname}${hrefFor(path)}`);
		return true;
	} catch {
		return false;
	}
}

/** @prose
 * # Connecting
 *
 * `connectDevframe()` defaults to a *relative* base (`"./"`), resolved against the current page URL,
 * which breaks the way an asset base does (see `prose/lessons.md`): visiting `/__prose` without its
 * trailing slash resolves `./__connection.json` against the parent path. `import.meta.url` is always
 * this script's own absolute URL (`.../__prose/assets/main-x.js`), so the base is that URL two path
 * segments up, past `assets/`. Deliberately string slicing, not `new URL("../", import.meta.url)`:
 * Vite treats that exact call shape as a build-time static-asset reference and once inlined an
 * unrelated file as a base64 data URL.
 */
function twoDirsUp(url: string): string {
	const lastSlash = url.lastIndexOf("/");
	const secondLastSlash = url.lastIndexOf("/", lastSlash - 1);
	return url.slice(0, secondLastSlash + 1);
}

async function connect() {
	const client = await connectDevframe({ baseURL: twoDirsUp(import.meta.url) });
	return client.scope("prose");
}

let prose: Awaited<ReturnType<typeof connect>> | null = null;

/** @prose
 * # Notes
 *
 * The two write calls (Devframe actions) behind the annotator (spec §6.2): write, or remove, the `@note` on one
 * chunk. Neither result is used: the server recomputes the tree after every write, and that arrives
 * as a normal live update, which is what re-renders the pane and the rail's badges.
 */
export async function addNote(path: string, text: string): Promise<void> {
	await prose?.rpc.call("add-note", path, text);
}

export async function resolveNote(path: string): Promise<void> {
	await prose?.rpc.call("resolve-note", path);
}

/** @prose
 * # Bootstrapping
 *
 * The try/catch is deliberate: an earlier version had none, and a real RPC failure (an unknown
 * function name, an auth rejection) left the page blank with only a console error, which made three
 * separate bugs hard to tell apart. Putting the message on screen turned "blank page, check the
 * logs" into "read the error."
 *
 * The tree is Devframe *synced state*: `.value()` is the current snapshot and `"updated"` fires with
 * the whole new tree whenever the server recomputes it (spec §6.1, no bespoke HMR wiring). But
 * `.value()` isn't guaranteed to hold data the instant the handle resolves: with no client-side
 * initial value, Devframe can resolve it before the server round trip that fills it in finishes,
 * so an empty value waits for the first `"updated"` event, which is correct either way.
 */
export async function start(): Promise<void> {
	try {
		prose = await connect();
		const shared = await prose.rpc.sharedState<TreeNode>("tree");
		const existing = shared.value();
		store.tree =
			existing != null
				? (existing as TreeNode)
				: await new Promise<TreeNode>((resolve) => {
						const off = shared.on("updated", (fullState) => {
							off();
							resolve(fullState as TreeNode);
						});
					});
		shared.on("updated", (fullState) => {
			store.tree = fullState as TreeNode;
		});
		if (!location.hash) location.hash = encodeURIComponent(store.tree.path);
		syncPath();
		window.addEventListener("hashchange", syncPath);
	} catch (err) {
		console.error("[prose]", err);
		store.error = err instanceof Error ? err.message : String(err);
	}
}
