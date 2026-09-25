<script lang="ts">
	/** @prose
	 * The path from the project root to the current node, every ancestor a link to that ancestor,
	 * like a file browser's path bar. The current node is plain text, prefixed with its kind.
	 */
	import { label } from "../nav.js";
	import { hrefFor, store } from "../store.svelte.js";
</script>

<nav class="breadcrumb" aria-label="Breadcrumb">
	{#if store.node}<span class="crumb-kind">{store.node.kind}</span>{/if}
	{#each store.chain as crumb, i (crumb.path)}
		{#if i > 0}<span class="crumb-sep" aria-hidden="true">/</span>{/if}
		{#if i < store.chain.length - 1}
			<a href={hrefFor(crumb.path)}>{label(crumb)}</a>
		{:else}
			<span aria-current="page">{label(crumb)}</span>
		{/if}
	{/each}
</nav>
