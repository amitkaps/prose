<script lang="ts">
	/** @prose
	 * A node's children as first-paragraph summaries (spec §4). No LLM is involved: each child shows
	 * its name and the first paragraph of its prose, or *undocumented*. Raw files have no prose to
	 * summarize and show only their name.
	 */
	import Badges from "./Badges.svelte";
	import CopyLink from "./CopyLink.svelte";
	import NodeIcon from "./NodeIcon.svelte";
	import { renderMarkdown } from "../markdown.js";
	import { label, ordered, type TreeNode } from "../nav.js";
	import { hrefFor, store } from "../store.svelte.js";

	let { node }: { node: TreeNode } = $props();
</script>

{#if node.children.length > 0}
	<ul class="children">
		{#each ordered(node.children) as child (child.path)}
			<li>
				<div class="child-head">
					<NodeIcon kind={child.kind} />
					<a href={hrefFor(child.path)}>{label(child)}</a>
					<Badges attention={store.attention.get(child.path)} />
					<CopyLink path={child.path} />
				</div>
				{#if child.summary === "undocumented"}
					<p class="undocumented">undocumented</p>
				{:else if child.summary}
					<div class="summary">{@html renderMarkdown(child.summary)}</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
