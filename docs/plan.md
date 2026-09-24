# Plan

A phase-by-phase roadmap for building `docs/spec.md`. Each phase should leave the repo in a
working, reviewable state. Section numbers refer to `docs/spec.md`.

## Phase 1 — plugin skeleton + parser + read-only dev route, `examples/single` — in progress

- [x] Root `@amitkaps/prose` package (`package.json`, `tsconfig.json`).
- [x] Parser (`src/parser.ts`): `@prose` comment scanning for `.js`/`.ts`/`.css`/`.html`, chunking
      into file prose / preamble / sections / chunks (§3).
- [x] Hierarchy builder (`src/tree.ts`): walks a project root into the L3→L0 tree (§4), for
      folders, files, sections, and chunks. Symbol/staleness badges are not computed yet (§5).
- [x] Vite plugin (`src/plugin.ts`), first pass: dev-only, hand-rolled middleware serving
      `/__prose/` and two read-only JSON endpoints (subset of §6.4).
- [x] **Migrated the plugin onto Devframe** (`devframe` + `@vitejs/devtools-kit`, mounted via
      `@vitejs/devtools`): the two endpoints became `query` RPC functions (`tree`, `node`) on a
      devframe with `id: "prose"`, which mounts at `/__prose/` by default. `prose()` now returns
      `Promise<Plugin[]>` (it bundles the `@vitejs/devtools` hub plugin itself, so a consuming
      `vite.config.ts` only lists one entry). See §6/§6.4 in spec.md for the rationale — mainly
      that §6.3's remarks and §10's "live agent channel" map onto Devframe's `action`/`event`
      procedures and MCP adapter for free in later phases, instead of hand-rolled HMR/agent-bridge
      code.
- [x] Client (`client/`): vanilla TS, left-rail navigation + main pane, hash routing, first-paragraph
      summaries, syntax-highlighted code at L0 via `shiki` (§6.1 subset). Now a small prebuilt SPA
      (`client/dist`, built via a dedicated Vite config) rather than served as raw source, since
      Devframe's `clientAssets` only serves a built dist directory. It connects with
      `connectDevframe()` from `devframe/client` instead of hand-rolled `fetch` calls.
- [x] `examples/single` wired to the plugin via `vite.config.js` + `link:../..` dependency.
- [ ] Manually verified against `examples/single` (`pnpm install && pnpm dev`, open `/__prose/`) —
      confirmed server-side: dev server starts with no errors, `/__prose/` serves the built SPA
      shell, its assets resolve, `/__prose/__connection.json` returns a valid websocket/sse
      handshake, and the app's own route (`/`) is unaffected. **Not yet confirmed**: the actual
      RPC round trip (`tree`/`node` calls resolving real data in the rail/pane) and the exact
      client-side call convention (`client.scope("prose").rpc.call("tree")` — whether the scope
      auto-prefixes to `prose:tree` or the registered name needs to be `prose:tree` explicitly,
      per the ambiguity in the Devframe docs noted during research). `@vitejs/devtools`'s
      `clientAuth` also defaults to on, so the *first* browser connection may print a trust-prompt
      in the `pnpm dev` terminal that needs approving — try that first if the rail stays empty.

**New dependencies this phase added:** `devframe`, `@vitejs/devtools-kit`, `@vitejs/devtools`
(all pulled in transitively through `@amitkaps/prose` — a consuming project's `vite.config.ts`
still only adds `prose()`).

**Known simplifications, to revisit in later phases:**
- Prose is rendered with a minimal hand-rolled Markdown pass (headings, paragraphs, `code`,
  `**bold**`, `[links](…)`) — not full CommonMark + GFM (§3.1).
- `.svelte` files are not parsed at all (needed for Phase 4 / `examples/base`).
- The import-graph diagram (§4, L3) is not built — no `es-module-lexer` integration yet.
- Live-reload isn't wired yet: the view does not update when files change. Devframe's synced
  state should make this cheaper than the hand-rolled HMR-websocket approach spec.md originally
  described, but it's still not built (§6.1).
