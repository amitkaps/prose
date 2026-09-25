<script lang="ts">
	/** @prose
	 * The navigation rail: the tree from the project down, with a button that opens the quick-jump
	 * palette. Before the first tree arrives it shows skeleton bars rather than an empty column.
	 */
	import RailItem from "./RailItem.svelte";
	import { store } from "../store.svelte.js";
</script>

<nav id="rail" aria-label="Prose navigation">
	<button type="button" class="jump" onclick={() => (store.paletteOpen = true)}>
		<span>Jump to…</span><kbd>/</kbd>
	</button>
	{#if store.tree}
		<ul>
			<RailItem node={store.tree} depth={0} />
		</ul>
	{:else if !store.error}
		<div class="skeleton" aria-hidden="true">
			<span></span><span></span><span></span><span></span>
		</div>
	{/if}
</nav>
