---
title: Upgrade
summary: 'Keep a fork current: Dependabot, manual bumps, re-syncing with upstream.'
order: 3
---

`setup.md` is one-time. This is the recurring part: keeping a fork current
without breaking it. The stack is deliberately on the bleeding edge (SvelteKit 3
RC, Vite+ RC, no release cooldown), so bumps land often.

## The rhythm

- **Weekly** — Dependabot opens grouped PRs. Skim, merge the safe ones (below).
- **Monthly** — `pnpm outdated`; bump the toolchain (Vite+, SvelteKit RC)
  deliberately and smoke-test.
- **Every bump** — CI must be green before merge. Strict branch protection on
  `main` enforces this and auto-rebases the other open PRs after each merge.

## Dependabot PRs

Groups are defined in `.github/dependabot.yml`:

| Group             | Contents                                  | How to handle                           |
| ----------------- | ----------------------------------------- | --------------------------------------- |
| `minor-and-patch` | any minor/patch bump of a leaf dependency | merge on green CI                       |
| `sveltekit`       | `@sveltejs/*`, `svelte`, `svelte-check`   | pull the branch, smoke-test, then merge |
| `vite-plus`       | `vite`, `vite-plus`                       | pull the branch, smoke-test, then merge |
| github-actions    | workflow action versions                  | merge on green CI                       |

Smoke-test = `pnpm install && pnpm dev`, click through `/` and one doc page,
then `pnpm build`.

## Manual bumps

```sh
pnpm outdated
pnpm up --latest <pkg>        # or edit package.json + pnpm install
```

The `vite` override and the `vite` devDependency alias must stay pinned to the
same version — bump them together. `lessons.md` (`/lessons`) explains why.

## After any bump

```sh
pnpm install
pnpm check && pnpm test && pnpm build
```

`pnpm install` regenerates `worker-configuration.d.ts` via `prepare`, so a
`wrangler` bump needs nothing extra. Deploy happens on merge to `main`; confirm
`base.<subdomain>.workers.dev` and the custom domain still serve.

## Node & pnpm

Bump together: `.node-version`, `mise.toml`, `package.json` `engines.node`, and
`package.json` `packageManager`. CI reads `.node-version` and `packageManager`
(via `pnpm/action-setup`); `mise.toml` pins the same versions for local dev —
mise doesn't read either file automatically, so without it your local `pnpm`
and `node` can silently drift from what CI uses. `mise install` after bumping
picks up the new pins.

## Re-syncing a fork with upstream

```sh
git remote add upstream https://github.com/amitkaps/base
git fetch upstream
```

Periodically diff the toolchain files against upstream and cherry-pick fixes:

- `vite.config.ts`
- `pnpm-workspace.yaml`
- `.github/workflows/ci.yml`
- `src/lib/docs.ts`

New gotchas land in upstream `lessons.md` — worth re-reading after a big bump.

## Graduating off the bleeding edge

Once SvelteKit 3 and Vite+ ship stable, relax the RC version ranges in
`package.json` to normal caret ranges and delete this section. (The
supply-chain cooldown is a separate call — see `setup.md` §5.)