- L2 folder nodes are supported by the tree walker but untested, since `examples/single` is flat.
- Devframe's `clientAuth` defaults to on (a terminal-approved trust handshake for new browser
  clients) — not yet checked whether that's the right default for a local, audience-of-one tool,
  or whether examples should set `clientAuth: false`.

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
- `save-prose`, `add-remark`, `resolve-remark` as Devframe `action` RPC functions (§6.4); consider
  an `event` function or synced state so the client sees remark/prose changes without a manual
  refetch.
- Adding new pending chunks/sections from the view.

## Phase 4 — build step, live updates, `examples/base` (§6.5, §6.1 live view, §9.2)

- [x] `.svelte` file support (`src/parser.ts`'s `scanSvelte`): `<script>`/`<style>` bodies scanned
      as JS/TS/CSS, everything else as HTML, merged back in source order (§3.3). Each block also
      carries a `partEnd` so a chunk's trailing code is clipped at its own part's boundary and
      never bleeds across a `</script>`/`<style>` tag into the next part's code.
- [x] `.md` content files (not `README.md`) are now walked into the tree too (`src/tree.ts`):
      whole file is prose per §3.3, YAML frontmatter stripped before display. Previously silent
      dropped (not in `SOURCE_EXTENSIONS`) — worth calling out since it's outside this phase's
      original scope but needed to make `examples/base`'s `src/content/*.md` pages visible.
- [x] Convert `examples/base`: added `@amitkaps/prose` as a `link:../..` devDependency,
      `prose()` alongside `sveltekit()` in `vite.config.ts` (skipped under `VITEST`, same as
      the SvelteKit plugin). Promoted existing `//`/JSDoc/HTML comments to `@prose` across
      `src/lib/docs.ts`, `src/lib/index.ts`, `src/routes/**`, `src/app.css`; added folder
      `README.md`s for `src/lib` and `src/routes` (first real exercise of L2 folder nodes,
      previously untested — works). Verified: `pnpm test`, `pnpm check`, `pnpm build` all pass
      unchanged; `pnpm dev` boots with `/__prose/` serving and its assets resolving correctly
      (checked via `curl` per the lessons.md content-type gotcha, not status code alone).
- [ ] HTML-strip build hook (`transformIndexHtml` in `vite build`), verified byte-identical output
      otherwise.
- [ ] Live view updates via Devframe's synced state (watch the project's files, push tree/node
      changes instead of the client polling).
- [ ] `dev/docs.tool.ts`, the §8 agent-contract snippet, and one pending chunk in `examples/base`
      (not yet added — no undocumented-but-intentional chunk exists there yet to exercise the
      pending-chunk UI against).
- [ ] Run through the full §9.2 verification checklist (`pnpm check`/`test`/`build` are covered
      above; the checklist's other items — unmarked comments not treated as prose, dev route
      alongside SvelteKit's own routing — are informally confirmed but not run down item-by-item).

## Phase 5 — dev tools, import-graph diagram, CLI/MCP (§4 diagram, §7, §8's `prose check`, §10)

- `dev/*.tool.ts` discovery via `import.meta.glob`, mounted under **Tools**.
- `es-module-lexer`-based import graph, grouped by folder, linked to L1 views.
- `prose check` CLI surfacing the §5 warnings outside the dev route — Devframe ships a `cac`
  adapter for this (see the root `defineDevframe()` + `createCac()` pattern used internally by
  `src/plugin.ts`).
- Evaluate turning on Devframe's MCP adapter (`devframe/adapters/mcp`) to resolve §10's "live
  agent channel" open question — expose `tree`/`node`/remarks to an agent directly, as an
  addition to (not a replacement for) `.prose/remarks.md` in the prototype's scope (§2).

## Open questions (§10)

Carried over from spec.md, unresolved: nested chunks for class members/nested functions,
LLM-based summaries beyond first paragraphs, a live agent channel instead of `remarks.md`, and
problem-layer tools referenced from pending chunks.
