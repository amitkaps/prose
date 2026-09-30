/** @prose
 * # The stylesheet
 *
 * The file tree on the left, then one readable column, light and dark from the reader's setting.
 * Prose is the page and code is the aside: code sits folded in a quieter panel, so a file reads as
 * its prose first. Below 52rem the tree hides behind the **Files** button, over the page.
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
	--link: #0b5cad;
	--accent: #9a6700;
	--measure: 44rem;
	--rail: 16rem;
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
		--link: #7cb7ff;
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
.layout { display: grid; grid-template-columns: var(--rail) minmax(0, 1fr); min-height: 100vh; }
.rail {
	position: sticky; top: 0; height: 100vh; overflow-y: auto;
	padding: 0.75rem 0.5rem 2rem 1.1rem; border-right: 1px solid var(--rule); background: var(--panel);
	font-size: 0.82rem; line-height: 1.35;
}
.rail ul { list-style: none; margin: 0; padding: 0 0 0 0.75rem; }
.rail > ul { padding-left: 0; }
.rail a {
	display: block; padding: 0.2rem 0.4rem; border-radius: 4px;
	color: var(--ink); text-decoration: none; overflow-wrap: anywhere;
}
.rail a:hover { background: var(--rule); }
.rail a[aria-current] { background: var(--rule); font-weight: 600; }
.rail .rail-project { font-weight: 600; margin-bottom: 0.4rem; }
.rail a.file { color: var(--muted); }
.rail a.file[aria-current] { color: var(--ink); }
.rail summary { display: flex; align-items: center; cursor: pointer; list-style: none; }
.rail summary::-webkit-details-marker { display: none; }
.rail summary::before {
	content: ""; flex: none; width: 0.9rem; height: 0.9rem; margin-left: -0.9rem;
	background: currentColor; opacity: 0.5;
	mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6 4l4 4-4 4' fill='none' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") center / contain no-repeat;
	transition: transform 0.1s;
}
.rail details[open] > summary::before { transform: rotate(90deg); }
.rail summary a { flex: 1; }
.rail-toggle { display: none; }
@media (max-width: 52rem) {
	.layout { grid-template-columns: minmax(0, 1fr); }
	.rail {
		display: none; position: fixed; inset: 0 auto 0 0; z-index: 2;
		width: min(20rem, 85vw); box-shadow: 0 0 2rem rgb(0 0 0 / 0.25);
	}
	.rail-open .rail { display: block; }
	.rail-toggle { display: inline-block; }
	.actions a { display: none; }
	main { padding-top: 1rem; }
}
.bar {
	position: sticky; top: 0; z-index: 1;
	display: flex; gap: 1rem; align-items: center; justify-content: space-between;
	padding: 0.6rem 1rem; background: var(--paper); border-bottom: 1px solid var(--rule);
	font-size: 0.9rem;
}
.page { min-width: 0; }
.crumbs { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.crumbs .sep { color: var(--muted); margin: 0 0.35rem; }
.crumbs [aria-current] { font-weight: 600; }
.actions { display: flex; gap: 0.75rem; align-items: center; flex-shrink: 0; }
.actions button, .rail-toggle {
	font: inherit; color: var(--ink); background: var(--panel);
	border: 1px solid var(--rule); border-radius: 6px; padding: 0.2rem 0.6rem; cursor: pointer;
}
main { max-width: var(--measure); margin: 0 auto; padding: 1.5rem 1rem 4rem; }
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
.code pre.shiki .line { position: relative; padding-left: calc(var(--gutter) + 3.5ch); }
.code pre.shiki .line::before {
	counter-increment: line; content: counter(line);
	position: absolute; left: 0; width: var(--gutter); text-indent: 0; text-align: right;
	color: var(--muted); opacity: 0.6; user-select: none;
}
.code { margin: 0.5rem 0 1rem; }
.code-fold {
	display: none; font: inherit; font-size: 0.8rem; color: var(--muted); cursor: pointer;
	padding: 0.2rem 0.6rem; background: var(--panel); border: 1px solid var(--rule); border-radius: 6px;
}
.prose-only .code-fold { display: inline-block; }
.prose-only .code:not(.shown):not(.solo) pre { display: none; }
.actions [aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
code, pre { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.block { position: relative; margin: 1.5rem 0 0.5rem; scroll-margin-top: 4rem; }
.block .anchor {
	position: absolute; left: -1.25rem; top: 0; width: 1rem; text-align: center;
	color: var(--muted); text-decoration: none; opacity: 0;
}
.block:hover .anchor, .block .anchor:focus { opacity: 1; }
.block > .prose > :first-child { margin-top: 0; }
.block .pending-mark { margin: 0.25rem 0 0; font-size: 0.8rem; }
.block.pending { border-left: 3px dashed var(--accent); padding-left: 0.9rem; }
.block .pending-mark { color: var(--accent); font-weight: 600; }
.listing { list-style: none; padding: 0; margin: 1.5rem 0; border-top: 1px solid var(--rule); }
.listing li { padding: 0.6rem 0; border-bottom: 1px solid var(--rule); }
.listing li > a { font-weight: 600; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.92rem; }
.listing li.folder > a { color: var(--ink); }
.listing p { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.92rem; }
.undocumented { font-style: italic; }
.missing { color: var(--muted); }
`;
