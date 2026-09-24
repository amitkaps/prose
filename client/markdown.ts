/** @prose
 * Renders a prose block's Markdown body to HTML — real CommonMark + GFM via `markdown-exit`
 * (spec §3.1), not the hand-rolled headings/paragraphs/bold/links pass this used to be. That
 * pass silently mangled any prose using a list, a table, or a fenced code block; it wasn't
 * hypothetical — `examples/base`'s own content docs already used all three and rendered garbled
 * under it. `html: false` — prose bodies are code comments, not a place to accept raw HTML — and
 * one shared instance is fine since `markdown-exit` doesn't carry render-to-render state here
 * (unlike `examples/base`'s own `docs.ts`, which needs a fresh instance per doc for
 * heading-id uniqueness — a different renderer, different constraint).
 */
import { createMarkdownExit } from "markdown-exit";

const md = createMarkdownExit("default", { html: false, linkify: true });

export function renderMarkdown(markdown: string): string {
	if (!markdown.trim()) return "";
	return md.render(markdown);
}
