<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.doc.title} · base</title>
	<meta name="description" content={data.doc.summary} />
</svelte:head>

<!-- title comes from frontmatter; html is rendered at build time from trusted local markdown (src/lib/docs.ts) -->
<article>
	<h1>{data.doc.title}</h1>
	{@html data.doc.html}
</article>
