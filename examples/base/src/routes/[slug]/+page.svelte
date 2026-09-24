<script lang="ts">
	/** @prose
	 * One doc page, rendered from the `Doc` its `+page.ts` load resolved.
	 */
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.doc.title} · base</title>
	<meta name="description" content={data.doc.summary} />
</svelte:head>

<!-- @prose
`{@html}` is safe here only because `data.doc.html` is rendered at build time from
trusted local Markdown (src/lib/docs.ts), never from user input.
-->
<article>
	<h1>{data.doc.title}</h1>
	{@html data.doc.html}
</article>
