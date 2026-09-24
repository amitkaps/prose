/** @prose
 * # The `/__prose/` client
 *
 * A left rail (project → folders → files → sections → chunks) and a main pane showing whichever
 * node is selected: its prose, then its children as first-paragraph summaries, and at a chunk
 * its syntax-highlighted code (spec §6.1). Hash-based routing (`#main.js#addTodo`) so any node
 * has a stable, linkable URL. No framework — vanilla DOM, since the view itself is simple enough
 * not to need one, and it keeps this SPA's own bundle small.
 */
import githubDark from "@shikijs/themes/github-dark";
import { connectDevframe } from "devframe/client";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { renderMarkdown } from "./markdown.js";

interface Symbol {
	text: string;
	status: "local" | "linked" | "unresolved";
	target?: string;
}

interface Warning {
	kind: "unresolved-symbol" | "stale";
	message: string;
}

interface TreeNode {
	name: string;
	kind: "project" | "folder" | "file" | "section" | "chunk";
	path: string;
	summary: string;
	pending?: boolean;
	prose?: string | null;
	code?: string;
	note?: string;
	symbols?: Symbol[];
	warnings?: Warning[];
	warningCount: number;
	children: TreeNode[];
}

const rail = document.getElementById("rail") as HTMLElement;
const pane = document.getElementById("pane") as HTMLElement;

const SHIKI_LANG: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	css: "css",
	html: "html",
	md: "markdown",
	svelte: "svelte",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
};

let tree: TreeNode | null = null;

/** @prose
 * # Connecting
 *
 * `connectDevframe()` defaults to a *relative* base (`"./"`), resolved against the current page
 * URL — which breaks the same way an asset base does (see `prose/lessons.md`): visiting
 * `/__prose` without its trailing slash resolves `"./__connection.json"` against the parent path
 * instead. `import.meta.url` is always this script's own absolute served URL (e.g.
 * `.../__prose/assets/main-x.js`) regardless of what the address bar shows, so deriving the base
 * from it — two path segments up, past `assets/` — is immune to that. Deliberately not
 * `new URL("../", import.meta.url)`: Vite's build specially intercepts the exact call shape
 * `new URL(<string literal>, import.meta.url)` as a static-asset reference and resolves it at
 * *build time* relative to this file, not at runtime relative to the deployed URL — it silently
 * inlined an unrelated file as a base64 data URL the one time this was tried that way.
 */
function twoDirsUp(url: string): string {
	const lastSlash = url.lastIndexOf("/");
	const secondLastSlash = url.lastIndexOf("/", lastSlash - 1);
	return url.slice(0, secondLastSlash + 1);
}
const base = twoDirsUp(import.meta.url);
const client = await connectDevframe({ baseURL: base });
const prose = client.scope("prose");

/** @prose
 * # Data
 *
 * `tree` is Devframe *synced state*, not a query the client polls — `prose.rpc.sharedState("tree")`
 * resolves to a live handle: `.value()` gives the current snapshot, and `.on("updated", ...)`
 * fires with the whole new tree whenever the node side recomputes it (`src/plugin.ts`'s
 * `refreshTree`, run after a file change or a note write). That's spec §6.1's "updates live when
 * files change, through Devframe's synced state" — no bespoke HMR-websocket wiring, and no manual
 * reload needed to see an edit. `node` stays a plain `query`, fetched fresh on every navigation —
 * a chunk's own code/prose is only ever needed for whichever one node is currently shown.
 */
const treeShared = await prose.rpc.sharedState<TreeNode>("tree");

async function loadNode(path: string): Promise<TreeNode | null> {
	return prose.rpc.call("node", path);
}

/** @prose
 * The two `action` calls behind the annotator (spec's `@note` model, `prose/plan.md`): write, or
 * remove, the `@note` on one chunk. Both return that chunk's fresh node, same as `node` above —
 * the caller still reloads the whole tree afterward, since a note's badge shows in the rail too,
 * not just the pane.
 */
