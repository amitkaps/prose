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

## Prose (`@amitkaps/prose`, `/__prose/`)

- Every file has file prose, and every exported declaration is in a chunk with prose. Folders have a `README.md`.
- Prose goes in `@prose` comments. Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append.
- Fill pending chunks as plan items. Work that belongs to one file goes in as a pending chunk there, not in a list elsewhere.
- When unsure, or when a decision is the human's, leave a `@note` after the relevant `@prose` block instead of guessing.
- When asked to "handle notes": find every `@note` (`grep -rn "@note"`), address the ones you can act on, and delete them — folding anything worth remembering into the `@prose` block each sat next to. Leave the ones waiting on the human, including your own questions.
- Resolve unresolved-symbol warnings before finishing. Treat a possibly-stale warning as a prompt to reread the prose against the code, not as something to clear with a token edit. `/__prose/` surfaces both as you work.
