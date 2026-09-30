/** @prose
 * # The stylesheet
 *
 * The file tree on the left, then one readable column, light and dark from the reader's setting.
 * Prose is the page and code is the aside: code sits folded in a quieter panel, so a file reads as
 * its prose first. Every page shares one centre line: prose keeps the reading measure, and code
 * runs widen to 100 columns, oxfmt's print width, equally on both sides, so code wraps only on a
 * narrow window and prose never moves between a doc and a source file. Below
 * 52rem the tree hides behind the **Files** button, over the page, and the editor link goes.
 *
 * Code takes its colours from the same tokens: shiki's CSS-variables theme names each token's
 * colour (`--shiki-token-keyword`), and the palette below sets them, for light and for dark, in
 * the page's warm ink. Lines wrap with a hanging indent rather than scroll, tabs are two columns,
 * and file line numbers sit in a gutter that isn't copied with the code. Moving between pages is
 * a cross-document view transition with the rail held still, so only the page changes.
 */
export const STYLE = `
:root {
	color-scheme: light dark;
	--ink: #1f2328;
	--muted: #59636e;
	--paper: #fdfcfa;
	--panel: #f4f2ee;
	--rule: #e3e0da;
	--link: #9c4221;
	--selection: color-mix(in srgb, #c47a2c 28%, transparent);
	--accent: #9a6700;
	--measure: 44rem;
	--rail: 16rem;
	/* 100 columns of code (oxfmt's print width), plus a gutter and padding, in the code font. */
	--code-width: 60rem;
	--gutter-ink: color-mix(in srgb, var(--muted) 70%, var(--panel));
	--shiki-foreground: #2f2c27;
	--shiki-background: var(--panel);
	--shiki-token-comment: #8c8577;
	--shiki-token-keyword: #9c4221;
	--shiki-token-string: #4d7030;
	--shiki-token-string-expression: #4d7030;
	--shiki-token-function: #25589c;
	--shiki-token-constant: #7d4c98;
	--shiki-token-parameter: #2f2c27;
	--shiki-token-punctuation: #6f695e;
	--shiki-token-link: #25589c;
	--shiki-token-inserted: #4d7030;
	--shiki-token-deleted: #9c4221;
	--shiki-token-changed: #9a6700;
	font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
	line-height: 1.6;
}
@media (prefers-color-scheme: dark) {
	:root {
		--ink: #e6e3dd;
		--muted: #9d978c;
		--paper: #1a1917;
		--panel: #23221f;
		--rule: #34322e;
		--link: #e6a57c;
		--selection: color-mix(in srgb, #e3b341 26%, transparent);
		--accent: #e3b341;
		--shiki-foreground: #e6e3dd;
		--shiki-token-comment: #8f887c;
		--shiki-token-keyword: #e0976b;
		--shiki-token-string: #a8c282;
		--shiki-token-string-expression: #a8c282;
		--shiki-token-function: #8fb7e6;
		--shiki-token-constant: #c9a2dc;
		--shiki-token-parameter: #e6e3dd;
		--shiki-token-punctuation: #a39c90;
		--shiki-token-link: #8fb7e6;
		--shiki-token-inserted: #a8c282;
		--shiki-token-deleted: #e0976b;
		--shiki-token-changed: #e3b341;
	}
}
@view-transition { navigation: auto; }
.rail { view-transition-name: rail; }
::view-transition-old(rail), ::view-transition-new(rail) { animation: none; }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 0.12s; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); }
a { color: var(--link); text-decoration-thickness: 1px; text-underline-offset: 2px; }
::selection { background: var(--selection); }
.layout { display: grid; grid-template-columns: var(--rail) minmax(0, 1fr); min-height: 100vh; }
.rail {
	position: sticky; top: 0; height: 100vh; overflow-y: auto;
	padding: 0.75rem 0 2rem; border-right: 1px solid var(--rule); background: var(--panel);
	font-size: 0.82rem; line-height: 1.35;
	--edge: 0.9rem;
	--step: 1rem;
	--twisty: 0.9rem;
	--gap: 0.35rem;
}
/* Rows span the rail's full width, so a highlight does too; each indents itself by its depth.
   A folder's chevron sits under the start of its parent's name, and a file leaves the chevron's
   slot empty, so names at one level line up, and the top-level chevrons line up with the
   project's name. */
.rail ul { list-style: none; margin: 0; padding: 0; }
.rail a { color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.rail .rail-project { display: block; padding: 0.2rem var(--edge); margin-bottom: 0.4rem; font-weight: 600; }
.rail a.file, .rail summary {
	display: flex; align-items: center; gap: var(--gap);
	padding: 0.2rem var(--edge) 0.2rem calc(var(--edge) + var(--depth) * var(--step));
}
.rail a.file { padding-left: calc(var(--edge) + var(--depth) * var(--step) + var(--twisty) + var(--gap)); }
.rail a.file:hover, .rail summary:hover, .rail .rail-project:hover { background: var(--rule); }
.rail [aria-current] { background: var(--rule); font-weight: 600; }
.rail summary { cursor: pointer; list-style: none; }
.rail summary a { flex: 1; }
.rail summary::-webkit-details-marker { display: none; }
.rail summary::before {
	content: ""; flex: none; width: var(--twisty); height: var(--twisty);
	background: currentColor; opacity: 0.6;
	mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6 4l4 4-4 4' fill='none' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") center / contain no-repeat;
	transition: transform 0.1s;
}
.rail details[open] > summary::before { transform: rotate(90deg); }
.rail-toggle { display: none; }
@media (max-width: 52rem) {
	.layout { grid-template-columns: minmax(0, 1fr); }
	.rail {
		display: none; position: fixed; inset: 0 auto 0 0; z-index: 2;
		width: min(20rem, 85vw); box-shadow: 0 0 2rem rgb(0 0 0 / 0.25);
	}
	.rail-open .rail { display: block; }
	.rail-toggle { display: inline-block; }
	.bar { grid-template-columns: minmax(0, 1fr) auto; }
	.bar-end { display: none; }
	main { padding-top: 1rem; }
}
.bar {
	position: sticky; top: 0; z-index: 1;
	display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 1rem; align-items: center;
	min-height: 3.25rem; padding: 0.5rem 1rem; background: var(--paper); border-bottom: 1px solid var(--rule);
	font-size: 0.9rem;
}
.page { min-width: 0; }
.bar-start { display: flex; gap: 0.75rem; align-items: center; min-width: 0; }
.bar-end { justify-self: end; white-space: nowrap; }
.crumbs { min-width: 0; overflow-wrap: anywhere; }
.crumbs .sep { color: var(--muted); margin: 0 0.35rem; }
.crumbs [aria-current] { font-weight: 600; }
.rail-toggle {
	font: inherit; color: var(--ink); background: var(--panel);
	border: 1px solid var(--rule); border-radius: 6px; padding: 0.2rem 0.6rem; cursor: pointer;
}
.mode {
	display: inline-flex; padding: 2px; gap: 2px;
	background: var(--panel); border: 1px solid var(--rule); border-radius: 7px;
}
.mode button {
	font: inherit; font-size: 0.85rem; color: var(--muted); background: none;
	border: 0; border-radius: 5px; padding: 0.15rem 0.7rem; cursor: pointer; white-space: nowrap;
}
.mode button:hover { color: var(--ink); }
.mode button:disabled { cursor: default; color: var(--muted); background: none; opacity: 0.6; }
.no-prose { color: var(--muted); font-style: italic; margin-block: 0 0.5rem; }
:root:not(.prose-only) .mode [data-mode="code"], .prose-only .mode [data-mode="prose"] {
	background: var(--rule); color: var(--ink);
}
/* One centre line on every page: prose at the reading measure, code wider on both sides of it. */
main { max-width: calc(var(--code-width) + 2rem); margin: 0 auto; padding: 1.5rem 1rem 4rem; }
main > * { max-width: var(--measure); margin-inline: auto; }
.prose { overflow-wrap: anywhere; }
.prose h1, .prose h2, .prose h3 { line-height: 1.25; text-wrap: balance; }
.prose h1 { font-size: 1.75rem; }
.prose h2 { font-size: 1.35rem; margin-top: 2rem; }
.prose h3 { font-size: 1.1rem; }
.prose p, .prose li { text-wrap: pretty; }
.prose :not(pre) > code {
	font-size: 0.88em; background: var(--panel); border-radius: 4px; padding: 0.1em 0.3em;
}
.prose table { border-collapse: collapse; display: block; overflow-x: auto; }
.prose th, .prose td { border: 1px solid var(--rule); padding: 0.3rem 0.6rem; text-align: left; }
.prose blockquote { margin: 0; padding-left: 1rem; border-left: 3px solid var(--rule); color: var(--muted); }
pre.shiki {
	margin: 0.75rem 0; padding: 0.75rem 1rem; border-radius: 8px;
	font-size: 0.85rem; line-height: 1.5; tab-size: 2;
}
pre.shiki code { display: block; white-space: normal; }
pre.shiki .line {
	display: block; min-height: 1lh; white-space: pre-wrap; overflow-wrap: anywhere;
	padding-left: 2ch; text-indent: -2ch;
}
.code {
	margin: 0.5rem auto 1.25rem; border-radius: 8px; overflow: hidden;
	background: var(--shiki-background); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
	font-size: 0.85rem; max-width: calc(100ch + var(--gutter) + 5ch + 2rem);
}
.code pre.shiki { margin: 0; border-radius: 0; font-size: 1em; }
.code pre.shiki .line { position: relative; padding-left: calc(var(--gutter) + 5ch); }
.code pre.shiki .line::before {
	counter-increment: line; content: counter(line);
	position: absolute; left: 0; width: var(--gutter); text-indent: 0; text-align: right;
	color: var(--gutter-ink); user-select: none;
}
.code-head {
	display: flex; width: 100%; align-items: center; gap: 0.6rem;
	font: inherit; color: var(--gutter-ink); background: none; border: 0;
	border-bottom: 1px solid var(--rule); padding: 0.45rem 1rem; cursor: pointer; text-align: left;
}
.code-head:hover { color: var(--ink); }
.code-head .lang { margin-left: auto; }
.code-head .chevron {
	width: 0.9em; height: 0.9em; flex: none; background: currentColor; transform: rotate(90deg);
	mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6 4l4 4-4 4' fill='none' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") center / contain no-repeat;
	transition: transform 0.1s;
}
:root:not(.prose-only) .code.closed pre, .prose-only .code:not(.opened) pre { display: none; }
:root:not(.prose-only) .code.closed .code-head, .prose-only .code:not(.opened) .code-head { border-bottom-color: transparent; }
:root:not(.prose-only) .code.closed .chevron, .prose-only .code:not(.opened) .chevron { transform: none; }
code, pre { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.block { position: relative; margin: 1.5rem auto 0.5rem; scroll-margin-top: 4rem; }
/* No top or left: an absolute box keeps its place in the line, so the # sits on the heading's
   baseline at the heading's size, and is moved into the margin from there. */
.block .anchor {
	position: absolute; translate: calc(-100% - 1.25rem); font-weight: 400;
	color: var(--muted); text-decoration: none; opacity: 0;
}
.block:hover .anchor, .block .anchor:focus { opacity: 1; }
.block > .prose > :first-child { margin-top: 0; }
.block .pending-mark { margin: 0.25rem 0 0; font-size: 0.8rem; }
.block.pending::before {
	content: ""; position: absolute; left: -0.75rem; top: 0; bottom: 0;
	border-left: 3px dashed var(--accent);
}
.block .pending-mark { color: var(--accent); font-weight: 600; }
.listing { list-style: none; padding: 0; margin: 1.5rem auto; border-top: 1px solid var(--rule); }
.listing li { padding: 0.6rem 0; border-bottom: 1px solid var(--rule); }
.listing li > a { font-weight: 600; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.92rem; }
.listing li.folder > a { color: var(--ink); }
.listing p { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.92rem; }
.undocumented { font-style: italic; }
.missing { color: var(--muted); }
`;
