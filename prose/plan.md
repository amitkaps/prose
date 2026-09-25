# Plan

Roadmap for building `prose/spec.md`; section numbers refer to it. This file holds only what spans the codebase: the order of the work and items that touch several files. Work that belongs to one file is a pending `@prose` chunk in that file (spec §1, §8), and this file links to it. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `prose/lessons.md`.

## Done

In the order it landed.

- **Skeleton** — plugin, parser, read-only `/__prose/` on Devframe (`@devframes/vite`, `auth: false`), `examples/single`, `tsdown` + `vite-plus` toolchain, the repo dogfooded with `@prose`.
- **Checks** — symbol check (`oxc-parser`) and staleness check (`git blame --porcelain`), warnings rolled up per node (§5.1–§5.2).
- **Annotator** — `@note` parser, write-back (`src/notes.ts`), `add-note`/`resolve-note` RPC, client UI (§6.2–§6.3).
- **More languages** — `.svelte`, `.md`, `.yaml`/`.toml`; HTML-strip build hook; live updates via Devframe `SharedState`; `examples/base` converted; §8 snippet in its `AGENTS.md`.
- **Svelte client** — Svelte 5 (runes); cascade layers and tokens; collapsible rail, quick-jump palette, loading and error states, breadcrumbs, one badge system, copy-link, `raw` nodes for JSON, project-health panel.
- **File as the leaf** — files are the smallest navigable unit (§3.2); a file page reads the whole file in source order with each block in place; every block, the file prose included, takes a `@note`.
- **CI** — `check`, `test`, `build` on every PR (#2).
- **Review decisions** — `prose/review.md` settled; spec, plan and code prose updated to match.

## Open work, in order

Steps 1–3 come before anything that builds on anchors or writes (dev tools, `prose/` sync).

### 1. Safe writes (spec §6, "Trust boundary"; §6.2–§6.3)

- [ ] Note escaping, path validation and the content-hash guard: pending chunk "Safe writes" in `src/notes.ts`.
- [ ] Refuse writes when the dev server listens on a non-loopback address; refuse cross-origin WebSocket connections (`src/plugin.ts`, and whatever Devframe exposes for it).
- [ ] Client sends the block hash with `add-note`/`resolve-note` and shows the fresh block when a write is refused (`client/store.svelte.ts`, `Note.svelte`).
- [ ] Property tests (fast-check) on the write path: add→resolve is byte-identical for any note text (`*/`, `-->`, `@prose`, CRLF, tabs, unicode, empty); adding twice leaves one note; other blocks untouched.
- [ ] Git-aware walk and root-only `prose/` skip: pending chunk "A git-aware walk" in `src/tree.ts`.

### 2. Anchors (spec §3.2)

- [ ] Content-derived anchors: pending chunk in `src/parser.ts`. Update `client/nav.ts` and the examples' links to the new form.
- [ ] Metamorphic test: inserting a block anywhere at top level never changes which block an existing anchor resolves to.

### 3. Parser on oxc for JS/TS, and line notes (spec §3.1, §6.2)

- [ ] Pending chunk "Comments from oxc for JS and TS" in `src/parser.ts`, including the below-depth-0 warning.
- [ ] Line notes: `@note` found at any depth in every language; a note after a `@prose` block is a block note, any other a line note.
- [ ] Legal insertion point for a line note: enclosing statement (oxc AST), element, CSS rule or declaration, YAML/TOML key; never inside a string, template literal, `<pre>`/`<textarea>`, attribute list or block scalar.
- [ ] `add-note` by `file:line` + line hash; `resolve-note` by the note's own position + text hash.
- [ ] Client: add a note from a code line's gutter, preview where it lands, show line notes inline; counts roll up with block notes.
- [ ] Tests: the insertion cases in spec §9.2, plus the step 1 property tests extended to line notes.

### 4. The *since* view (spec §6.5)

- [ ] Server: diff the working tree against `HEAD` or a given ref, per block (changed prose, changed code, new pending, removed notes).
- [ ] Client: rail toggle (`HEAD` / ref / last reviewed); a **Mark reviewed** action stores the baseline (per-block hashes and open notes) in browser storage; opening a page never moves it; badges roll up.
- [ ] Staleness ignores reformats: pending chunk in `src/git.ts`.

### 5. Polish on the file view

Nothing here is decided; each is a choice to make when it starts to matter.

- [ ] **Notes in Markdown**: READMEs and `prose/*.md` (spec §10).
- [ ] **Per-block staleness badge** in the margin; the file badge counts them today.
- [ ] **Inline view for `.svelte`**: highlight each code run by the language of the part it sits in.
- [ ] **Symbol-check noise on file prose** (about 20 warnings in this repo, mostly external names): ignore list, `package.json`/imports as known (partly done), or a per-block opt-out. Label them true/false first and track the false-positive rate.
- [ ] **Staleness for the file prose**: compare against the newest code anywhere in the file.
- [ ] **Raw source toggle** on the file page.
- [ ] **`examples/base`'s prose in the new model**: `app.css` has only a file-level block; decide whether it should carry more.
- [ ] **Size signal**: line and block counts per file, feeding the "ask for a split with a `@note`" workflow (§3.2).
- [ ] **Folding**: collapse the file prose or blocks on long files.

### 6. Dev tools, diagram, CLI/MCP (spec §4, §7, §8, §10)

- [ ] `dev/*.tool.ts` discovery via `import.meta.glob`, listed under **Tools**; then `dev/docs.tool.ts` and one pending chunk in `examples/base`.
- [ ] Import graph from `oxc-parser`'s module records, grouped by folder, linked to L1 views.
- [ ] `prose check` CLI for the §5 warnings (Devframe's `cac` adapter). Add it to the §8 snippet only once it exists.
- [ ] Evaluate Devframe's MCP adapter to expose `tree`/`node`/notes to an agent (§10).

### 7. Sync `prose/` with `@prose` (spec §5.3)

Ordered by cost. Needs step 2's anchors.

- [ ] **(a) Section references** (`§N` against the named doc's numbered headings): first, since section references in code prose have already drifted once.
- [ ] **(b) Symbol check on `prose/*.md`**, in `proseDocs` (`src/tree.ts`) and `src/checks.ts`.
- [ ] **(c) Anchor references**: `[x](src/store.ts#addTodo)` and `@prose` links to `prose/*.md#heading`. Subfolders of `prose/` need the walker to recurse first (§10).
- [ ] **(d) Doc staleness**: paragraph-level blame against the chunks a paragraph references.
- [ ] **(e) Duplication check** and **L3 backlinks**.
- [ ] **(f) Evaluate** `covers:` frontmatter.

### Testing, alongside the steps above

- [ ] Run the §9.2 checklist item by item (`check`/`test`/`build` pass; the rest is only informally confirmed).
- [ ] Build check in CI: `examples/*` built with the plugin on and off, `dist/` diffed; no `@prose`/`@note` in built HTML.
- [ ] Playwright against `dev:prose` and `examples/base`: navigate, add a note and check the file on disk, edit a file and see the view update, `/__prose` without the trailing slash.
- [ ] Git fixture repos for staleness: code-only, prose-only, both, uncommitted, reformat-only, rebase, squash.
- [ ] Open the view on a ~500-file repo once and check it stays usable (spec §2).
- [ ] Parser over a corpus of real repos: never throws; reassembling blocks, code and notes gives the original bytes.
- [ ] The §1 five-minute test, run for real: an agent makes ~30 changes to `examples/base`, then answer the four questions from `/__prose/` alone and from `git log -p` alone, and compare.

## Open questions

See spec §10.
