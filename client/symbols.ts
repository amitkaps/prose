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
import type { TreeNode } from "./nav.js";

export function annotateSymbols(html: string, symbols: TreeNode["symbols"]): string {
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
