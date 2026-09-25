<script lang="ts">
	/** @prose
	 * # One prose block, in place
	 *
	 * A block's rendered prose, then its note (or the button to add one), where the comment sat in
	 * the source. Every `@prose` block can carry a note, the file prose's included (spec §6.2). The
	 * block's own warnings show above its prose, and a pending block says so in place of code. It is
	 * addressable: `data-block` is what a chunk URL scrolls to, and the copy-link button copies it.
	 */
	import CopyLink from "./CopyLink.svelte";
	import Note from "./Note.svelte";
	import { renderMarkdown } from "../markdown.js";
	import type { TreeNode } from "../nav.js";
	import { annotateSymbols } from "../symbols.js";
	import { store } from "../store.svelte.js";

	let { block }: { block: TreeNode } = $props();

	const html = $derived(annotateSymbols(renderMarkdown(block.prose ?? ""), block.symbols));
</script>

<section class="block" class:focused={store.focus === block.path} data-block={block.path}>
	<div class="block-tools"><CopyLink path={block.path} /></div>
	{#if block.warnings?.length}
		<ul class="warnings">
			{#each block.warnings as warning (warning.message)}
				<li class="warning">{warning.message}</li>
			{/each}
		</ul>
	{/if}
	{@html html}
	{#if block.pending}
		<p class="undocumented">
			<span class="badge badge-pending">◌ pending</span> planned: no code yet
		</p>
	{/if}
	<Note node={block} />
</section>
