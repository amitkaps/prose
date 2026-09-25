<script lang="ts">
	/** @prose
	 * # The annotator (spec §6.2)
	 *
	 * Every `@prose` block carries a note, the file prose's included (`src/notes.ts` needs an exact
	 * block to anchor a write to). An existing note shows with a Resolve button; otherwise a quiet
	 * "+ Add note" reveals a textarea, with
	 * no preview or toolbar since a note is a short direction, not authored prose. Writes go through
	 * the store and come back as a live tree update. The draft is local state, so a file change
	 * elsewhere (which re-renders the pane) never wipes what is being typed.
	 */
	import { renderMarkdown } from "../markdown.js";
	import type { TreeNode } from "../nav.js";
	import { addNote, resolveNote } from "../store.svelte.js";

	let { node }: { node: TreeNode } = $props();
	let editing = $state(false);
	let draft = $state("");
	let busy = $state(false);
	let error: string | null = $state(null);

	async function run(action: () => Promise<void>) {
		busy = true;
		error = null;
		try {
			await action();
			editing = false;
			draft = "";
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	const focus = (el: HTMLElement) => el.focus();
</script>

{#if node.note}
	<div class="note-block">
		<div class="note-label">Note</div>
		{@html renderMarkdown(node.note)}
		<button type="button" disabled={busy} onclick={() => run(() => resolveNote(node.path))}
			>Resolve</button
		>
		{#if error}<p class="note-error" role="alert">{error}</p>{/if}
	</div>
{:else}
	<div class="note-block note-empty">
		{#if editing}
			<textarea bind:value={draft} rows="3" aria-label="Note" use:focus></textarea>
			<div class="note-actions">
				<button
					type="button"
					disabled={busy || !draft.trim()}
					onclick={() => run(() => addNote(node.path, draft.trim()))}>Save</button
				>
				<button type="button" disabled={busy} onclick={() => (editing = false)}>Cancel</button>
			</div>
			{#if error}<p class="note-error" role="alert">{error}</p>{/if}
		{:else}
			<button type="button" onclick={() => (editing = true)}>+ Add note</button>
		{/if}
	</div>
{/if}
