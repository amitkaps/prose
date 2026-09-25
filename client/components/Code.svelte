<script lang="ts">
	/** @prose
	 * A highlighted code block. Highlighting is async (the highlighter loads lazily), so plain text
	 * shows first, and on a live update the previous highlighted HTML stays until the new one is
	 * ready, avoiding a flash of unstyled code. The `stale` flag drops a result that a newer
	 * `code` has already superseded.
	 *
	 * A block that can take notes (`noteable`) gets a gutter button on every line, injected into
	 * shiki's `<span class="line">` elements. Picking one splits the block at that line, so the
	 * editor (`LineNoteEditor`) opens directly under it and the code carries on below. The buttons
	 * take no tab stop: hundreds of lines would be hundreds of stops, and keyboard navigation is
	 * still open (spec §6.1).
	 */
	import { langForPath, renderCode } from "../highlight.js";
	import LineNoteEditor from "./LineNoteEditor.svelte";

	let {
		code,
		path,
		startLine = 1,
		noteable = false,
	}: { code: string; path: string; startLine?: number; noteable?: boolean } = $props();
	let html = $state("");
	let picked: number | null = $state(null);

	$effect(() => {
		let stale = false;
		void renderCode(code, langForPath(path)).then((rendered) => {
			if (!stale) html = rendered;
		});
		return () => {
			stale = true;
		};
	});

	/** shiki's `<pre ...><code>` + one `<span class="line">` per line, joined by newlines +
	 *  `</code></pre>`: split into those parts, or `null` for anything else (the plain fallback). */
	const parts = $derived.by(() => {
		const match = /^(<pre[^>]*><code>)([\s\S]*)(<\/code><\/pre>)$/.exec(html);
		if (!match || !noteable) return null;
		const lines = match[2]
			.split("\n")
			.map((line, i) =>
				line.replace(
					/^<span class="line">/,
					`<span class="line"><button type="button" class="line-add" tabindex="-1" data-line="${startLine + i}" aria-label="Add a note on line ${startLine + i}"></button>`,
				),
			);
		return { open: match[1], close: match[3], lines };
	});

	const pick = (event: MouseEvent) => {
		const button = (event.target as HTMLElement).closest<HTMLElement>(".line-add");
		if (button) picked = Number(button.dataset.line) - startLine;
	};
	const wrap = (lines: string[]) => (parts ? parts.open + lines.join("\n") + parts.close : "");
</script>

{#if parts}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div onclick={pick}>
		{#if picked !== null && picked < parts.lines.length}
			{@html wrap(parts.lines.slice(0, picked + 1))}
			<LineNoteEditor
				{path}
				line={startLine + picked}
				text={code.split("\n")[picked]}
				onclose={() => (picked = null)}
			/>
			{#if picked + 1 < parts.lines.length}{@html wrap(parts.lines.slice(picked + 1))}{/if}
		{:else}
			{@html wrap(parts.lines)}
		{/if}
	</div>
{:else if html}
	{@html html}
{:else}
	<pre class="plain-code"><code>{code}</code></pre>
{/if}