async function addNote(path: string, text: string): Promise<TreeNode | null> {
	return prose.rpc.call("add-note", path, text);
}

async function resolveNote(path: string): Promise<TreeNode | null> {
	return prose.rpc.call("resolve-note", path);
}

/** @prose
 * # Navigation
 *
 * The hash *is* the node path (URL-encoded, since a path can contain `#` itself for a section/
 * chunk anchor — `main.js#addTodo`). An empty hash means the project root, per spec §6.1's
 * "every node has a stable URL".
 */
function currentPath(): string {
	return decodeURIComponent(location.hash.replace(/^#/, "")) || ".";
}

function renderRail(node: TreeNode, active: string): string {
	const isActive = node.path === active;
	const label = node.kind === "project" ? "project" : node.name;
	const pendingClass = node.pending ? " pending" : "";
	const activeClass = isActive ? " active" : "";
	const warningBadge =
		node.warningCount > 0 ? `<span class="warning-badge">${node.warningCount}</span>` : "";
	const noteBadge = node.note ? `<span class="note-badge" title="Has a note"></span>` : "";
	const link = `<a href="#${encodeURIComponent(node.path)}" class="${activeClass}${pendingClass}">${label}${warningBadge}${noteBadge}</a>`;
	if (node.children.length === 0) return `<li>${link}</li>`;
	const children = node.children.map((child) => renderRail(child, active)).join("");
	return `<li>${link}<ul>${children}</ul></li>`;
}

/** @prose
 * # Rendering a node
 *
 * Syntax highlighting goes through `shiki/core`'s fine-grained bundle, not the main `shiki`
 * entry point: the main entry ships every language and theme it knows about (a `codeToHtml`
 * call with a runtime-computed `lang` string can't be statically narrowed by the bundler, so
 * Rollup keeps every language grammar reachable as a separate chunk — dozens of them, most never
 * fetched by a real user, but still built). `shiki/core` ships none of that; only the languages
 * this tool actually needs (`SHIKI_LANG`'s distinct values) are imported, by name, so only those
 * show up in `client/dist` at all. The highlighter itself is created lazily, on first
 * use, and memoized — so it's still not part of the initial page load, matching the previous
 * dynamic-`import("shiki")` behavior, just with a bounded set of languages instead of shiki's
 * own "give me anything" default.
 */
function langForPath(path: string): string {
	const filePart = path.split("#")[0];
	const ext = filePart.slice(filePart.lastIndexOf(".") + 1).toLowerCase();
	return SHIKI_LANG[ext] ?? "text";
}

let highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null;

function getHighlighter() {
	highlighterPromise ??= createHighlighterCore({
		themes: [githubDark],
		langs: [
			import("@shikijs/langs/javascript"),
			import("@shikijs/langs/typescript"),
			import("@shikijs/langs/css"),
			import("@shikijs/langs/html"),
			import("@shikijs/langs/markdown"),
			import("@shikijs/langs/svelte"),
			import("@shikijs/langs/yaml"),
			import("@shikijs/langs/toml"),
		],
		engine: createOnigurumaEngine(import("shiki/wasm")),
	});
	return highlighterPromise;
}

async function renderCode(code: string, lang: string): Promise<string> {
	try {
		const highlighter = await getHighlighter();
		return highlighter.codeToHtml(code, { lang, theme: "github-dark" });
	} catch {
		const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		return `<pre class="plain-code"><code>${escaped}</code></pre>`;
	}
}

function childrenList(node: TreeNode): string {
	if (node.children.length === 0) return "";
	const items = node.children
		.map((child) => {
			const summary =
				child.summary === "undocumented"
					? `<p class="undocumented">undocumented</p>`
					: `<p>${renderMarkdown(child.summary)}</p>`;
			const pendingBadge = child.pending ? `<span class="pending-badge">pending</span>` : "";
			const warningBadge =
				child.warningCount > 0 ? `<span class="warning-badge">${child.warningCount}</span>` : "";
			const noteBadge = child.note ? `<span class="note-badge" title="Has a note"></span>` : "";
			return `<li><a href="#${encodeURIComponent(child.path)}">${child.name}</a>${pendingBadge}${warningBadge}${noteBadge}${summary}</li>`;
		})
		.join("");
	return `<ul class="children">${items}</ul>`;
}

/** @prose
 * # Showing the symbol check in rendered prose (spec §5.1)
 *
 * `markdown-exit` has already turned every `` `text` `` span into a plain `<code>text</code>` —
 * this runs *after* that, matching each resolved `Symbol`'s exact text against those tags and
 * swapping in the right markup: `local`/`unresolved` just get a class (a hover title explains
 * why), `linked` additionally wraps the tag in a same-page `<a href="#...">` to the chunk that
 * declares it. A plain string search-and-replace, not a DOM walk, is enough here since a symbol's
 * text is a JS identifier — no HTML metacharacters to accidentally match inside an attribute or
 * a different tag.
 */
function annotateSymbols(html: string, symbols: Symbol[] | undefined): string {
	if (!symbols || symbols.length === 0) return html;
	let out = html;
	for (const symbol of symbols) {
		const escaped = symbol.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const tag = new RegExp(`<code>${escaped}</code>`, "g");
		if (symbol.status === "linked" && symbol.target) {
			out = out.replace(
				tag,
				`<a class="symbol-link" href="#${encodeURIComponent(symbol.target)}"><code>${symbol.text}</code></a>`,
			);
		} else {
			const cls = symbol.status === "unresolved" ? "symbol-unresolved" : "symbol-local";
			const title =
				symbol.status === "unresolved"
					? "Not declared anywhere in this project"
					: "Declared in this chunk's own code";
			out = out.replace(tag, `<code class="${cls}" title="${title}">${symbol.text}</code>`);
		}
	}
	return out;
}

function warningsList(warnings: Warning[] | undefined): string {
	if (!warnings || warnings.length === 0) return "";
	const items = warnings.map((w) => `<li class="warning">${w.message}</li>`).join("");
	return `<ul class="warnings">${items}</ul>`;
}

/** @prose
 * # The annotator (in-situ `@note`, direct manipulation over a separate `remarks.md`)
 *
 * Only chunks can carry a note (`src/notes.ts` needs an exact `@prose` block to anchor a write
 * to). An existing note renders with a Resolve button; otherwise a plain "+ Add note" link reveals
 * a textarea — no preview, no formatting toolbar, since a note is a short direction or question,
 * not prose being authored (that's still done by hand, in the source file, per spec's model).
 */
function noteSection(node: TreeNode): string {
	if (node.kind !== "chunk") return "";
	const path = encodeURIComponent(node.path);
	if (node.note) {
		return `<div class="note-block" data-path="${path}">
			<div class="note-label">Note</div>
			${renderMarkdown(node.note)}
			<button type="button" class="resolve-note">Resolve</button>
		</div>`;
	}
	return `<div class="note-block note-empty" data-path="${path}">
		<button type="button" class="add-note">+ Add note</button>
		<textarea class="note-input" hidden rows="3"></textarea>
		<div class="note-actions" hidden>
			<button type="button" class="save-note">Save</button>
			<button type="button" class="cancel-note">Cancel</button>
		</div>
	</div>`;
}

async function renderPane(node: TreeNode) {
	const parts: string[] = [];
	parts.push(`<div class="breadcrumb">${node.kind} · ${node.path}</div>`);
	parts.push(
		`<h1>${node.kind === "project" ? "project" : node.name}${node.pending ? ' <span class="pending-badge">pending</span>' : ""}</h1>`,
	);
	parts.push(warningsList(node.warnings));
	parts.push(noteSection(node));
	parts.push(
		node.prose
			? annotateSymbols(renderMarkdown(node.prose), node.symbols)
			: `<p class="undocumented">undocumented</p>`,
	);

	if (node.kind === "chunk") {
		if (node.pending) {
			parts.push(`<p class="undocumented">pending — no code yet</p>`);
		} else if (typeof node.code === "string") {
			parts.push(await renderCode(node.code, langForPath(node.path)));
		}
	}

	parts.push(childrenList(node));
	pane.innerHTML = parts.join("\n");
}

/** @prose
 * # Wiring the annotator's buttons
 *
 * One delegated listener on `pane` itself, registered once — not re-bound on every render — since
 * `renderPane` replaces `pane.innerHTML` wholesale on every navigation; a listener attached to any
 * of its children would be destroyed along with them, but `pane` itself is stable across renders,
 * so delegation is what makes "click Save" keep working after the very first render.
 */
pane.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return;
	const block = target.closest(".note-block");
	if (!(block instanceof HTMLElement)) return;
	const path = decodeURIComponent(block.dataset.path ?? "");

	if (target.matches(".add-note")) {
		target.hidden = true;
		block.querySelector<HTMLElement>(".note-input")!.hidden = false;
		block.querySelector<HTMLElement>(".note-actions")!.hidden = false;
		block.querySelector<HTMLTextAreaElement>(".note-input")!.focus();
		return;
	}
	if (target.matches(".cancel-note")) {
		const textarea = block.querySelector<HTMLTextAreaElement>(".note-input")!;
		textarea.value = "";
		textarea.hidden = true;
		block.querySelector<HTMLElement>(".note-actions")!.hidden = true;
		block.querySelector<HTMLElement>(".add-note")!.hidden = false;
		return;
	}
	if (target.matches(".save-note")) {
		const text = block.querySelector<HTMLTextAreaElement>(".note-input")!.value.trim();
		if (!text) return;
		// The rail's note badges update on their own via the tree's synced state (`treeShared`
		// above); re-navigating here is just for the current pane's own immediate feedback,
		// without waiting on that push to land first.
		void addNote(path, text).then(() => navigate());
		return;
	}
	if (target.matches(".resolve-note")) {
		void resolveNote(path).then(() => navigate());
	}
});

