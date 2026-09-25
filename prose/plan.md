# Plan

Roadmap for building `prose/spec.md`; section numbers refer to it. Finished phases are one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `prose/lessons.md`. This file holds what is left.

## Done

- **Phase 1** — plugin skeleton, parser, read-only `/__prose/` on Devframe (`@devframes/vite`, `auth: false`), `examples/single`, `tsdown` + `vite-plus` toolchain, the repo dogfooded with `@prose`.
- **Phase 2** — symbol check (`oxc-parser`) and staleness check (`git blame --porcelain`), warnings rolled up per node (§5).
- **Phase 3** — the `@note` annotator: parser, write-back (`src/notes.ts`), `add-note`/`resolve-note` RPC, client UI (§6.2–§6.3).
- **Phase 4 (mostly)** — `.svelte`, `.md`, `.yaml`/`.toml` support; HTML-strip build hook; live updates via Devframe `SharedState`; `examples/base` converted; §8 snippet in its `AGENTS.md`.
- **Phase 2.5** — UI: the client rewritten in Svelte 5 (runes); dark-only CSS with cascade layers and tokens; collapsible rail, quick-jump palette, loading and error states, breadcrumb links, one badge system with rolled-up counts, copy-link, whole-file source view, `raw` nodes for JSON, project-health panel.

- **File as the leaf** — files are the smallest navigable unit (spec §3.2): the rail stops at files, a file page reads the whole file in source order with each `@prose` block rendered in place, and every block, the file prose included, takes a `@note`. Chunk URLs (`file.ts#addTodo`) still work and scroll to the block.

## Open work

### Phase 4 leftovers

- [ ] `dev/docs.tool.ts` and one pending chunk in `examples/base`; held off until the `dev/*.tool.ts` discovery (Phase 5) exists.
- [ ] Run the §9.2 verification checklist item by item (`pnpm check`/`test`/`build` pass; the rest is only informally confirmed).

### Phase 4.5 — polish on the file-as-leaf view (open options)

Nothing here is decided; each is a choice to make when it starts to matter.

- [ ] **Notes where there is no `@prose` block**: an undocumented file, a folder (`README.md`) or the project can't take a note. Options: a `@note` marker usable alone at the top of a file; a comment convention inside `README.md`; or none (the agent adds a `@prose` block first). Also spec §10.
- [ ] **Show the current staleness per block, not just per file**: the file badge counts them, the block panel shows the message; consider a per-block badge in the margin.
- [ ] **Inline view for `.svelte`**: code runs between prose blocks are highlighted as Svelte fragments, so a CSS-only run in `<style>` looks plain. Highlight each run by the language of the part it sits in.
- [ ] **Symbol-check noise on file prose** (about 20 new warnings in this repo, mostly external names such as `devframeVitePlugin`, `tsc`, `vp`): options are an ignore list in config, treating names that appear in the file's imports or `package.json` as known (partly done), or a per-block opt-out marker.
- [ ] **Staleness for the file prose**: skipped today because its "code" is only the preamble. Better: compare it against the newest code anywhere in the file, or against its largest change.
- [ ] **A raw source toggle** on the file page for when the rendered view hides something (the comment text itself, exact whitespace).
- [ ] **Rewrite `examples/base`'s prose to the new model**: `app.css` has only a file-level block, so its page is one prose panel over the whole stylesheet; decide whether that is the right shape or the file should carry more blocks.
- [ ] **Size signal**: a file's line count and block count as a badge or in the health panel, feeding the "ask for it to be split with a `@note`" workflow (spec §3.2).
- [ ] **Order of a file's prose and its code**: an option to show the file prose collapsed, or blocks folded, for long files.

### Phase 5 — dev tools, diagram, CLI/MCP (§4, §7, §8, §10)

- [ ] `dev/*.tool.ts` discovery via `import.meta.glob`, listed under **Tools**.
- [ ] `es-module-lexer` import graph, grouped by folder, linked to L1 views; the L3 pane slot can be stubbed first.
- [ ] `prose check` CLI for the §5 warnings (Devframe's `cac` adapter). Until it exists, the §8 snippet must not promise it.
- [ ] Evaluate Devframe's MCP adapter (`devframe/adapters/mcp`) to expose `tree`/`node`/notes to an agent (§10, live agent channel).

### Phase 6 — sync `prose/` with `@prose` (§5.3)

Cross-cutting docs must be checkable against the code's `@prose` blocks, as chunk prose is. Ordered by cost:

- [ ] **(a) Symbol check on `prose/*.md`**: run §5.1 over backticked identifiers in each doc, in `proseDocs` (`src/tree.ts`) and `src/checks.ts`. Small; do first.
- [ ] **(b) Anchor references and `§N` references**: `[x](src/store.ts#addTodo)` resolved via `chunkAnchor`; `@prose` links to `prose/*.md#heading` resolved against heading slugs; `§N` resolved against the named doc's numbered headings. Doc names are derived from the path under `prose/` (`spec`, `feature/recommend`), in their own namespace, bare stem only when unique. Subfolders of `prose/` need the tree walker to recurse first (spec §10).
- [ ] **(c) Doc staleness**: paragraph-level blame of a doc paragraph against the code of the chunks it references.
- [ ] **(d) Duplication check** (doc paragraph near-duplicating an `@prose` block) and **L3 backlinks** (which docs cite each chunk).
- [ ] **(e) Evaluate** `covers:` frontmatter, and moving these checkboxes into pending `@prose` chunks in source (§1: plan and code are one document).

## Open questions

See spec §10.
