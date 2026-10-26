---
name: prose
description: Prose's rules for @prose comments, READMEs and docs. Use before writing or changing any of them, or code a @prose comment explains.
---

# Writing prose

Prose's rules come from the version this repository installs, so run them rather than recall them.

1. Run `pnpm prose rules` before writing, and `pnpm prose rules <code>` for what one warning asks for.
2. Find your way with `outline.md` at the root, every file with its summary. Run `pnpm prose outline` when there's none.
3. After writing, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better.
4. `pnpm prose check` has to pass. `pnpm run verify` runs it.
