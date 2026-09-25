<script lang="ts">
	/** @prose
	 * # Adding a note to a line (spec §6.2)
	 *
	 * Opened from a line's gutter button, directly under the line picked. A note is not written on
	 * that exact line but above the statement, element, rule or key that contains it, so before the
	 * human types anything the server says where it will land (`noteTarget`, which writes nothing)
	 * and the editor shows that line. A spot right under a block's prose is that block's own, and
	 * the editor says so. The write carries the hash of the line as this page saw it; if the file
	 * changed since, the server refuses and the draft stays.
	 */
	import { lineHash } from "../../src/hash.js";
	import { addNote, noteTarget } from "../store.svelte.js";

	let {
		path,
		line,
		text,
		onclose,
	}: { path: string; line: number; text: string; onclose: () => void } = $props();

	const target = $derived(`${path}:${line}`);
	const hash = $derived(lineHash(text));
	let draft = $state("");
	let busy = $state(false);
	let error: string | null = $state(null);
	let lands: { line: number; text: string; block: boolean } | null = $state(null);

	$effect(() => {
		let stale = false;
		lands = null;
		noteTarget(target, hash).then(
			(found) => {
				if (!stale) lands = found;
			},
			(err) => {
				if (!stale) error = err instanceof Error ? err.message : String(err);
			},
		);
		return () => {
			stale = true;
		};
	});

	async function save() {
		busy = true;
		error = null;
		try {
			await addNote(target, draft.trim(), hash);
			onclose();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	const focus = (el: HTMLElement) => el.focus();
</script>

<div class="note-block note-empty line-note-editor">
	{#if lands}
		<p class="note-where">
			{lands.block ? "Goes on the block's note, above" : "Goes above"} line {lands.line}:
			<code>{lands.text}</code>
		</p>
	{/if}
	<textarea bind:value={draft} rows="3" aria-label={`Note on line ${line}`} use:focus></textarea>
	<div class="note-actions">
		<button type="button" disabled={busy || !draft.trim() || !lands} onclick={save}>Save</button>
		<button type="button" disabled={busy} onclick={onclose}>Cancel</button>
	</div>
	{#if error}<p class="note-error" role="alert">{error}</p>{/if}
</div>
