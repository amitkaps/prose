/** @prose
 * # Syntax highlighting
 *
 * Goes through `shiki/core`'s fine-grained bundle, not the main `shiki` entry point: the main
 * entry ships every language and theme it knows about (a `codeToHtml` call with a runtime-computed
 * `lang` can't be statically narrowed by the bundler, so every grammar stays reachable as a
 * separate chunk — hundreds of files, mostly never fetched). Only the languages this tool needs
 * (`SHIKI_LANG`'s distinct values) are imported, by name, and the one theme is `github-dark`, which
 * the stylesheet's `--code-bg` is built around. The highlighter is created lazily on first use and
 * memoized, so it stays out of the initial page load.
 */
import githubDark from "@shikijs/themes/github-dark";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

const SHIKI_LANG: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	css: "css",
	html: "html",
	md: "markdown",
	svelte: "svelte",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	json: "json",
	jsonc: "jsonc",
};

export function langForPath(path: string): string {
	const filePart = path.split("#")[0]!;
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
			import("@shikijs/langs/yaml"),
			import("@shikijs/langs/toml"),
			import("@shikijs/langs/json"),
			import("@shikijs/langs/jsonc"),
		],
		engine: createOnigurumaEngine(import("shiki/wasm")),
	});
	return highlighterPromise;
}

export function escapeHtml(code: string): string {
	return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function renderCode(code: string, lang: string): Promise<string> {
	try {
		const highlighter = await getHighlighter();
		return highlighter.codeToHtml(code, { lang, theme: "github-dark" });
	} catch {
		return `<pre class="plain-code"><code>${escapeHtml(code)}</code></pre>`;
	}
}
