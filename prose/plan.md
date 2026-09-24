# Plan

A phase-by-phase roadmap for building `prose/spec.md`. Each phase should leave the repo in a
working, reviewable state. Section numbers refer to `prose/spec.md`.

## Phase 1 — plugin skeleton + parser + read-only dev route, `examples/single` — in progress

- [x] Root `@amitkaps/prose` package (`package.json`, `tsconfig.json`).
- [x] Parser (`src/parser.ts`): `@prose` comment scanning for `.js`/`.ts`/`.css`/`.html`, chunking
      into file prose / preamble / sections / chunks (§3).
- [x] Hierarchy builder (`src/tree.ts`): walks a project root into the L3→L0 tree (§4), for
      folders, files, sections, and chunks. Symbol/staleness badges are not computed yet (§5).
- [x] Vite plugin (`src/plugin.ts`), first pass: dev-only, hand-rolled middleware serving
      `/__prose/` and two read-only JSON endpoints (subset of §6.4).
- [x] **Migrated the plugin onto Devframe** (`devframe`, mounted via `@devframes/vite`): the two
      endpoints became `query` RPC functions (`prose:tree`, `prose:node`) on a devframe with
      `id: "prose"`, which mounts at `/__prose/` by default. `prose()` returns `Plugin[]` — two
      plain plugins, `devframeVitePlugin` (serves the built client SPA) and `devframeViteBridge`
      (mounts the RPC/WebSocket backend), both from `@devframes/vite/single`. See §6/§6.4 in
      spec.md for the rationale — mainly that §6.3's remarks and §10's "live agent channel" map
      onto Devframe's `action`/`event` procedures and MCP adapter for free in later phases,
      instead of hand-rolled HMR/agent-bridge code.
- [x] **Dropped `@vitejs/devtools` + `@vitejs/devtools-kit` for `@devframes/vite`.** The first
      Devframe migration went through `@vitejs/devtools-kit`'s `createPluginFromDevframe`, which
      mounts *inside* the `@vitejs/devtools` hub — confirmed from its own doc comment ("mounts
      inside `@vitejs/devtools`"). That's real cost (the hub's dock/terminal/command surface, and
      a `clientAuth`-gated-by-default trust handshake that isn't even a plain option on
      `DevTools()`) for a tool with no need for any of it (§2: one developer, one machine).
      `@devframes/vite`'s `devframeViteBridge`/`devframeVitePlugin` mount the same devframe
      directly into any Vite host, no hub — and its `auth` option takes a plain `false`, so
      `prose()` passes that explicitly, resolving the open `clientAuth` question outright.
      `prose/spec.md` §6 documents mounting inside `@vitejs/devtools` as an alternative, for if
      Prose ever wants to dock alongside other project tooling.
- [x] Client (`client/`): vanilla TS, left-rail navigation + main pane, hash routing, first-paragraph
      summaries, syntax-highlighted code at L0 via `shiki` (§6.1 subset). Now a small prebuilt SPA
      (`client/dist`, built via a dedicated Vite config) rather than served as raw source, since
      Devframe's `clientAssets` only serves a built dist directory. It connects with
      `connectDevframe()` from `devframe/client` instead of hand-rolled `fetch` calls.
- [x] Markdown rendering (`client/markdown.ts`) now goes through `markdown-exit` (a TypeScript
      rewrite of `markdown-it`) instead of a hand-rolled pass — real CommonMark + GFM (tables,
      lists, fenced code), confirmed against `examples/base`'s content docs, which already used
      all three and rendered garbled under the old pass.
- [x] `examples/single` wired to the plugin via `vite.config.js` + `link:../..` dependency.
- [x] Manually verified against `examples/single` and `examples/base`: dev server starts with no
      errors, `/__prose/` serves the built SPA shell, its assets resolve (checked via `curl`
      content-type/length, not status code alone), `/__prose/__connection.json` returns a valid
      handshake, and the app's own routes are unaffected. **The RPC round trip is now confirmed
      too** (not just reachable): a headless script using `devframe/client`'s `connectDevframe`
      with an explicit `baseURL` got real `tree`/`node` data back, with no auth prompt, since
      `auth: false` removes the trust-handshake step entirely for this local, single-developer
      tool.

