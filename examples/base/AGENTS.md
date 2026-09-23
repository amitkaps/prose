# Working on this repo

Read **`src/content/lessons.md`** first — it covers the SvelteKit 3 RC, Vite+,
pnpm 12 and Cloudflare quirks this project already worked through.

- Before committing: `pnpm check` (format, lint, typecheck, Svelte diagnostics)
  and `pnpm test` must pass. After a dependency bump, `pnpm build` too.
- `vp` is a dev dependency — run it through the `pnpm run …` scripts, not a
  global install.
- The files in `src/content/` are the site's pages _and_ its docs. Update the
  doc, not a separate copy. Each fact lives in exactly one of them: `stack.md`
  (what's here), `setup.md` (one-time setup), `upgrade.md` (keeping current),
  `lessons.md` (gotchas).
