<script lang="ts">
	/** @prose
	 * # The main pane
	 *
	 * Shows the node the URL points at, at its own level (spec §6.1): breadcrumb, title, warnings, the
	 * note, its prose, then what is specific to its kind: a chunk's code (or "pending, no code yet"),
	 * the file's whole source, open, a raw file's text, the project's health panel; and finally its
	 * children as summaries. Before the tree arrives it shows a skeleton, and a failed connection shows
	 * its message with a retry, never a blank page.
	 */
	import Breadcrumb from "./Breadcrumb.svelte";
	import Children from "./Children.svelte";
	import Code from "./Code.svelte";
	import CopyLink from "./CopyLink.svelte";
	import Health from "./Health.svelte";
	import FileView from "./FileView.svelte";
	import { renderMarkdown } from "../markdown.js";
	import { health } from "../stats.js";
	import { annotateSymbols } from "../symbols.js";
	import { store } from "../store.svelte.js";

	const node = $derived(store.node);
	const prose = $derived(
		node?.prose ? annotateSymbols(renderMarkdown(node.prose), node.symbols) : "",
	);
	const projectHealth = $derived(
		store.tree && node?.kind === "project" ? health(store.tree) : null,
	);

	// A new node starts at the top rather than keeping the previous node's scroll position, unless
	// the URL names a block, which the file view scrolls to instead.
	$effect(() => {
		void store.path;
		if (!store.focus) window.scrollTo(0, 0);
	});
</script>

<main id="pane">
	{#if store.error}
		<div class="load-error" role="alert">
			<p>Prose failed to load: {store.error} (see console)</p>
			<button type="button" onclick={() => location.reload()}>Retry</button>
		</div>
	{:else if !node}
		<div class="skeleton" aria-busy="true" aria-label="Loading">
			<span></span><span></span><span></span><span></span><span></span>
		</div>
	{:else}
		<Breadcrumb />
		<h1>
			{node.name}
			{#if node.pending}<span class="badge badge-pending">◌ pending</span>{/if}
			<CopyLink path={node.path} />
		</h1>
		{#if node.kind === "file" && node.source !== undefined}
			{#if !node.blocks?.length}<p class="undocumented">undocumented</p>{/if}
			<FileView {node} />
		{:else}
			{#if prose}
				{@html prose}
			{:else if node.kind !== "raw"}
				<p class="undocumented">undocumented</p>
			{/if}
			{#if node.kind === "raw" && typeof node.code === "string"}
				<Code code={node.code} path={node.path} />
			{/if}
		{/if}

		{#if projectHealth}<Health health={projectHealth} />{/if}
		<Children {node} />
	{/if}
</main>
