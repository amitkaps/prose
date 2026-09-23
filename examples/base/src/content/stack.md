---
title: Stack
summary: 'Every piece in the starter, and why it was chosen.'
order: 1
---

An opinionated, kept-current base for SvelteKit apps on Cloudflare Workers. Two
config files carry the weight: **`vite.config.ts`** (dev + toolchain) and
**`wrangler.jsonc`** (deploy).

## What's in it

| Layer      | Choice                         | Why                                                 |
| ---------- | ------------------------------ | --------------------------------------------------- |
| Framework  | SvelteKit 3 (RC) + Svelte 5    | Runes, prerendered by default                       |
| Toolchain  | Vite+ (`vp`)                   | Vite, Vitest, Oxlint, Oxfmt, tsc behind one command |
| Language   | TypeScript                     | —                                                   |
| Validation | Zod 4                          | Validates the parsed docs in `src/lib/docs.ts`      |
| Content    | `import.meta.glob` + `marked`  | Markdown pages, no plugin, no codegen               |
| Styling    | Plain CSS                      | Tokens in `src/app.css`, no framework               |
| Deploy     | `@sveltejs/adapter-cloudflare` | Cloudflare Workers                                  |
| CI/CD      | GitHub Actions                 | Checks on every PR, deploy on merge to `main`       |

No UI library is bundled — add the one you want (Bits UI, Melt, your own) when
you need it.

## Five commands

| Command       | Does                                                        |
| ------------- | ----------------------------------------------------------- |
| `pnpm dev`    | dev server on <http://localhost:5173>                       |
| `pnpm build`  | production build for Cloudflare                             |
| `pnpm check`  | format + lint + typecheck + `.svelte` type/a11y diagnostics |
| `pnpm test`   | unit tests (Vitest, via `vp test`)                          |
| `pnpm deploy` | build + `wrangler deploy` (normally left to CI)             |

`pnpm check` runs two passes because Oxlint doesn't parse `.svelte`: `vp check`
covers `.ts`/`.js`, `svelte-check` covers components. Oxfmt _does_ format
`.svelte`. Both are behind the one command.

Escape hatches, when you want them directly:

```sh
pnpm exec vp check --fix   # write the formatting/lint fixes
pnpm exec vp test          # watch mode
pnpm exec vp preview       # run the built worker locally
```

`prepare` (on every `pnpm install`) runs `svelte-kit sync` and `wrangler types`,
so a fresh clone typechecks with no extra step. `worker-configuration.d.ts` is
generated, not committed.

## Layout

```
src/
  app.css                  design tokens, reset, and prose (dark)
  content/*.md              these four docs — the content demo
  lib/
    docs.ts                 glob + marked + Zod — loads src/content, unit-tested
  routes/
    +page.svelte            home — links to the docs
    [slug]/                 renders one doc; prerendered from docs list
vite.config.ts             SvelteKit + Vite+ (fmt / lint / test) config
wrangler.jsonc             Cloudflare deploy config
```

Import helpers, schemas and docs from `#lib`; components and assets directly as
`#lib/components/X.svelte` (see `package.json` `imports`).

SvelteKit 3 and Vite+ are pre-release, so this repo tracks their releases
closely — see `upgrade.md` (`/upgrade`) for the rhythm, and `setup.md`
(`/setup`) for the supply-chain settings a real project should tighten.
