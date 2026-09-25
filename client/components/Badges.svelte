<script lang="ts">
	/** @prose
	 * # One badge language
	 *
	 * Pending chunks, warnings and open notes all mean "this needs attention", so they share one
	 * pill shape and differ only by colour and symbol. Counts roll up (`stats.ts`), so a folder shows
	 * what is waiting anywhere below it, and each pill's hover title says *what kind* of thing it is
	 * (which warnings, not just a number).
	 */
	import type { Attention } from "../stats.js";

	let { attention }: { attention: Attention | undefined } = $props();

	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

	const warnings = $derived(
		(attention?.unresolved ?? 0) + (attention?.stale ?? 0) + (attention?.misplaced ?? 0),
	);
	const warningTitle = $derived(
		[
			attention?.unresolved ? plural(attention.unresolved, "unresolved symbol") : "",
			attention?.stale ? `${attention.stale} possibly stale` : "",
			attention?.misplaced ? `${plural(attention.misplaced, "misplaced block")}` : "",
		]
			.filter(Boolean)
			.join(", "),
	);
</script>

{#if attention && (attention.pending || warnings || attention.notes)}
	<span class="badges">
		{#if attention.pending}
			<span
				class="badge badge-pending"
				title={`${plural(attention.pending, "pending chunk")} (planned, no code yet)`}
				>◌ {attention.pending}</span
			>
		{/if}
		{#if warnings}
			<span class="badge badge-warning" title={warningTitle}>▲ {warnings}</span>
		{/if}
		{#if attention.notes}
			<span class="badge badge-note" title={`${plural(attention.notes, "open note")}`}
				>✎ {attention.notes}</span
			>
		{/if}
	</span>
{/if}
