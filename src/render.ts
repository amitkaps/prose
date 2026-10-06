/** @prose
 * # Pages as HTML
 *
 * Turns the tree's nodes into pages. A page is a folder, a Markdown file, a source file read as
 * one document, or a plain text file. Each is one HTML string, which links the stylesheet and
 * script every page shares ([assets.ts](assets.ts)).
 *
 * What each page shows is [reading](../docs/reading.md#pages). Markdown goes through markz, in
 * docs and in prose comments alike, and code goes through [highlight.ts](highlight.ts).
 */
import { html as markz, parse } from "@amitkaps/markz";
import { accentHue, favicon } from "./accent.js";
import { LIVE, SCRIPT, STYLE } from "./assets.js";
import modeScript from "./page/mode.js?built";
import shell from "./page/page.html?built";
import railScript from "./page/rail.js?built";
import { escapeHtml, highlight, markdownHtml } from "./highlight.js";
import { type NavItem, renderNav } from "./nav.js";
import type { ProseComment } from "./parser.js";
import { extensionOf, type TreeNode } from "./tree.js";

export function renderMarkdown(text: string): string {
  return text.trim() ? markdownHtml(parse(text)) : "";
}

/** A summary as inline HTML: its first paragraph rendered, without the wrapping `<p>`. */
function renderSummary(text: string): string {
  return markz(text)
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, "$1");
}

type Segment =
  | { kind: "comment"; comment: ProseComment }
  | { kind: "code"; text: string; line: number };

/** @prose
 * # A file, in order
 *
 * Lays a file out as it was written, with each comment's prose at the place the comment took and
 * the code between. The comment's own text is dropped, since the prose shows in its place. So the
 * whole file shows, and nothing repeats.
 *
 * Blank lines at the edges of each code run are trimmed, and a run of only whitespace
 * disappears. Each run keeps the line it starts on.
 */
export function segments(source: string, comments: ProseComment[]): Segment[] {
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
  for (const comment of [...comments].sort((a, b) => a.start - b.start)) {
    pushCode(at, comment.start);
    out.push({ kind: "comment", comment });
    at = comment.end;
  }
  pushCode(at, source.length);
  return out;
}

/** @prose
 * # A folder's listing
 *
 * What's in a folder, under its README, in three groups. **Folders** come first, then **Docs**,
 * then **Code**. Each group is a label, not an icon, with a row for each name and its summary.
 *
 * Files with no prose yet don't get a row each. They're named on one line at the end, **No prose
 * yet**. So coverage shows where you read, without a page full of *undocumented*. Files that
 * can't carry prose, like `LICENSE` or an image, are named on a last line, **Other files**.
 */
function renderListing(children: TreeNode[]): string {
  const href = (child: TreeNode) =>
    `/${child.path.split("/").map(encodeURIComponent).join("/")}${child.kind === "folder" ? "/" : ""}`;
  const link = (child: TreeNode) => {
    const name = child.path.split("/").at(-1)!;
    return `<a href="${escapeHtml(href(child))}">${escapeHtml(child.kind === "folder" ? `${name}/` : name)}</a>`;
  };
  const undocumented = (child: TreeNode) =>
    child.kind !== "raw" && (child.summary === "undocumented" || !child.summary);
  const documented = children.filter((child) => child.kind !== "raw" && !undocumented(child));
  const isDoc = (child: TreeNode) => child.kind === "file" && extensionOf(child.path) === "md";
  const group = (label: string, rows: TreeNode[]) =>
    rows.length
      ? `<section class="group"><p class="group-label">${label}</p><ul class="listing">${rows
          .map(
            (child) =>
              `<li class="${child.kind}">${link(child)}<p>${renderSummary(child.summary)}</p></li>`,
          )
          .join("")}</ul></section>`
      : "";
  const line = (label: string, rows: TreeNode[]) =>
    rows.length
      ? `<section class="group"><p class="group-label">${label}</p><p class="names">${rows
          .map(link)
          .join(`<span class="sep"> · </span>`)}</p></section>`
      : "";
  return [
    group(
      "Folders",
      documented.filter((child) => child.kind === "folder"),
    ),
    group("Docs", documented.filter(isDoc)),
    group(
      "Code",
      documented.filter((child) => child.kind !== "folder" && !isDoc(child)),
    ),
    line("No prose yet", children.filter(undocumented)),
    line(
      "Other files",
      children.filter((child) => child.kind === "raw"),
    ),
  ].join("");
}

