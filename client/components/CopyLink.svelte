<script lang="ts">
	/** @prose
	 * A small "copy link" button: copies the node's stable URL (spec §6.1) so it can be shared
	 * without reading the address bar. Shown on hover next to headings and list entries.
	 */
	import { copyLink } from "../store.svelte.js";

	let { path }: { path: string } = $props();
	let state: "idle" | "copied" | "failed" = $state("idle");

	async function copy() {
		state = (await copyLink(path)) ? "copied" : "failed";
		setTimeout(() => (state = "idle"), 1500);
	}
</script>

<button type="button" class="copy-link" title="Copy link to this node" onclick={copy}>
	{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "#"}
</button>
