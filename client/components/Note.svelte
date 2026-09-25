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
	 *
	 * A note is written against the block as it was when "+ Add note" was pressed: that hash goes
	 * with the write, not the one the block has at save time. If the block changed while the note
	 * was being typed (an agent edited it, or a block inserted above moved this one), the server
	 * refuses, the draft stays, and the page already shows the fresh block from the live tree. The
	 * next save is against that fresh block, since the human has now seen it. When the dev server
	 * isn't on loopback (spec §6, "Trust boundary") the note shows without its controls. A line note
	 * (`file:line`, spec §6.2) is shown through the same component, with its own text hash.
	 */
	import { renderMarkdown } from "../markdown.js";
	import type { TreeNode } from "../nav.js";
	import { addNote, resolveNote, store } from "../store.svelte.js";

	let { node }: { node: Pick<TreeNode, "path" | "hash" | "note"> } = $props();
	let editing = $state(false);
	let draft = $state("");
	let busy = $state(false);
	let error: string | null = $state(null);
	let baseHash = $state("");
	const writable = $derived(store.tree?.writable !== false);

	function startEditing() {
		baseHash = node.hash ?? "";
		editing = true;
	}

	async function save() {
		await run(() => addNote(node.path, draft.trim(), baseHash));
		if (error) baseHash = node.hash ?? "";
	}

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
		{#if writable}
			<button
				type="button"
				disabled={busy}
				onclick={() => run(() => resolveNote(node.path, node.hash ?? ""))}>Resolve</button
			>
		{/if}
		{#if error}<p class="note-error" role="alert">{error}</p>{/if}
	</div>
{:else if writable}
	<div class="note-block note-empty">
		{#if editing}
			<textarea bind:value={draft} rows="3" aria-label="Note" use:focus></textarea>
			<div class="note-actions">
				<button type="button" disabled={busy || !draft.trim()} onclick={save}>Save</button>
				<button type="button" disabled={busy} onclick={() => (editing = false)}>Cancel</button>
			</div>
			{#if error}<p class="note-error" role="alert">{error}</p>{/if}
		{:else}
			<button type="button" onclick={startEditing}>+ Add note</button>
		{/if}
	</div>
{/if}