/** A folder's README, its listing, and, on a local page, one line naming what `.gitignore`
 *  leaves out of it (`ignoredIn`): no links and no counts, since there's nothing there to read. */
export function folderBody(node: TreeNode, ignored: string[] = []): string {
  const readme = node.prose ? `<div class="prose">${renderMarkdown(node.prose)}</div>` : "";
  const names = ignored.map((name) => `<code>${escapeHtml(name)}</code>`).join(" ");
  const line = ignored.length ? `<p class="ignored">Ignored here: ${names}</p>` : "";
  return `${readme}${renderListing(node.children)}${line}`;
}

export function markdownBody(node: TreeNode): string {
  return `<div class="prose">${renderMarkdown(node.prose ?? "")}</div>`;
}

/** A file that isn't read for prose: one run, and what was cut from its end (`rawToNode`). */
export function rawBody(node: TreeNode): string {
  const more = node.more ? `<p class="more">… ${escapeHtml(node.more)}</p>` : "";
  return NO_PROSE + codeRun(node.code ?? "", extensionOf(node.path) || "text", 1) + more;
}

/** A binary file: what it is and how big, and an image shown. */
export function binaryBody(node: TreeNode): string {
  const image = node.image
    ? `<img class="binary-image" src="${node.image}" alt="${escapeHtml(node.path)}">`
    : "";
  return `<p class="binary">${escapeHtml(node.about ?? "")}</p>${image}`;
}

/** Shown in place of prose on a file that has none, so **Prose only** doesn't leave a bare header. */
const NO_PROSE = `<p class="no-prose">No prose in this file.</p>`;

/** @prose
 * # Code runs
 *
 * Each run of code sits in a panel with its own header. The header shows a chevron, how many
 * lines and which, and the language. It stays in both modes, so a prose-only page still shows
 * where the code is and how much. Clicking it opens or closes that one run, until the mode
 * changes.
 *
 * A screen reader hears the header as a button named "Code, 24 lines · 11–34 · ts". The word
 * _Code_ is there for it alone, since the panel says so by its look. It comes first, so the name
 * still holds the visible text, as WCAG asks of a control with a visible label.
 *
 * Line numbers are the file's own. The run knows the line it starts on, and a CSS counter
 * carries on from there, in a gutter as wide as the largest number. A file with no prose is one
 * run with the same header, and folds like any other.
 */
function codeRun(text: string, lang: string, startLine: number): string {
  const count = text.split("\n").length;
  const last = startLine + count - 1;
  const lines = `${count} line${count === 1 ? "" : "s"} · ${startLine}–${last}`;
  const head = `<button type="button" class="code-head" aria-expanded="true"><span class="chevron" aria-hidden="true"></span><span><span class="unseen">Code, </span>${lines}</span><span class="lang"><span class="sep"> · </span>${escapeHtml(lang)}</span></button>`;
  return `<div class="code" style="counter-reset: line ${startLine - 1}; --gutter: ${String(last).length}ch">${head}${highlight(text, lang)}</div>`;
}

/** @prose
 * # A source file as one document
 *
 * The file's first comment, then each later one in source order, with its code between them.
 * The first is the top of the page, and its headings stay as written. Every later comment's
 * headings go one level down (`demote`), so a comment can open with `#` and the file's title is
 * still the page's only `h1`. Code shows by default, and the page's **Prose only** switch folds
 * it (`page`). A file with no prose says so, above its code.
 *
 * A comment's link is its first heading's id, as markz makes it, so `src/store.ts#adding` lands
 * on `# Adding`. Each comment renders on its own, so `uniqueIds` makes a repeat on the page
 * unique in source order. The `#` beside that heading links to it. A later comment without a
 * heading has no link, and neither does the first, which is the page itself.
 */
