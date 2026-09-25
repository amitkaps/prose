<script lang="ts">
	/** @prose
	 * # Project health
	 *
	 * A few signals the tree already carries, shown above the folder list at the project level:
	 * documentation coverage, warnings, the pending plan, the symbol-check split, and the files with
	 * the least prose per line of code (candidates for a summary that is too thin). Nothing here is
	 * generated; `stats.ts` only counts. Raw lines of code are deliberately not the headline: they say
	 * a chunk is big, not whether it is healthy.
	 */
	import { hrefFor } from "../store.svelte.js";
	import type { Health } from "../stats.js";

	let { health }: { health: Health } = $props();

	const percent = $derived(
		health.files.total ? Math.round((100 * health.files.documented) / health.files.total) : 100,
	);
	const symbolTotal = $derived(
		health.symbols.local + health.symbols.linked + health.symbols.unresolved,
	);
</script>

<section class="health" aria-label="Project health">
	<div class="tiles">
		<div class="tile">
			<div class="tile-value">{percent}%</div>
			<div class="tile-label">
				files documented ({health.files.documented}/{health.files.total})
			</div>
		</div>
		<div class="tile" class:bad={health.warnings > 0}>
			<div class="tile-value">{health.warnings}</div>
			<div class="tile-label">warnings ({health.stale} stale)</div>
		</div>
		<div class="tile" class:attention={health.pending > 0}>
			<div class="tile-value">{health.pending}</div>
			<div class="tile-label">pending of {health.blocks} blocks</div>
		</div>
		<div class="tile" class:bad={health.symbols.unresolved > 0}>
			<div class="tile-value">{health.symbols.unresolved}</div>
			<div class="tile-label">unresolved of {symbolTotal} symbols</div>
		</div>
		<div class="tile">
			<div class="tile-value">{health.codeLines.median}</div>
			<div class="tile-label">median file lines (max {health.codeLines.max})</div>
		</div>
	</div>
	{#if health.thinnest.length > 0}
		<h3>Least prose per line of code</h3>
		<ul class="thin">
			{#each health.thinnest as file (file.path)}
				<li>
					<a href={hrefFor(file.path)}>{file.path}</a>
					<span class="muted">{file.proseWords} words over {file.codeLines} lines</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
