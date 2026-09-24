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
 * Two RPC calls, `tree` and `node`, cover the whole client — `client.scope("prose")` auto-
 * prefixes them to `prose:tree`/`prose:node`, matching the fully-qualified names the server
 * registers them under (`src/plugin.ts`).
 */
async function loadTree(): Promise<TreeNode> {
	return prose.rpc.call("tree");
}

async function loadNode(path: string): Promise<TreeNode | null> {
	return prose.rpc.call("node", path);
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
	const link = `<a href="#${encodeURIComponent(node.path)}" class="${activeClass}${pendingClass}">${label}${warningBadge}</a>`;
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
 * fetched by a real user, but still built). `shiki/core` ships none of that; only the six
 * languages this tool actually needs (`SHIKI_LANG`'s values) are imported, by name, so only
 * those six show up in `client/dist` at all. The highlighter itself is created lazily, on first
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
			return `<li><a href="#${encodeURIComponent(child.path)}">${child.name}</a>${pendingBadge}${warningBadge}${summary}</li>`;
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

async function renderPane(node: TreeNode) {
	const parts: string[] = [];
	parts.push(`<div class="breadcrumb">${node.kind} · ${node.path}</div>`);
	parts.push(
		`<h1>${node.kind === "project" ? "project" : node.name}${node.pending ? ' <span class="pending-badge">pending</span>' : ""}</h1>`,
	);
	parts.push(warningsList(node.warnings));
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

async function main() {
	try {
		tree = await loadTree();
		if (!location.hash) location.hash = encodeURIComponent(tree.path);
		await navigate();
		window.addEventListener("hashchange", navigate);
	} catch (err) {
		console.error("[prose]", err);
		pane.innerHTML = `<p class="undocumented">Prose failed to load: ${err instanceof Error ? err.message : String(err)} (see console)</p>`;
	}
}

void main();
