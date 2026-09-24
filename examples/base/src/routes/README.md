# routes

[`+layout.svelte`](+layout.svelte) is the shell every route renders inside. [`+page.svelte`](+page.svelte)
is the home page, listing every doc; [`[slug]/+page.svelte`](%5Bslug%5D/+page.svelte) renders one
doc, with its slugs enumerated for prerendering in [`[slug]/+page.ts`](%5Bslug%5D/+page.ts).
[`+layout.ts`](+layout.ts) turns on static prerendering and off client-side JS for the whole tree.
