import { createMarkdownExit } from "markdown-exit";

// `html: false` — prose bodies are code comments, not a place to accept raw HTML — and a fresh
// instance is cheap enough to not bother sharing across calls (spec §3.1: CommonMark + GFM).
const md = createMarkdownExit("default", { html: false, linkify: true });

/** Renders a prose block's Markdown body to HTML (spec §3.1: CommonMark + GFM). */
export function renderMarkdown(markdown: string): string {
	if (!markdown.trim()) return "";
	return md.render(markdown);
}
