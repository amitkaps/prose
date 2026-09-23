# Plan

A phase-by-phase roadmap for building `docs/spec.md`. Each phase should leave the repo in a
working, reviewable state. Section numbers refer to `docs/spec.md`.

## Phase 1 — plugin skeleton + parser + read-only dev route, `examples/single` — in progress

- [x] Root `@amitkaps/prose` package (`package.json`, `tsconfig.json`).
- [x] Parser (`src/parser.ts`): `@prose` comment scanning for `.js`/`.ts`/`.css`/`.html`, chunking
      into file prose / preamble / sections / chunks (§3).
- [x] Hierarchy builder (`src/tree.ts`): walks a project root into the L3→L0 tree (§4), for
      folders, files, sections, and chunks. Symbol/staleness badges are not computed yet (§5).
- [x] Vite plugin (`src/plugin.ts`, `src/server/routes.ts`): dev-only, serves `/__prose/` and two
      read-only endpoints, `GET api/tree` and `GET api/node` (subset of §6.4).
- [x] Client (`client/`): vanilla TS, left-rail navigation + main pane, hash routing, first-paragraph
      summaries, syntax-highlighted code at L0 via `shiki` (§6.1 subset).
- [x] `examples/single` wired to the plugin via `vite.config.js` + `link:../..` dependency.
- [ ] Manually verified against `examples/single` (`pnpm install && pnpm dev`, open `/__prose/`).

**Known simplifications, to revisit in later phases:**
- Prose is rendered with a minimal hand-rolled Markdown pass (headings, paragraphs, `code`,
  `**bold**`, `[links](…)`) — not full CommonMark + GFM (§3.1).
- `.svelte` files are not parsed at all (needed for Phase 4 / `examples/base`).
- The import-graph diagram (§4, L3) is not built — no `es-module-lexer` integration yet.
- No live-reload: the view does not update when files change (§6.1's HMR-websocket requirement).
- L2 folder nodes are supported by the tree walker but untested, since `examples/single` is flat.

## Phase 2 — checks (§5)

- Symbol check: resolve inline code spans in prose against declared identifiers; link, or flag as
  unresolved.
- Staleness check: `git blame --porcelain` per file, comparing newest code line vs. newest prose
  line per chunk.
- Surface both as warnings/badges in the tree and on nodes (extends the `api/tree` and
  `api/node` payloads).

## Phase 3 — editing: prose editor, remarks, full API (§6.2–§6.4)

- In-place Markdown editor with preview for any prose node; write-back into the source comment
  (or README file), preserving indentation and `@prose` marker/prefixes.
- `.prose/remarks.md`: anchors, open/resolved bullets, orphaning when an anchor no longer
  resolves.
- `PUT api/prose`, `POST api/remark`, `PATCH api/remark` endpoints.
- Adding new pending chunks/sections from the view.

## Phase 4 — build step, live updates, `examples/base` (§6.5, §6.1 HMR, §9.2)

- HTML-strip build hook (`transformIndexHtml` in `vite build`), verified byte-identical output
  otherwise.
- Live view updates over Vite's HMR websocket.
- `.svelte` file support (script/markup/style parsed per their own language rule, merged in
  source order) — needed before `examples/base` can be converted.
- Convert `examples/base`: add the plugin, promote existing comments to `@prose`, add file prose
  + folder `README.md`s, one pending chunk, `dev/docs.tool.ts`, the §8 agent-contract snippet.
- Run through the full §9.2 verification checklist.

## Phase 5 — dev tools, import-graph diagram, CLI (§4 diagram, §7, §8's `prose check`)

- `dev/*.tool.ts` discovery via `import.meta.glob`, mounted under **Tools**.
- `es-module-lexer`-based import graph, grouped by folder, linked to L1 views.
- `prose check` CLI surfacing the §5 warnings outside the dev route.

## Open questions (§10)

Carried over from spec.md, unresolved: nested chunks for class members/nested functions,
LLM-based summaries beyond first paragraphs, a live agent channel instead of `remarks.md`, and
problem-layer tools referenced from pending chunks.
