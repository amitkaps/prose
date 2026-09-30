# Plan

Roadmap for building `prose/spec.md`; section numbers refer to it. This file holds the order of the work and items that touch several files. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `prose/lessons.md`.

## Done

- **0.1.0 and after** — a dev route on Devframe with a Svelte client, the `@note` annotator with safe writes, symbol and staleness checks, the HTML strip, and a released tarball (#2–#14). The parser (comments from `oxc-parser`, content-derived anchors, `.svelte`/YAML/TOML scanners) and the git-aware tree walk carry over; the rest is dropped (spec §6).
- **Field use and the rewrite** — sitez and markz used 0.1.0; the route, notes and checks went unused, the `prose/` docs and `@prose` were read (`lessons.md`). The spec is now the convention plus a read-only renderer (#15–#17).
- **Cut the dropped code** — Devframe, the client, the Vite plugin, notes, checks and git blame are gone; the parser keeps blocks, chunks, pending and anchors (`declaredIdentifiers` moved to `src/names.ts`), and `src/tree.ts` is a plain walk with `prose/` as an ordinary folder. The library exports the parser and the tree until `prose .` lands.

## Open work, in order

### 2. `prose .` (spec §4)

- [ ] A `prose` bin: `prose [dir]`, `--port`, opens the browser. `node:http`, loopback only.
- [ ] Pages: folder, Markdown, source file as one document with folded code and a **Show code** toggle, other text files (§4.1). Anchors as fragments; breadcrumb; editor link.
- [ ] Markdown through `@amitkaps/markz`, replacing `markdown-exit`; code through shiki (`shiki/core`, explicit languages, per `lessons.md`).
- [ ] One stylesheet: a readable column, light and dark.
- [ ] Live reload: a watcher and a server-sent event.
- [ ] Tests against `examples/single`: each page kind renders with the expected headings; a path outside the root is a 404.

### 3. Release 0.2.0

- [ ] README rewritten around the two things (spec intro), with the §5 snippet to copy.
- [ ] Release 0.2.0 as a GitHub release tarball, as 0.1.0 was.

### 4. Use it

- [ ] base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with spec §5, and fold sitez's open `@note` (`src/site.ts`) into its prose.
- [ ] markz: make `@prose` blocks link to `grammar.md` instead of restating its rules (spec §3.5).
- [ ] Two weeks of work on sitez and markz, then decide whether the renderer stays (spec §7).

### Later

- [ ] Publish to npm once the CLI has settled; check whether an unscoped name is available for `npx`.

## Open questions

See spec §8.
