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
import { FILE_ANCHOR } from "./parser.js";
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
  return NO_PROSE + (await codeRun(node.code ?? "", extensionOf(node.path), 1));
}

/** Shown in place of prose on a file that has none, so **Prose only** doesn't leave a bare header. */
const NO_PROSE = `<p class="no-prose">No prose in this file.</p>`;

/** @prose
 * # Code runs
 *
 * A run of code in a panel with a header of its own: a chevron, how many lines and which, and the
 * language. The header stays in both modes, so a prose-only page still shows where the code is
 * and how much of it; clicking it opens or closes that one run, against the page's mode, until the
 * mode changes. Line numbers are the file's own: the run knows the line it starts on, and a CSS
 * counter carries on from there, in a gutter as wide as the largest number. A file with no prose,
 * JSON included, is one run with the same header, and folds like any other.
 */
async function codeRun(text: string, lang: string, startLine: number): Promise<string> {
  const count = text.split("\n").length;
  const last = startLine + count - 1;
  const lines = `${count} line${count === 1 ? "" : "s"} · ${startLine}–${last}`;
  const head = `<button type="button" class="code-head" aria-expanded="true"><span class="chevron" aria-hidden="true"></span><span>${lines}</span><span class="lang">${escapeHtml(lang)}</span></button>`;
  return `<div class="code" style="counter-reset: line ${startLine - 1}; --gutter: ${String(last).length}ch">${head}${await highlight(text, lang)}</div>`;
}

/** @prose
 * # A source file as one document
 *
 * The file prose, then each chunk's prose in source order, with its code between them (spec
 * §4.1). A block's anchor is its `id`, so `src/store.ts#addTodo` lands on it, and a pending chunk
 * says so. The `#` that links to it goes inside the block's first heading or paragraph, so it
 * sits on that line at that size; the heading gives up the `id` markz gave it, since the block
 * carries the anchor. The file prose is the top of the page and gets no `#`. Code shows by default; the page's **Prose only**
 * switch folds it (`page`). A file with no prose says so, above its code.
 */
