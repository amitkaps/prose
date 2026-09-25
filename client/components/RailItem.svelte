<script lang="ts">
	/** @prose
	 * One row of the rail, recursive over the node's children. As in an editor's explorer, the whole
	 * row is the target: clicking a node with children navigates to it *and* toggles it, so a second
	 * click closes what the first opened (expansion state lives in `store`, depth-defaulted and
	 * remembered per session). The active row scrolls itself into view, so following a link or the
	 * palette to a deep node never leaves the highlight off-screen.
	 */
	import Badges from "./Badges.svelte";
	import NodeIcon from "./NodeIcon.svelte";
	import RailItem from "./RailItem.svelte";
	import { label, ordered, type TreeNode } from "../nav.js";
	import { hrefFor, store } from "../store.svelte.js";

	let { node, depth }: { node: TreeNode; depth: number } = $props();

	const open = $derived(store.isOpen(node.path, depth));
	const hasChildren = $derived(node.children.length > 0);
	const active = $derived(node.path === store.node?.path);
	let row: HTMLElement | undefined = $state();

	$effect(() => {
		if (active) row?.scrollIntoView({ block: "nearest" });
	});
</script>

<li>
	<a
		class="rail-row"
		class:active
		class:raw={node.kind === "raw"}
		href={hrefFor(node.path)}
		title={node.path}
		style:padding-left={`${0.4 + depth * 0.75}rem`}
		aria-current={active ? "page" : undefined}
		aria-expanded={hasChildren ? open : undefined}
		onclick={() => hasChildren && store.toggle(node.path, depth)}
		bind:this={row}
	>
		<span class="twisty" aria-hidden="true">
			{#if hasChildren}
				<svg viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" /></svg>
			{/if}
		</span>
		<NodeIcon kind={node.kind} />
		<span class="rail-label">{label(node)}</span>
		<Badges attention={store.attention.get(node.path)} />
	</a>
	{#if hasChildren && open}
		<ul>
			{#each ordered(node.children) as child (child.path)}
				<RailItem node={child} depth={depth + 1} />
			{/each}
		</ul>
	{/if}
</li>
