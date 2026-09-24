import { connectDevframe } from "devframe/client";
import { renderMarkdown } from "./markdown.js";

interface TreeNode {
	name: string;
	kind: "project" | "folder" | "file" | "section" | "chunk";
	path: string;
	summary: string;
	pending?: boolean;
	prose?: string | null;
	code?: string;
	children: TreeNode[];
}

const rail = document.getElementById("rail") as HTMLElement;
const pane = document.getElementById("pane") as HTMLElement;

const SHIKI_LANG: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	css: "css",
	html: "html",
	svelte: "svelte",
};

let tree: TreeNode | null = null;

// `connectDevframe()` defaults to a *relative* base ("./"), resolved against the current page
// URL — which breaks the same way an asset base does (see docs/lessons.md): visiting `/__prose`
// without its trailing slash resolves "./__connection.json" against the parent path instead.
// `import.meta.url` is always this script's own absolute served URL (e.g.
// `.../__prose/assets/main-x.js`) regardless of what the address bar shows, so deriving the base
// from it — two path segments up, past `assets/` — is immune to that. Deliberately not
// `new URL("../assets/../", import.meta.url)`: Vite's build specially intercepts the exact call
// shape `new URL(<string literal>, import.meta.url)` as a static-asset reference and resolves it
// at *build time* relative to this file, not at runtime relative to the deployed URL.
function twoDirsUp(url: string): string {
	const lastSlash = url.lastIndexOf("/");
	const secondLastSlash = url.lastIndexOf("/", lastSlash - 1);
	return url.slice(0, secondLastSlash + 1);
}
const base = twoDirsUp(import.meta.url);
const client = await connectDevframe({ baseURL: base });
const prose = client.scope("prose");

async function loadTree(): Promise<TreeNode> {
	return prose.rpc.call("tree");
}

async function loadNode(path: string): Promise<TreeNode | null> {
	return prose.rpc.call("node", path);
}

function currentPath(): string {
	return decodeURIComponent(location.hash.replace(/^#/, "")) || ".";
}

function renderRail(node: TreeNode, active: string): string {
	const isActive = node.path === active;
	const label = node.kind === "project" ? "project" : node.name;
	const pendingClass = node.pending ? " pending" : "";
	const activeClass = isActive ? " active" : "";
	const link = `<a href="#${encodeURIComponent(node.path)}" class="${activeClass}${pendingClass}">${label}</a>`;
	if (node.children.length === 0) return `<li>${link}</li>`;
	const children = node.children.map((child) => renderRail(child, active)).join("");
	return `<li>${link}<ul>${children}</ul></li>`;
}

function langForPath(path: string): string {
	const filePart = path.split("#")[0];
	const ext = filePart.slice(filePart.lastIndexOf(".") + 1).toLowerCase();
	return SHIKI_LANG[ext] ?? "text";
}

async function renderCode(code: string, lang: string): Promise<string> {
	try {
		const { codeToHtml } = await import("shiki");
		return await codeToHtml(code, { lang, theme: "github-dark" });
	} catch {
		const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		return `<pre class="plain-code"><code>${escaped}</code></pre>`;
	}
}

function childrenList(node: TreeNode): string {
	if (node.children.length === 0) return "";
	const items = node.children
		.map((child) => {
			const summary = child.summary === "undocumented" ? `<p class="undocumented">undocumented</p>` : `<p>${renderMarkdown(child.summary)}</p>`;
			const pendingBadge = child.pending ? `<span class="pending-badge">pending</span>` : "";
			return `<li><a href="#${encodeURIComponent(child.path)}">${child.name}</a>${pendingBadge}${summary}</li>`;
		})
		.join("");
	return `<ul class="children">${items}</ul>`;
}

async function renderPane(node: TreeNode) {
	const parts: string[] = [];
	parts.push(`<div class="breadcrumb">${node.kind} · ${node.path}</div>`);
	parts.push(`<h1>${node.kind === "project" ? "project" : node.name}${node.pending ? ' <span class="pending-badge">pending</span>' : ""}</h1>`);
	parts.push(node.prose ? renderMarkdown(node.prose) : `<p class="undocumented">undocumented</p>`);

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

main();
