<script lang="ts">
	/** @prose
	 * # Quick jump
	 *
	 * A `/`-triggered palette over the flattened tree, matching name or path with the subsequence
	 * scorer in `fuzzy.ts`. It is a modal `<dialog>`, so focus trapping, Escape and the backdrop come
	 * from the platform; the input is a combobox over a listbox so a screen reader hears the active
	 * result as the arrow keys move. Choosing a result just sets the URL hash, like any link.
	 */
	import NodeIcon from "./NodeIcon.svelte";
	import { rank } from "../fuzzy.js";
	import { flatten, label, type TreeNode } from "../nav.js";
	import { go, store } from "../store.svelte.js";

	let query = $state("");
	let index = $state(0);
	let dialog: HTMLDialogElement | undefined = $state();

	const items = $derived(store.tree ? flatten(store.tree) : []);
	const results = $derived(rank(query, items, (n) => `${label(n)} ${n.path}`));

	$effect(() => {
		dialog?.showModal();
	});

	$effect(() => {
		document.getElementById(`palette-option-${index}`)?.scrollIntoView({ block: "nearest" });
	});

	function choose(node: TreeNode | undefined) {
		if (!node) return;
		go(node.path);
		dialog?.close();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			index = Math.min(index + 1, results.length - 1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			index = Math.max(index - 1, 0);
		} else if (event.key === "Enter") {
			event.preventDefault();
			choose(results[index]);
		}
	}

	const focus = (el: HTMLElement) => el.focus();
</script>

<!-- The backdrop is part of the dialog element, so a click whose target is the dialog itself is a
     click outside the panel; the keyboard equivalent (Escape) is handled natively. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
	bind:this={dialog}
	class="palette"
	aria-label="Jump to"
	onclose={() => (store.paletteOpen = false)}
	onclick={(event) => event.target === dialog && dialog?.close()}
>
	<input
		type="text"
		role="combobox"
		aria-expanded="true"
		aria-controls="palette-results"
		aria-activedescendant={`palette-option-${index}`}
		placeholder="Jump to a file, section or chunk…"
		bind:value={query}
		oninput={() => (index = 0)}
		{onkeydown}
		use:focus
	/>
	<ul id="palette-results" role="listbox" aria-label="Results">
		{#each results as node, i (node.path)}
			<li
				id={`palette-option-${i}`}
				role="option"
				aria-selected={i === index}
				class:selected={i === index}
				onclick={() => choose(node)}
			>
				<NodeIcon kind={node.kind} />
				<span class="palette-name">{label(node)}</span>
				<span class="palette-path">{node.path}</span>
			</li>
		{:else}
			<li class="palette-empty">No matches</li>
		{/each}
	</ul>
</dialog>
