<script lang="ts">
	/** @prose
	 * # The app shell
	 *
	 * The rail and the pane are the two grid children of `#app`; the quick-jump palette is an overlay
	 * on top. This is also where the global keys live: `/` or Ctrl/Cmd+K opens the palette, except
	 * while typing in a field (the `/` must stay typeable in a note).
	 */
	import Palette from "./Palette.svelte";
	import Pane from "./Pane.svelte";
	import Rail from "./Rail.svelte";
	import { store } from "../store.svelte.js";

	function isTyping(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
		);
	}

	function onkeydown(event: KeyboardEvent) {
		const chord = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
		const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !isTyping(event.target);
		if (chord || slash) {
			event.preventDefault();
			store.paletteOpen = true;
		}
	}
</script>

<svelte:window {onkeydown} />

<Rail />
<Pane />
{#if store.paletteOpen}<Palette />{/if}
