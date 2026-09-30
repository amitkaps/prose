# Plan

Roadmap for building `prose/spec.md`; section numbers refer to it. This file holds the order of the work and items that touch several files. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `prose/lessons.md`.

## Done

- **0.1.0 and after** — a dev route on Devframe with a Svelte client, the `@note` annotator with safe writes, symbol and staleness checks, the HTML strip, and a released tarball (#2–#14). The parser (comments from `oxc-parser`, content-derived anchors, `.svelte`/YAML/TOML scanners) and the git-aware tree walk carry over; the rest is dropped (spec §6).
- **Field use and the rewrite** — sitez and markz used 0.1.0; the route, notes and checks went unused, the `prose/` docs and `@prose` were read (`lessons.md`). The spec is now the convention plus a read-only renderer (#15–#17).
- **Cut the dropped code** — Devframe, the client, the Vite plugin, notes, checks and git blame are gone; the parser keeps blocks, chunks, pending and anchors (`declaredIdentifiers` moved to `src/names.ts`), and `src/tree.ts` is a plain walk with `prose/` as an ordinary folder. The library exports the parser and the tree until `prose .` lands.
- **`prose .`** — `src/cli.ts`, `src/server.ts`, `src/render.ts`, `src/highlight.ts`, `src/style.ts`: folder, Markdown, source and JSON pages as server-rendered HTML, weaving ported from the 0.1.0 client, Markdown through markz, shiki on the WASM engine with a content-keyed cache, live reload over server-sent events, default port 1234, Node 26 (markz requires it). The file tree on the left (`src/rail.ts`), from the walk's file list alone, as the 0.1.0 client's rail was. Code shown by default with file line numbers, wrapped with a hanging indent, tabs at two; a remembered **Prose & Code / Prose only** switch, centred in the bar; a header on every run (chevron, lines, language) that stays when collapsed; code widened to 100 columns beside a prose measure; shiki's CSS-variables theme in the page's palette; the rail restored before first paint and held still by a view transition. Speed: parses cached by modification time, the highlighter started with the server, links prerendered on hover, and live reload connected only while a page is visible, since six idle tabs holding one connection each left new pages waiting.

## Open work, in order

### 2b. Rest of the renderer

- [ ] Any other text file shown highlighted (spec §4.1); today only `.json`/`.jsonc` beyond the source extensions. Binary files listed, not rendered (§4.2).
- [ ] Look at it in a browser on sitez and markz before the release: typography, folded code, mobile width.

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