export function sourceBody(node: TreeNode): string {
  const comments = node.comments ?? [];
  const lang = extensionOf(node.path) || "text";
  if (comments.length === 0) return NO_PROSE + codeRun(node.source ?? "", lang, 1);
  const used = new Set<string>();
  let first = true;
  const parts: string[] = [];
  for (const segment of segments(node.source ?? "", comments)) {
    if (segment.kind === "code") {
      parts.push(codeRun(segment.text, lang, segment.line));
      continue;
    }
    const rendered = renderMarkdown(segment.comment.body);
    const prose = uniqueIds(first ? rendered : demote(rendered), used);
    parts.push(
      `<section class="block"><div class="prose">${first ? prose : withAnchor(prose)}</div></section>`,
    );
    first = false;
  }
  return parts.join("");
}

/** A later comment's headings one level down, so the file's title is the page's only `h1`. */
function demote(html: string): string {
  return html.replace(
    /<(\/?)h([1-6])\b/g,
    (_, slash: string, level: string) => `<${slash}h${Math.min(6, Number(level) + 1)}`,
  );
}

const HEADING_ID_RE = /<(h[1-6]) id="([^"]+)">/g;

/** Gives each heading an id not yet `used` on the page, adding `-1`, `-2` to a repeat as markz
 *  does within one text. */
function uniqueIds(html: string, used: Set<string>): string {
  return html.replace(HEADING_ID_RE, (_, tag: string, id: string) => {
    let unique = id;
    for (let n = 1; used.has(unique); n++) unique = `${id}-${n}`;
    used.add(unique);
    return `<${tag} id="${unique}">`;
  });
}

/** Puts the `#` link to a comment's first heading inside that heading, on its line at its size. */
function withAnchor(prose: string): string {
  return prose.replace(
    /<(h[1-6]) id="([^"]+)">/,
    (_, tag: string, id: string) =>
      `<${tag} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>`,
  );
}

/** @prose
 * # On this page
 *
 * A long page's second- and third-level headings, as a table of contents. It sits beside the
 * text where the page is wide enough, and folds above it where it isn't. It's read from the page
 * as rendered, so a doc and a source file get the same one. A page with fewer than three headings
 * has none, since a short page is its own contents.
 *
 * It's in the HTML twice, once for each place, so it works without script. Moving one element by
 * script would need it. The page's script only marks the section being read (`TOC_SCRIPT`).
 */
const HEADING_RE = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;

