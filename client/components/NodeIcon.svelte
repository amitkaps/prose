<script lang="ts">
	/** @prose
	 * A small inline icon per node kind, in the manner of an editor's explorer: folders and the
	 * project get a folder, files a page, raw (JSON) files braces. Drawn as inline SVG in `currentColor`, so the stylesheet colours them per kind.
	 */
	import type { TreeNode } from "../nav.js";

	let { kind }: { kind: TreeNode["kind"] } = $props();
</script>

<svg
	class={`icon icon-${kind}`}
	viewBox="0 0 16 16"
	width="16"
	height="16"
	aria-hidden="true"
	fill="none"
	stroke="currentColor"
	stroke-width="1.2"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if kind === "folder" || kind === "project"}
		<path
			d="M1.5 4.5a1 1 0 0 1 1-1h3.2l1.3 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
			fill="currentColor"
			stroke="none"
		/>
	{:else if kind === "raw"}
		<path
			d="M6 3C4.5 3 4.5 4.5 4.5 6S4 7.8 3 8c1 .2 1.5.5 1.5 2s0 3 1.5 3M10 3c1.5 0 1.5 1.5 1.5 3S12 7.8 13 8c-1 .2-1.5.5-1.5 2s0 3-1.5 3"
		/>
	{:else}
		<path
			d="M4 1.5h5l3.5 3.5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 4 1.5zM9 1.5V5h3.5"
		/>
	{/if}
</svg>