/** @prose
 * # Bootstrapping
 *
 * `main()`'s try/catch is deliberate, not defensive boilerplate: an earlier version of this file
 * had none, and a real RPC failure (a not-found function name, an auth rejection) left the page
 * silently blank with nothing but a console error — which is exactly what made three separate
 * bugs during development hard to tell apart from each other. Surfacing the error's message into
 * the pane directly turned "blank page, check the logs" into "read the error on screen."
 */
async function navigate() {
	if (!tree) return;
	const path = currentPath();
	const node = (await loadNode(path)) ?? tree;
	rail.innerHTML = `<ul>${renderRail(tree, node.path)}</ul>`;
	await renderPane(node);
}

/** @prose
 * `.value()` isn't guaranteed to hold real data the instant `sharedState("tree")` resolves —
 * confirmed directly, not assumed: with no client-side `initialValue` passed (this client has
 * none to offer; the node side's is the only real one), Devframe's client host can resolve the
 * handle *before* the server round trip that actually populates it finishes (an internal
 * trust-handshake race), leaving `.value()` empty for one tick. The one real sync it does before
 * that always arrives as an `"updated"` event, so waiting for the first one whenever `.value()`
 * comes back empty is correct in both cases, not a workaround for one specific timing.
 */
async function firstTreeValue(): Promise<TreeNode> {
	const existing = treeShared.value();
	if (existing != null) return existing as TreeNode;
	return new Promise((resolve) => {
		const off = treeShared.on("updated", (fullState) => {
			off();
			resolve(fullState as TreeNode);
		});
	});
}

async function main() {
	try {
		tree = await firstTreeValue();
		treeShared.on("updated", (fullState) => {
			tree = fullState as TreeNode;
			void navigate();
		});
		if (!location.hash) location.hash = encodeURIComponent(tree.path);
		await navigate();
		window.addEventListener("hashchange", navigate);
	} catch (err) {
		console.error("[prose]", err);
		pane.innerHTML = `<p class="undocumented">Prose failed to load: ${err instanceof Error ? err.message : String(err)} (see console)</p>`;
	}
}

void main();
