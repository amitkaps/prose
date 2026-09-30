/** @prose
 * # Pages as HTML
 *
 * Turns the tree's nodes into the renderer's pages (spec §4.1): a folder, a Markdown file, a
 * source file read as one document, or a plain text file. Every function returns a complete HTML
 * string; nothing runs in the browser but the few lines in `page`. Markdown goes through markz,
 * the same parser in files and in prose blocks, and code through `highlight.ts`.
 */
import { html as markz } from "@amitkaps/markz";
import { escapeHtml, highlight, highlightFences } from "./highlight.js";
import type { TreeNode } from "./tree.js";
import { STYLE } from "./style.js";

export async function renderMarkdown(text: string): Promise<string> {
	return text.trim() ? highlightFences(markz(text)) : "";
}

/** A summary as inline HTML: its first paragraph rendered, without the wrapping `<p>`. */
function renderSummary(text: string): string {
	return markz(text)
		.trim()
		.replace(/^<p>([\s\S]*)<\/p>$/, "$1");
}

function extensionOf(path: string): string {
	return path.slice(path.lastIndexOf(".") + 1).toLowerCase();
}

type Segment = { kind: "block"; block: TreeNode } | { kind: "code"; text: string; line: number };

/** @prose
 * # A file, in order
 *
 * Lays a file out as it was written: the code between the prose comments, and each prose block
 * at the byte range its comment took (`span`). The comment text itself is dropped, since the page
 * renders the prose in its place, so the whole file shows and nothing repeats. Blank lines at the
 * edges of each code run are trimmed, a run that's only whitespace disappears, and each run keeps
 * the line it starts on.
 */
export function segments(source: string, blocks: TreeNode[]): Segment[] {
	const out: Segment[] = [];
	const pushCode = (from: number, to: number) => {
		const raw = source.slice(from, to);
		const trimmedStart = raw.replace(/^(?:[ \t]*\r?\n)+/, "");
		const text = trimmedStart.replace(/\s+$/, "");
		if (!text) return;
		const start = from + (raw.length - trimmedStart.length);
		let line = 1;
		for (let i = 0; i < start; i++) if (source[i] === "\n") line++;
		out.push({ kind: "code", text, line });
	};
	let at = 0;
	for (const block of [...blocks].filter((b) => b.span).sort((a, b) => a.span![0] - b.span![0])) {
		pushCode(at, block.span![0]);
		out.push({ kind: "block", block });
		at = block.span![1];
	}
	pushCode(at, source.length);
	return out;
}

/** The listing on a folder page: each child with its summary, *undocumented* where it has none. */
function renderListing(children: TreeNode[]): string {
	if (children.length === 0) return "";
	const items = children.map((child) => {
		const name = child.path.split("/").at(-1)!;
		const href =
			child.kind === "folder" ? `${encodeURIComponent(name)}/` : encodeURIComponent(name);
		const label = child.kind === "folder" ? `${name}/` : name;
		const summary =
			child.kind === "raw"
				? ""
				: child.summary === "undocumented" || !child.summary
					? `<span class="undocumented">undocumented</span>`
					: renderSummary(child.summary);
		return `<li class="${child.kind}"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a>${
			summary ? `<p>${summary}</p>` : ""
		}</li>`;
	});
	return `<ul class="listing">${items.join("")}</ul>`;
}

export async function folderBody(node: TreeNode): Promise<string> {
	const readme = node.prose ? `<div class="prose">${await renderMarkdown(node.prose)}</div>` : "";
	return `${readme}${renderListing(node.children)}`;
}

export async function markdownBody(node: TreeNode): Promise<string> {
	return `<div class="prose">${await renderMarkdown(node.prose ?? "")}</div>`;
}

export async function rawBody(node: TreeNode): Promise<string> {
	return `<div class="code open">${await highlight(node.code ?? "", extensionOf(node.path))}</div>`;
}

/** @prose
 * # A source file as one document
 *
 * The file prose, then each chunk's prose in source order, with its code folded between them
 * (spec §4.1). A block's anchor is its `id`, so `src/store.ts#addTodo` lands on it, and a pending
 * chunk says so. A file with no prose is only its code, unfolded. Folded code is a `<details>`,
 * so it opens without script, and its summary says how long it is and where it starts.
 */
