<script lang="ts">
	/** @prose
	 * # A file, read top to bottom
	 *
	 * The file is the smallest unit the view navigates to (spec §3.2): a chunk read alone loses the
	 * imports and neighbours that give it meaning. So a file's page is the whole file in source order:
	 * the highlighted code, with each `@prose` block rendered as prose exactly where its comment was.
	 * A file with no `@prose` at all is just its code. A chunk URL (`file.ts#addTodo`) lands here and
	 * scrolls to that block; it does so only when the URL changes, never on a live update, so an edit
	 * elsewhere doesn't yank the page. Line notes (spec §6.2) appear where their comments sat, and
	 * the file's own warnings (a `@prose` block in a function, say) list at the top.
	 */
	import { tick, untrack } from "svelte";
	import Block from "./Block.svelte";
	import Code from "./Code.svelte";
	import Note from "./Note.svelte";
	import { segments, type TreeNode } from "../nav.js";
	import { store } from "../store.svelte.js";

	let { node }: { node: TreeNode } = $props();

	const parts = $derived(segments(node.source ?? "", node.blocks ?? [], node.lineNotes ?? []));
	const noteable = $derived(store.tree?.writable !== false);

	$effect(() => {
		const target = store.focus;
		if (!target) return;
		void store.path;
		untrack(() => {
			void tick().then(() => {
				document
					.querySelector(`[data-block="${CSS.escape(target)}"]`)
					?.scrollIntoView({ block: "start" });
			});
		});
	});
</script>

<div class="file-view">
	{#if node.warnings?.length}
		<ul class="warnings">
			{#each node.warnings as warning (warning.message)}
				<li class="warning">{warning.message}</li>
			{/each}
		</ul>
	{/if}
	{#each parts as part, i (i)}
		{#if part.kind === "block"}
			<Block block={part.block} />
		{:else if part.kind === "note"}
			<Note node={{ path: part.note.path, hash: part.note.hash, note: part.note.text }} />
		{:else}
			<Code code={part.text} path={node.path} startLine={part.line} {noteable} />
		{/if}
	{/each}
</div>
