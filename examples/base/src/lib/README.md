# lib

Everything importable through the `#lib` alias (see [`index.ts`](index.ts)). Right now that's
just [`docs.ts`](docs.ts) — the content-loading pipeline for `src/content/*.md` — but components
and assets belong here too as the app grows, imported directly rather than through the barrel
(e.g. `#lib/components/Dialog.svelte`).
