# base (Prose example)

A copy of [amitkaps/base](https://github.com/amitkaps/base), used as the Prose
prototype's test case (see [`docs/spec.md`](../../docs/spec.md) §9). The CI workflow,
`deploy` script and custom-domain route are removed, so it runs locally only.

An opinionated, kept-current starter for SvelteKit apps deployed to Cloudflare
Workers — SvelteKit 3 + Vite+ + Zod + plain CSS.

```sh
# needs Node 26 + pnpm 12.6+ — mise.toml pins both
mise install
pnpm install
pnpm dev
```

Four commands are the whole interface here: `dev`, `build`, `check`, `test`.

The starter's own docs are its demo content — the markdown files under
`src/content/`, each with YAML frontmatter validated in
[`src/lib/docs.ts`](src/lib/docs.ts), served at `/stack`, `/setup`,
`/upgrade` and `/lessons`. Start with
[`stack.md`](src/content/stack.md) to see what's in the box, then
[`setup.md`](src/content/setup.md) to make it yours.

Building on this? Start with [`AGENTS.md`](AGENTS.md).
