# Plan

Roadmap for building `prose/spec.md`; section numbers refer to it. This file holds the order of the work and items that touch several files. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `prose/lessons.md`.

## Done

In the order it landed. Everything up to 0.1.0 built the dev route that spec §7 now lists as dropped; the parser, the tree walk and the checks carry over.

- **Skeleton** — plugin, parser, read-only `/__prose/` on Devframe, `examples/single`, `tsdown` + `vite-plus` toolchain, the repo dogfooded with `@prose`.
- **Checks** — symbol check (`oxc-parser`) and staleness check (`git blame --porcelain`) (§5.1–§5.2).
- **Annotator** — `@note` parser, write-back, client UI.
- **More languages** — `.svelte`, `.md`, `.yaml`/`.toml`; HTML-strip build hook; the real app (now `amitkaps/base`) converted.
- **Svelte client** — rail, palette, badges, project-health panel.
- **File as the leaf** — files are the smallest navigable unit (§3.2).
- **CI** — `check`, `test`, `build` on every PR (#2).
- **Safe writes, anchors, parser on oxc, line notes** — content-derived anchors (§3.2) and JS/TS comments from `oxc-parser` (§3.1) carry over; the write path doesn't.
- **Installable, 0.1.0** — `vp pack`, `release.yml` attaches the packed tarball to a GitHub Release on a `vX.Y.Z` tag (#8).
- **Real-app test case** — `amitkaps/base` installs the released tarball (amitkaps/base#17).
- **Field use and the pivot** — sitez and markz used 0.1.0; the route and `@note` went unused, the `prose/` docs and `@prose` were read (spec §1, §7; `lessons.md`). Spec rewritten around a Markdown viewer and a checker.

## Open work, in order

### 1. Cut the dropped code

- [ ] Remove Devframe (`devframe`, `@devframes/vite`), the Svelte client (`client/`), `scripts/check-client-bundle.mjs`, `src/server/`, `src/notes.ts`, `src/insertion.ts`, and `@note` handling in `src/parser.ts`, with their tests. `fast-check` goes if nothing else uses it.
- [ ] `prose()` keeps only the HTML strip (§6.4), `@prose` only.
- [ ] Update the code's `@prose` and its `§N` references to the new spec; README to match.

### 2. `prose check` (spec §5.4)

- [ ] A `prose` bin with `check [root]` and `--strict`, over the existing `tree.ts` and `checks.ts`. No Vite.
- [ ] Output: `file:line  kind  message`, grouped by file, a count at the end.
- [ ] Run it in this repo's CI with `--strict`.

### 3. `prose serve` (spec §6)

- [ ] `node:http` server, loopback by default, `--port`/`--host`; serves only files in the tree (§6.3).
- [ ] Pages: project, folder, doc, source file as one Markdown document with folded code, **Show code** toggle, anchors as fragments (§6.1).
- [ ] Server-side highlighting (shiki, `shiki/core` with explicit languages, per `lessons.md`); one stylesheet, light and dark.
- [ ] Live reload: a watcher plus a server-sent event.
- [ ] Links: relative Markdown links resolve to viewer pages; an editor link on every page.

### 4. Release 0.2.0 and move the field repos to it

- [ ] Release 0.2.0.
- [ ] `amitkaps/base`, `amitkaps/sitez`, `amitkaps/markz`: install it, update the §8 snippet in `AGENTS.md`, fold the open `@note` in sitez's `src/site.ts` into its prose, and run `prose check`.
- [ ] markz: make `@prose` blocks link to `grammar.md` instead of restating its rules (§3.5); use it as the first case for §5.3's duplication check.
- [ ] Run the §9.2 checklist.

### 5. Sync `prose/` with `@prose` (spec §5.3)

Ordered by cost.

- [ ] **(a) Section references** (`§N` against the named doc's numbered headings): first, since they have already drifted twice.
- [ ] **(b) Anchor references**, both directions (§5.3 item 2).
- [ ] **(c) Symbol check on `prose/*.md`**, in `proseDocs` (`src/tree.ts`) and `src/checks.ts`.
- [ ] **(d) Duplication** between `@prose` and `prose/` (§5.3 item 5).
- [ ] **(e) Doc staleness**: paragraph-level blame against the chunks a paragraph references.
- [ ] **(f) Evaluate** `covers:` frontmatter.

### Checks polish

- [ ] **Symbol-check noise** (about 20 warnings in this repo, mostly external names): label them true/false first, then an ignore list or a per-block opt-out.
- [ ] **Staleness ignores reformats**: pending chunk in `src/git.ts`.
- [ ] **Staleness for the file prose**: compare against the newest code anywhere in the file.

### Distribution

- [ ] Publish to a registry (npm `@amitkaps/prose`) once the CLI has settled; decide the versioning policy before 1.0.

### Testing, alongside the steps above

- [ ] Parser over a corpus of real repos (the three in §9.2 first): never throws; reassembling blocks and code gives the original bytes.
- [ ] Git fixture repos for staleness: code-only, prose-only, both, uncommitted, reformat-only.
- [ ] `prose serve` against `examples/single` in a test: each page kind returns 200 with the expected headings; a path outside the root is a 404.

## Open questions

See spec §10.
