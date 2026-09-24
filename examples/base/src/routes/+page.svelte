<script lang="ts">
	/** @prose
	 * The home page: a card per doc, linking into the `[slug]` route. `docs` is already
	 * sorted by frontmatter `order`, so the grid needs no sorting of its own.
	 */
	import { docs } from '#lib';
</script>

<!-- @prose
## Doc cards

Each card links to `/{slug}`; the title and summary come straight from that page's
frontmatter, so this list never drifts from the pages it links to.
-->
<h1>base</h1>
<p>An opinionated, kept-current SvelteKit + Cloudflare starter. Start here:</p>

<div class="cards">
	{#each docs as doc (doc.slug)}
		<a class="card" href="/{doc.slug}">
			<strong>{doc.title}</strong>
			<span>{doc.summary}</span>
		</a>
	{/each}
</div>

<style>
	.cards {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		margin: 1.5rem 0;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--text);
	}

	.card:hover {
		background: var(--surface-hover);
	}

	.card span {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
</style>