export function tableOfContents(body: string): string {
  const entries: { level: number; id: string; text: string }[] = [];
  for (const match of body.matchAll(HEADING_RE)) {
    const id = match[2]!;
    const text = match[3]!
      .replace(/<a class="anchor"[^>]*>#<\/a>/, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) entries.push({ level: Number(match[1]), id, text });
  }
  if (entries.length < 3) return "";
  const list = `<ul>${entries
    .map(
      ({ level, id, text }) =>
        `<li class="toc-${level}"><a href="#${escapeHtml(id)}">${text}</a></li>`,
    )
    .join("")}</ul>`;
  return `<details class="toc toc-top"><summary>On this page</summary>${list}</details><nav class="toc toc-side" aria-label="On this page"><div><p>On this page</p>${list}</div></nav>`;
}

export interface PageOptions {
  /** The project's name, for the breadcrumb and the title. */
  project: string;
  /** The page's repo path: `""` for the root, `src/` for a folder, `src/store.ts` for a file. */
  path: string;
  /** The file tree for the right rail (`rail.ts`). */
  rail: string;
  body: string;
  /** A `vscode://file/…` link for the file, or null for a folder and on a built page. */
  editorLink: string | null;
  /** Whether the page shows a file's code, which the **Prose only** switch folds. The switch is
   *  on every page, in the same place, and disabled where there's no code to fold. */
  hasCode: boolean;
  /** Served by `prose .`: the page listens for changes and says when it was rendered. A built
   *  page (`prose build`) does neither, so the same commit always gives the same bytes. */
  live: boolean;
  /** A folder's page that shows its `README.md`, which the breadcrumb then ends in. */
  readme?: boolean;
  /** The docs linked in the bar (`nav.ts`). */
  nav?: NavItem[];
  /** The page's heading when its text has none. The file's or folder's name by default. */
  heading?: string;
}

/** The right-hand sidebar icon: a window with its right panel marked. */
const PANEL_ICON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 3v10" stroke="currentColor" stroke-width="1.5"/></svg>`;

/** @prose
 * # The breadcrumb
 *
 * The path from the project to the page, as GitHub writes it, like `prose / docs / design.md`.
 * It starts with the project's name on every page, the root's included, so the way back is
 * always there.
 *
 * A folder's page that shows its README ends in `README.md`, the row the tree highlights there.
 * So the page needs no line of its own to say where its text is from. Its text then starts at
 * the same height as every other page's.
 *
 * Every crumb is a link, the last one too. On a folder's page, the folder and its `README.md` are
 * the same page. One as a link and the other as plain text read as a difference that isn't
 * there. The last crumb is marked as the current page.
 */
function breadcrumb(project: string, path: string, readme: boolean): string {
  const segments = path.split("/").filter(Boolean);
  const hrefs = segments.map(
    (_, i) =>
      `/${segments
        .slice(0, i + 1)
        .map(encodeURIComponent)
        .join("/")}${i === segments.length - 1 && !path.endsWith("/") ? "" : "/"}`,
  );
  const crumbs: [string, string][] = [
    [project, "/"],
    ...segments.map((segment, i): [string, string] => [segment, hrefs[i]!]),
  ];
  if (readme) crumbs.push(["README.md", hrefs.at(-1) ?? "/"]);
  return crumbs
    .map(
      ([label, href], i) =>
        `<a href="${escapeHtml(href)}"${i === crumbs.length - 1 ? ` aria-current="page"` : ""}>${escapeHtml(label)}</a>`,
    )
    .join(`<span class="sep">/</span>`);
}

/** @prose
 * # The page shell
 *
 * Every page has the same frame around its body. The reading column is on the left, with the
 * breadcrumb above its text and **Open in editor** at the breadcrumb's end. The file tree is on
 * the right ([rail.ts](rail.ts)).
 *
 * The bar holds the project's name, the docs' links ([nav.ts](nav.ts)), the mode switch and the
 * tree's toggle. The toggle is a checkbox and its label when the tree is docked, and a popover
 * button when it isn't. So showing and hiding the tree needs only CSS and HTML.
 *
 * The stylesheet and the page's script are shared files ([assets.ts](assets.ts)), so a page
 * carries only its own HTML. Two short scripts stay inline, because each must run before the
 * first paint.
 *
 * - The **Prose & Code / Prose only** switch is remembered across pages. It's applied in `<head>`,
 *   so the page never flashes its code first.
 * - The rail's open folders and scroll position are restored straight after the rail, so they
 *   don't jump after the first frame.
 *
 * The shared script opens and closes each code run, and marks the section being read. On a page
 * `prose .` serves, a second file adds live reload. The server tells a page when something it
 * shows has changed ([server.ts](server.ts)), and the page reloads, keeping its scroll position.
 * It listens only while visible, and says when it was rendered, so it catches up on what changed
 * while hidden.
 *
 * Browser storage can be unavailable, so the scripts only ever try it.
 */
export function page(options: PageOptions): string {
  const { project, path, rail, editorLink, hasCode, live, readme = false, nav = [] } = options;
  const body = withHeading(options.body, options.heading ?? pageName(project, path));
  const hue = accentHue(project);
  const off = hasCode ? "" : ` disabled title="No code on this page"`;
  const mode = `<div class="mode" role="group" aria-label="View"><button type="button" data-mode="code" aria-pressed="true"${off}>Prose &amp; Code</button><button type="button" data-mode="prose" aria-pressed="false"${off}>Prose only</button></div>`;
  const end = editorLink
    ? `<a class="editor" href="${escapeHtml(editorLink)}">Open in editor</a>`
    : "";
  const slots: Record<string, string> = {
    accent: `style="--accent-h: ${hue}"`,
    title: pageTitle(project, path, body),
    favicon: escapeHtml(favicon(project, hue)),
    style: STYLE.url,
    script: SCRIPT.url,
    "live-script": live ? `<script defer src="${LIVE.url}"></script>` : "",
    "mode-script": inlineScript(modeScript),
    path: escapeHtml(path),
    rendered: live ? `data-rendered="${Date.now()}"` : "",
    project: escapeHtml(project),
    nav: renderNav(nav, path),
    mode,
    icon: PANEL_ICON,
    "main-class": hasCode ? `class="has-code"` : "",
    crumbs: breadcrumb(project, path, readme),
    editor: end,
    toc: tableOfContents(body),
    body,
    rail,
    "rail-script": inlineScript(railScript),
    speculation: `<script type="speculationrules">${SPECULATION}</script>`,
  };
  // One pass, so a slot's value is never searched for slots itself.
  return shell.replace(
    /( ?)\{\{([\w-]+)\}\}/g,
    (_, space: string, name: string, at: number, text: string) => {
      const value = slots[name];
      if (value === undefined) throw new Error(`page.html has no value for {{${name}}}`);
      if (!value) return "";
      if (!value.startsWith(INLINE)) return space + value;
      // A script's lines line up under its slot. Nothing else is indented, since a `<pre>` would
      // show the extra spaces.
      const indent = /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", at) + 1))![0];
      return space + value.slice(INLINE.length).replaceAll("\n", `\n${indent}`);
    },
  );
}

/** @prose
 * ## The tab's title
 *
 * The page's name, then the project's, like `store.ts | prose`. A doc goes by its title, since
 * that's what its reader knows it by. A source file goes by its name, which is how a tab is found
 * among files. A folder keeps its trailing slash, so `src/` and a file called `src` differ.
 *
 * A pipe separates the two. A middle dot was tried, and it's too faint to see in a narrow tab.
 */
function pageTitle(project: string, path: string, body: string): string {
  if (!path) return escapeHtml(project);
  // The heading is already HTML, so only its tags and its anchor are taken out.
  const heading = path.endsWith(".md")
    ? /<h1\b[^>]*>([\s\S]*?)<\/h1>/
        .exec(body)?.[1]
        ?.replace(/<a class="anchor"[^>]*>#<\/a>/, "")
        .replace(/<[^>]+>/g, "")
        .trim()
    : "";
  return `${heading || escapeHtml(pageName(project, path))} | ${escapeHtml(project)}`;
}

/** A page's name: the file's, the folder's with its slash, or the project's at the root. */
function pageName(project: string, path: string): string {
  if (!path) return project;
  const name = path.replace(/\/$/, "").split("/").at(-1)!;
  return path.endsWith("/") ? `${name}/` : name;
}

/** @prose
 * ## A title on every page
 *
 * Every page has one `h1`, so a screen reader's list of headings starts with what the page is. A
 * page whose text has none gets its name as a visible one. That's a file with no prose or no
 * heading, like `package.json`, a folder without a README, like `.github/`, and the 404 page.
 *
 * It's shown, not hidden for screen readers alone. A page that says what it is helps every
 * reader, and a source page already opens with its title when its prose has one.
 */
function withHeading(body: string, name: string): string {
  if (/<h1\b/.test(body)) return body;
  return `<div class="prose"><h1>${escapeHtml(name)}</h1></div>${body}`;
}

/** Marks a slot value as an inline script, so `page` indents it. */
const INLINE = "\0inline";

function inlineScript(code: string): string {
  const body = code.trimEnd().replaceAll("\n", "\n  ");
  return `${INLINE}<script>\n  ${body}\n</script>`;
}

/** @prose
 * # Prerendering links
 *
 * A link is prerendered when the pointer rests on it, with Chrome's speculation rules. So a click
 * in the rail or a listing shows a page that's already built. A prerendered page doesn't connect
 * for live reload until it's shown. Other browsers ignore the rules.
 */
const SPECULATION = JSON.stringify({
  prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
});