export async function sourceBody(node: TreeNode): Promise<string> {
  const blocks = node.blocks ?? [];
  const lang = extensionOf(node.path);
  if (blocks.length === 0) return NO_PROSE + (await codeRun(node.source ?? "", lang, 1));
  const parts = await Promise.all(
    segments(node.source ?? "", blocks).map(async (segment) => {
      if (segment.kind === "code") return codeRun(segment.text, lang, segment.line);
      const { block } = segment;
      const anchor = escapeHtml(block.path.slice(block.path.indexOf("#") + 1));
      const prose = await renderMarkdown(block.prose ?? "");
      return `<section class="block${block.pending ? " pending" : ""}" id="${anchor}"><div class="prose">${
        block.path.endsWith(`#${FILE_ANCHOR}`) ? prose : withAnchor(prose, anchor)
      }</div>${block.pending ? `<p class="pending-mark">pending</p>` : ""}</section>`;
    }),
  );
  return parts.join("");
}

const FIRST_LINE_RE = /^<(h[1-6]|p)(?: id="[^"]*")?>/;

/** Puts the block's `#` link at the start of its first heading or paragraph, or before the prose
 *  when it opens with something else, such as a list. */
function withAnchor(prose: string, anchor: string): string {
  const link = `<a class="anchor" href="#${anchor}" aria-label="Link to this block">#</a>`;
  return FIRST_LINE_RE.test(prose)
    ? prose.replace(FIRST_LINE_RE, (_, tag: string) => `<${tag}>${link}`)
    : link + prose;
}

export interface PageOptions {
  /** The project's name, for the breadcrumb and the title. */
  project: string;
  /** The page's repo path: `""` for the root, `src/` for a folder, `src/store.ts` for a file. */
  path: string;
  /** The file tree for the left rail (`rail.ts`). */
  rail: string;
  body: string;
  /** A `vscode://file/…` link for the file, or null for a folder. */
  editorLink: string | null;
  /** Whether the page shows a file's code, which the **Prose only** switch folds. The switch is
   *  on every page, in the same place, and disabled where there's no code to fold. */
  hasCode: boolean;
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
 * One stylesheet inline, the file tree on the left (`rail.ts`), a breadcrumb, and a few lines of
 * script: the **Prose & Code / Prose only** switch, remembered across pages and applied in
 * `<head>` so the page never flashes its code first, and each code run's header; the rail's open folders and scroll position, restored before the
 * first paint; the **Files** button that shows the rail on a narrow screen; and live reload. The server
 * tells a page when something it shows changed (`server.ts`), and it reloads, keeping its scroll
 * position. It listens only while visible, and says when it was rendered, so it catches up on
 * what changed while hidden. Browser storage can be unavailable, so it's only ever tried.
 */
export function page(options: PageOptions): string {
  const { project, path, rail, body, editorLink, hasCode } = options;
  const title = path ? `${path.replace(/\/$/, "").split("/").at(-1)} · ${project}` : project;
  const off = hasCode ? "" : ` disabled title="No code on this page"`;
  const mode = `<div class="mode" role="group" aria-label="View"><button type="button" data-mode="code" aria-pressed="true"${off}>Prose &amp; Code</button><button type="button" data-mode="prose" aria-pressed="false"${off}>Prose only</button></div>`;
  const editor = editorLink ? `<a href="${escapeHtml(editorLink)}">Open in editor</a>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
<script>try { if (localStorage.getItem("prose:mode") === "prose") document.documentElement.classList.add("prose-only"); } catch {}</script>
</head>
<body data-path="${escapeHtml(path)}" data-rendered="${Date.now()}">
<div class="layout">
${rail}
<script>${RAIL_SCRIPT}</script>
<div class="page">
<header class="bar"><div class="bar-start"><button type="button" class="rail-toggle" data-toggle-rail aria-label="Show files">Files</button><nav class="crumbs">${breadcrumb(project, path)}</nav></div><div class="bar-mode">${mode}</div><div class="bar-end">${editor}</div></header>
<main>${body}</main>
</div>
</div>
<script>${SCRIPT}</script>
<script type="speculationrules">${SPECULATION}</script>
</body>
</html>
`;
}

/** @prose
 * Links on the page are prerendered when the pointer rests on one (Chrome's speculation rules,
 * "moderate"), so a click in the rail or a listing shows a page that's already built. A
 * prerendered page doesn't connect for live reload until it's shown. Other browsers ignore it.
 */
const SPECULATION = JSON.stringify({
  prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
});

/** Runs straight after the rail, before the page paints, so its folders and scroll are back in
 *  place on the first frame instead of jumping after it. */
const RAIL_SCRIPT = `
{
	const rail = document.querySelector(".rail");
	try {
		const saved = JSON.parse(sessionStorage.getItem("prose:rail") || "null");
		if (saved) {
			for (const d of rail.querySelectorAll("details[data-folder]")) {
				if (saved.open.includes(d.dataset.folder)) d.open = true;
			}
			rail.scrollTop = saved.scroll;
		}
	} catch {}
	const current = rail.querySelector("[aria-current]");
	if (current) {
		const r = current.getBoundingClientRect();
		if (r.top < 0 || r.bottom > innerHeight) current.scrollIntoView({ block: "center" });
	}
	addEventListener("pagehide", () => {
		try {
			const open = [...rail.querySelectorAll("details[data-folder][open]")].map((d) => d.dataset.folder);
			sessionStorage.setItem("prose:rail", JSON.stringify({ open, scroll: rail.scrollTop }));
		} catch {}
	});
}
`;

const SCRIPT = `
const root = document.documentElement;
const runs = [...document.querySelectorAll(".code")];
const isOpen = (run) =>
	root.classList.contains("prose-only") ? run.classList.contains("opened") : !run.classList.contains("closed");
const sync = () => {
	const proseOnly = root.classList.contains("prose-only");
	for (const b of document.querySelectorAll("[data-mode]")) {
		b.setAttribute("aria-pressed", String((b.dataset.mode === "prose") === proseOnly));
	}
	for (const run of runs) run.querySelector(".code-head").setAttribute("aria-expanded", String(isOpen(run)));
};
for (const b of document.querySelectorAll("[data-mode]")) {
	b.addEventListener("click", () => {
		const proseOnly = b.dataset.mode === "prose";
		root.classList.toggle("prose-only", proseOnly);
		for (const run of runs) run.classList.remove("opened", "closed");
		try { localStorage.setItem("prose:mode", proseOnly ? "prose" : "code"); } catch {}
		sync();
	});
}
for (const run of runs) {
	run.querySelector(".code-head").addEventListener("click", () => {
		run.classList.toggle(root.classList.contains("prose-only") ? "opened" : "closed");
		sync();
	});
}
sync();
document.querySelector("[data-toggle-rail]").addEventListener("click", () => {
	document.body.classList.toggle("rail-open");
});
const key = "prose:scroll:" + location.pathname;
try {
	const y = sessionStorage.getItem(key);
	if (y !== null) { sessionStorage.removeItem(key); scrollTo(0, Number(y)); }
} catch {}
const here = document.body.dataset.path;
const since = document.body.dataset.rendered;
let events = null;
const connect = () => {
	if (events || document.hidden || document.prerendering) return;
	events = new EventSource("/.prose/events?path=" + encodeURIComponent(here) + "&since=" + since);
	events.onmessage = () => {
		try { sessionStorage.setItem(key, String(scrollY)); } catch {}
		location.reload();
	};
};
const disconnect = () => { events?.close(); events = null; };
document.addEventListener("visibilitychange", () => (document.hidden ? disconnect() : connect()));
document.addEventListener("prerenderingchange", connect);
addEventListener("pagehide", disconnect);
addEventListener("pageshow", connect);
connect();
`;