export async function sourceBody(node: TreeNode, editorBase: string | null): Promise<string> {
	const blocks = node.blocks ?? [];
	const lang = extensionOf(node.path);
	if (blocks.length === 0) {
		return `<div class="code open">${await highlight(node.source ?? "", lang)}</div>`;
	}
	const parts = await Promise.all(
		segments(node.source ?? "", blocks).map(async (segment) => {
			if (segment.kind === "block") {
				const { block } = segment;
				const anchor = block.path.slice(block.path.indexOf("#") + 1);
				const open = editorBase
					? ` <a class="line" href="${escapeHtml(`${editorBase}:${block.line}`)}" title="Open in editor">L${block.line}</a>`
					: "";
				return `<section class="block${block.pending ? " pending" : ""}" id="${escapeHtml(anchor)}"><div class="prose">${await renderMarkdown(block.prose ?? "")}</div>${
					block.pending ? `<p class="pending-mark">pending${open}</p>` : ""
				}${block.pending ? "" : `<p class="meta"><a href="#${escapeHtml(anchor)}">#${escapeHtml(anchor)}</a>${open}</p>`}</section>`;
			}
			const lines = segment.text.split("\n").length;
			return `<details class="code"><summary>${lines} line${lines === 1 ? "" : "s"} · from line ${segment.line}</summary>${await highlight(segment.text, lang)}</details>`;
		}),
	);
	return parts.join("");
}

export interface PageOptions {
	/** The project's name, for the breadcrumb and the title. */
	project: string;
	/** The page's repo path: `""` for the root, `src/` for a folder, `src/store.ts` for a file. */
	path: string;
	body: string;
	/** A `vscode://file/…` link for the file, or null for a folder. */
	editorLink: string | null;
	/** Whether the page has folded code for the **Show code** toggle to open. */
	hasFoldedCode: boolean;
}

function breadcrumb(project: string, path: string): string {
	const segments = path.split("/").filter(Boolean);
	const crumbs = [`<a href="/">${escapeHtml(project)}</a>`];
	segments.forEach((segment, i) => {
		const last = i === segments.length - 1;
		const href = `/${segments
			.slice(0, i + 1)
			.map(encodeURIComponent)
			.join("/")}${last && !path.endsWith("/") ? "" : "/"}`;
		crumbs.push(
			last
				? `<span aria-current="page">${escapeHtml(segment)}</span>`
				: `<a href="${escapeHtml(href)}">${escapeHtml(segment)}</a>`,
		);
	});
	return crumbs.join(`<span class="sep">/</span>`);
}

/** @prose
 * # The page shell
 *
 * One stylesheet inline, a breadcrumb, and a few lines of script: the **Show code** toggle, and
 * live reload. The server sends the path of each changed file; a page reloads when it's the file
 * it shows, or when it's inside the folder it lists, and keeps its scroll position across the
 * reload. Browser storage can be unavailable, so it's only ever tried.
 */
export function page(options: PageOptions): string {
	const { project, path, body, editorLink, hasFoldedCode } = options;
	const title = path ? `${path.replace(/\/$/, "").split("/").at(-1)} · ${project}` : project;
	const actions = [
		hasFoldedCode ? `<button type="button" data-toggle-code>Show code</button>` : "",
		editorLink ? `<a href="${escapeHtml(editorLink)}">Open in editor</a>` : "",
	].join("");
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body data-path="${escapeHtml(path)}">
<header class="bar"><nav class="crumbs">${breadcrumb(project, path)}</nav><div class="actions">${actions}</div></header>
<main>${body}</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const SCRIPT = `
const toggle = document.querySelector("[data-toggle-code]");
if (toggle) toggle.addEventListener("click", () => {
	const all = [...document.querySelectorAll("details.code")];
	const open = !all.every((d) => d.open);
	for (const d of all) d.open = open;
	toggle.textContent = open ? "Hide code" : "Show code";
});
const key = "prose:scroll:" + location.pathname;
try {
	const y = sessionStorage.getItem(key);
	if (y !== null) { sessionStorage.removeItem(key); scrollTo(0, Number(y)); }
} catch {}
const here = document.body.dataset.path;
new EventSource("/.prose/events").onmessage = (event) => {
	const changed = event.data;
	if (changed === here || here === "" || (here.endsWith("/") && changed.startsWith(here))) {
		try { sessionStorage.setItem(key, String(scrollY)); } catch {}
		location.reload();
	}
};
`;