- [x] **Toolchain: `tsdown` for the library build, `vite-plus` for lint/format/test — no
      standalone tests existed before this.** Every check up to this point was a one-off `curl`
      or Node script, written and deleted each time; that gap is exactly what let the
      `new URL(literal, import.meta.url)` build-time-inlining bug ship (see `prose/lessons.md`).
      `src/parser.test.ts` and `src/tree.test.ts` (20 tests, via `vp test`) cover the parser's
      chunking/section rules for JS/TS/CSS, HTML, and `.svelte` (including the part-boundary
      clipping bug from earlier), and the tree walker's folder/README/`.md`-frontmatter/pending-
      chunk/skip-directory behavior. `vp check` runs `oxfmt` + type-aware `oxlint` scoped to
      `src/`, `client/`, and the repo's own config files (`examples/**` and `prose/**` are
      ignored — each example has its own toolchain and style). `pnpm build`'s last step,
      `scripts/check-client-bundle.mjs`, greps the built client bundle for stray
      `data:text/javascript` — a permanent regression guard for that exact bug class, since
      no Node-based test can exercise it (Node never runs Vite's build-time asset-URL analysis).
      **Still a real gap**: nothing here drives an actual browser or a live dev-server RPC round
      trip automatically — that verification is still the same one-off headless
      `devframe/client` script, run and discarded, each time a dev-route change needs checking.
- [x] **TypeScript bumped to 7.0.2** (from 5.6), matching `examples/base`'s toolchain choice.
      `oxlint`'s type-aware mode (`tsgolint`, the Go-ported checker vite-plus bundles) is what
      actually catches type errors in `vp check` now, not a separate `tsc --noEmit` pass — it
      caught a real `no-floating-promises` issue in `client/main.ts` immediately.
- [x] **`docs/` moved to `prose/`, formalizing spec.md §3.4.** `spec.md`, `plan.md` (this file)
      and `lessons.md` are now cross-cutting project prose, not an ad hoc `docs/` folder — the
      tree walker (`src/tree.ts`'s `proseDocs`) surfaces every `prose/*.md` except `remarks.md`
      at L3, ahead of the folder tree, sorted alphabetically; `prose` itself stays out of the
      tree as an ordinary folder (`SKIP_DIRS`). This is the first real dogfooding of the L3 model
      on the plugin's own repo — confirmed via a throwaway test that `buildTree(process.cwd())`
      lists `prose/lessons.md`, `prose/plan.md`, `prose/spec.md` first, then the folder tree.
- [x] **Fully dogfooded: `src/*.ts`, `client/*.ts`, and the three root config files
      (`vite.config.ts`, `vite.client.config.ts`, `tsdown.config.ts`) all now carry `@prose`.**
      Confirmed via `buildTree(process.cwd())` that every file renders with real chunks/sections,
      not `undocumented` (only test files, `.d.ts`, and pure-type/list files stay undocumented,
      correctly — they have nothing to say beyond their own code).
      This surfaced two real parser bugs, not hypothetical ones:
      1. **A `@prose` block inside an object literal passed to a function call (e.g.
         `defineDevframe({ setup(ctx) { /** @prose *\/ ... } } })`) is silently dropped** — depth
         tracking only recognizes depth-0 comments (spec §3.1), and an object literal's braces
         count the same as a function body's. `src/plugin.ts`'s `setup` closure hit this
         directly; fixed by pulling it out to a top-level `registerRpc` function so its own doc
         comment could sit at depth 0. Not a parser bug — the depth-0 rule is intentional — but a
         real trap for anyone writing `@prose` next to a callback passed inline.
      2. **A genuine parser bug**: `scanJsLike` didn't disambiguate regex literals from division
         or template strings. `src/parser.ts`'s own `slugify()` had `.replace(/\`/g, "")` — a
         regex matching a backtick — which the tokenizer read as a bare backtick opening a
         template literal, "closing" only at the next backtick anywhere later in the file and
         permanently corrupting depth-tracking for everything after it. Fixed two ways:
         `slugify` itself now uses `.replaceAll("\`", "")` (avoiding the trap in this file's own
         source), and `scanJsLike` gained real regex-literal detection (`skipRegexLiteral`, using
         the standard last-significant-token heuristic every JS tokenizer relies on) so any
         *other* project's regex literals — braces, quotes, backticks, slashes in a character
         class — don't hit the same corruption. Covered by five new tests (27 total now).
      Both fixes and all annotations verified against the full pipeline: `vp check`, `vp test`,
      `pnpm build` (with the client-bundle regression guard), and both examples' own
      build/test/check, all green.

**Dependencies:** `devframe`, `@devframes/vite`, `markdown-exit`, `shiki` (runtime, pulled in
transitively through `@amitkaps/prose` — a consuming project's `vite.config.ts` still only adds
`prose()`); `tsdown`, `vite-plus` (dev-only: build, lint, format, test).

**Known simplifications, to revisit in later phases:**
- `.svelte` files are parsed (`scanSvelte`, §3.3) but `.svelte` chunks are not yet symbol- or
  staleness-checked (§5 is still Phase 2 scope generally).
- The import-graph diagram (§4, L3) is not built — no `es-module-lexer` integration yet.
- Live-reload isn't wired yet: the view does not update when files change. Devframe's synced
  state should make this cheaper than the hand-rolled HMR-websocket approach spec.md originally
  described, but it's still not built (§6.1).
- L2 folder nodes are supported by the tree walker and now exercised by `examples/base`'s
  `src/lib/README.md` and `src/routes/README.md`.
- [x] **`client/main.ts`'s syntax highlighting switched from `shiki`'s main entry to
      `shiki/core`'s fine-grained bundle.** The main entry's `codeToHtml` resolves `lang` by name
      at runtime, so Rollup can't statically narrow which language grammars are reachable and
      keeps every one of shiki's ~200 bundled languages as a separate lazy chunk — 321 files in
      `client/dist`, most never fetched by a real user but all built. Explicit per-language
      imports (`@shikijs/langs/{javascript,typescript,css,html,markdown,svelte}` — exactly
      `SHIKI_LANG`'s six values) plus `createHighlighterCore` cut that to 14 assets, ~1.5 MB
      total. The highlighter is still created lazily and memoized on first use, so this didn't
      reintroduce the thing the dynamic import was there to avoid (blocking initial page load).

## Phase 2 — checks (§5) — done

- [x] **Symbol check** (`src/checks.ts`): every backtick-quoted inline code span in a chunk's
      prose that's identifier-shaped (a name, or a dotted chain like `store.subscribe`) resolves
      three ways, per §5.1 — declared in the chunk's own code (`local`), declared in some *other*
      chunk anywhere in the project (`linked`, with the declaring chunk's path), or nowhere
      (`unresolved`, the one case that becomes a `Warning`). `declaredIdentifiers` is a regex
      heuristic (`function`/`class`/`const`/`let`/`var`/`interface`/`type`, optionally exported),
      not a real parser — documented limitation: it doesn't see destructuring or class members.
      The project-wide `identifier → declaring chunk` table is built once per `buildTree` call,
      in a second pass over every chunk already in the tree (`tree.ts`'s `applySymbolChecks`),
      since "elsewhere in the project" isn't knowable file-by-file.
      **Fixed a second dogfooding pass in**: the user pointed at real false positives in
      `examples/base` — `` `marked` `` and `` `Set` `` both flagged unresolved in
      `src/lib/docs.ts`'s prose. Neither was noise to dismiss:
      1. `declaredIdentifiers` never parsed `import` statements at all — a project's own imported
         bindings (`import { marked } from "marked"`) didn't count as "declared," so anything
         imported and only referenced in prose (not redeclared in every chunk) came back
         unresolved. Fixed by adding default/namespace/named-import parsing, aliases included.
      2. That import lives in `docs.ts`'s *preamble* — the code before its first `@prose` block —
         which wasn't part of the tree at all (a real gap, previously just documented as a known
         limitation here). Fixed by storing `preamble` on the file `TreeNode` and threading its
         declared identifiers down to every chunk in that file as a `fileScope` set (`tree.ts`'s
         `collectChunks`) — resolves as `local`, since it's usable by any chunk in the file, not a
         same-file `linked` link to nowhere.
      3. `Set` is a real, if incomplete, gap: `marked`'s prose says `` `marked` `` (the npm
         package's name), not `` `Marked` `` (the class actually imported) — a project can't
         "declare" a package name as an identifier, so a `BUILTIN_GLOBALS` list (like the keyword
         skip-list) wasn't the right fix for `marked` specifically; `Set` *is* a JS builtin and
         got the `BUILTIN_GLOBALS` treatment, but `marked`-the-package needed a different check:
         `tree.ts`'s `readPackageNames` reads `package.json`'s own dependency names once per
         `buildTree` call, and `checkSymbols` skips any span matching one — a project's own
         manifest is exactly its record of "this external name is really part of this project."
      All three verified against `examples/base`'s real dev server (RPC round trip, not just unit
      tests) before and after — 5 more tests (52 total).
- [x] **Staleness check** (`src/git.ts` + `src/checks.ts`): one `git blame --porcelain` per file
      (not per chunk — cached across a file's chunks), comparing the newest timestamp in the
      prose block's own line range against the newest in its trailing code's range (§5.2).
      Uncommitted lines compare as `Infinity` ("uncommitted changes count as newest," verbatim).
      A pending chunk, an untracked file, or no git repo at all skips the check entirely rather
      than guessing — "can't tell" must never look like "confirmed fresh."
      Required a new `ProseChunk` field (`proseEndLine`, the boundary between a block's comment
      and its trailing code) — `parser.ts`'s existing `startLine`/`endLine` only bracketed the
      *whole* chunk, not its prose half from its code half.
- [x] **Warnings roll up** (`tree.ts`): every `TreeNode` now carries `warningCount` — its own
      warnings plus every descendant's, summed bottom-up — so a badge can render at any level
      (folder, file, section) without the client walking the subtree itself (§6.1). `symbols` and
      `warnings` themselves live only on `chunk` nodes, matching §5's own scope.
- [x] **Client** (`client/main.ts`, `client/style.css`): a small red circular badge with the count
      next to any rail entry or child-list item with `warningCount > 0`; a chunk's own warnings
      list at the top of its pane; inline code spans in rendered prose get post-processed against
      the chunk's `symbols` — `local`/`unresolved` get a class + hover title, `linked` gets wrapped
      in a same-page link to the declaring chunk.
- [x] Verified end-to-end against this repo's own dogfooded `/__prose/` (`vite.prose.config.ts`,
      a real RPC round trip, not just unit tests): the first pass surfaced real false-positive
      noise — file cross-references (`` `README.md` ``) and JS reserved words (`` `return` ``,
      `` `import` ``, `` `export` ``, `` `interface` ``) matched the identifier regex and were
      flagged unresolved — fixed by excluding filename-shaped spans and expanding the keyword
      skip-list (spec §5.1's own "keywords... are skipped," just a longer list than the value
      literals it names as examples), plus excluding `import.meta.*` forms (syntax, not a
      declaration site). 12 new tests (`src/checks.test.ts`, `src/git.test.ts`, plus 3 in
      `tree.test.ts`), 47 total. Both examples' `pnpm test`/`check`/`build` still pass unchanged.

## Phase 2.5 — UI improvements for `/__prose/`

Not started. The client (`client/main.ts`, `client/style.css`) has been correctness-first since
Phase 1 — vanilla DOM, no framework, functional but bare. Now that the tree carries richer data
(warnings, symbols, badges), the view itself is the weak point. Roughly in priority order:

- **Collapsible rail.** Right now every folder/file/section/chunk renders fully expanded always
  (`renderRail`'s recursion has no collapse state) — fine for `examples/single`, unusable once a
  real project's tree has hundreds of nodes. Needs: collapsed-by-default below some depth, expand
  state kept in `sessionStorage` (per-viewer convenience, not synced data), auto-expand the path
  to whatever node is currently active.
- **A quick-jump / fuzzy finder** (a `/`-triggered palette over the flattened tree, matching name
  or path) — the single biggest navigation win once the rail is collapsed by default and can't be
  scanned by eye alone.
- **Loading and error states.** `main()`'s catch block (spec'd in `client/main.ts`'s own "#
  Bootstrapping" prose) covers a hard failure, but there's no loading indicator between "page
  appears" and "tree arrives" — on a slow first RPC round trip the pane is just blank. A small
  skeleton or spinner closes that gap.
- **Breadcrumb as real links.** `renderPane`'s breadcrumb is plain text (`kind · path`) — every
  ancestor segment should link to that ancestor, the same way a file browser's path bar does.
- **Unify badge language.** Pending (text badge, amber) and warnings (numeric circle, red) look
  unrelated even though both are "this node needs attention." Worth a single small icon-badge
  system: a hover title lists *what* kind of warning(s), not just a bare count.
- **Section-heading deep links.** A chunk/section already has a stable URL (§6.1), but there's no
  affordance in the view itself to copy it — a hover "copy link" icon next to each heading, common
  in doc sites, would make that reachable without reading the address bar.
- **Show the preamble** (§3.2: "flagged, shown collapsed") — currently parsed by `parser.ts` but
  dropped entirely before it reaches a `TreeNode` (see the symbol-check gap noted in Phase 2
  above; giving the preamble a real place in the tree fixes both at once).
- **The L3 import-graph diagram** (§4) — blocked on Phase 5's `es-module-lexer` integration, but
  the UI slot for it (where in the L3 pane it renders, how a node click routes to that module's
  L1 view) can be designed and stubbed ahead of the data existing.

### Quality signals beyond lines of code

Raw LoC per file/chunk is a weak proxy on its own — it says something is big, not whether it's
healthy. Cheaper signals this data model can already produce, or could with little new
computation, and that say more:

- **Documentation coverage**: the fraction of chunks that are `undocumented` vs. have real prose,
  at any level — already computed today as a per-node `summary`, just not aggregated into a ratio.
- **Warning density** (`warningCount` per chunk, or per file) — a much more direct "is this file
  in a bad state" signal than size, since it's specifically "prose that doesn't match code" or
  "explains something that doesn't exist," not just "there's a lot of code here."
- **Staleness ratio**: fraction of a file's (or the project's) chunks flagged `stale` — §5.2's
  check is per-chunk; rolling it into a ratio per file turns "which files rot fastest" into a
  sortable list.
- **Pending ratio**: fraction of chunks that are `pending` — a live view of "how much of the plan
  is written down but not yet built," which is closer to project-management signal than code
  quality, but comes for free from the same data.
- **Chunk-size distribution, not file-size**: a single 400-line file split into twelve well-scoped
  20-30 line chunks is a different (much better) shape than one 400-line chunk — the chunk
  boundary itself, which only this tool's data model has, is a better unit than raw file LoC for
  spotting an under-decomposed change.
- **Prose-to-code ratio**: prose word count over code line count, per chunk — very low (a huge
  chunk, one line of prose) flags a chunk that's too coarse; very high (a one-line chunk, a
  paragraph of prose) isn't necessarily bad, but is worth a second look for prose that's actually
  documenting something bigger than what's shown.
- **Symbol resolution health**: the `linked`/`local`/`unresolved` split from §5.1 itself, rolled up
  — a codebase whose prose mostly points at symbols that don't resolve is a sign the prose is
  aspirational or stale in a way individual staleness checks might miss (e.g. a symbol renamed
  everywhere except in the one place prose still names the old one).

None of these need new data collection beyond what Phase 2 already built — they're aggregations
over `warningCount`/`symbols`/`pending`/`prose`/`code` that already exist on every node. A natural
home is a small "project health" panel at L3, above the folder tree, surfacing the two or three
of these that turn out to matter most in practice — worth prototyping against `examples/base`
once it has enough real content to make the numbers meaningful, rather than guessing which ratios
matter from `examples/single` alone.

## Phase 3 — editing: prose editor, remarks, full API (§6.2–§6.4)

- In-place Markdown editor with preview for any prose node; write-back into the source comment
  (or README file), preserving indentation and `@prose` marker/prefixes.
- `prose/remarks.md`: anchors, open/resolved bullets, orphaning when an anchor no longer
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
  addition to (not a replacement for) `prose/remarks.md` in the prototype's scope (§2).

## Open questions (§10)

Carried over from spec.md, unresolved: nested chunks for class members/nested functions,
LLM-based summaries beyond first paragraphs, a live agent channel instead of `remarks.md`, and
problem-layer tools referenced from pending chunks.
