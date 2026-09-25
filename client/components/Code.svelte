<script lang="ts">
	/** @prose
	 * A highlighted code block. Highlighting is async (the highlighter loads lazily), so plain text
	 * shows first, and on a live update the previous highlighted HTML stays until the new one is
	 * ready, avoiding a flash of unstyled code. The `stale` flag drops a result that a newer
	 * `code` has already superseded.
	 */
	import { langForPath, renderCode } from "../highlight.js";

	let { code, path }: { code: string; path: string } = $props();
	let html = $state("");

	$effect(() => {
		let stale = false;
		void renderCode(code, langForPath(path)).then((rendered) => {
			if (!stale) html = rendered;
		});
		return () => {
			stale = true;
		};
	});
</script>

{#if html}
	{@html html}
{:else}
	<pre class="plain-code"><code>{code}</code></pre>
{/if}
