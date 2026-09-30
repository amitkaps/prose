# Plan

Roadmap for building `docs/spec.md`; section numbers refer to it. This file holds the order of the work and items that touch several files. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `docs/lessons.md`.

## Done

- **0.1.0 and after** — a dev route on Devframe with a Svelte client, the `@note` annotator with safe writes, symbol and staleness checks, the HTML strip, and a released tarball (#2–#14). The parser (comments from `oxc-parser`, content-derived anchors, `.svelte`/YAML/TOML scanners) and the git-aware tree walk carry over; the rest is dropped (spec §6).
- **Field use and the rewrite** — sitez and markz used 0.1.0; the route, notes and checks went unused, the `prose/` docs and `@prose` were read (`lessons.md`). The spec is now the convention plus a read-only renderer (#15–#17).
- **Cut the dropped code** — Devframe, the client, the Vite plugin, notes, checks and git blame are gone; the parser keeps blocks, chunks, pending and anchors (`declaredIdentifiers` moved to `src/names.ts`), and `src/tree.ts` is a plain walk with `prose/` as an ordinary folder. The library exports the parser and the tree until `prose .` lands.
- **`prose .`** — `src/cli.ts`, `src/server.ts`, `src/render.ts`, `src/highlight.ts`, `src/style.ts`: folder, Markdown, source and JSON pages as server-rendered HTML, weaving ported from the 0.1.0 client, Markdown through markz, shiki on the WASM engine with a content-keyed cache, live reload over server-sent events, default port 1234, Node 26 (markz requires it). The file tree on the left (`src/rail.ts`), from the walk's file list alone, as the 0.1.0 client's rail was. Code shown by default with file line numbers, wrapped with a hanging indent, tabs at two; a remembered **Prose & Code / Prose only** switch, centred in the bar; a header on every run (chevron, lines, language) that stays when collapsed; code widened to 100 columns beside a prose measure; shiki's CSS-variables theme in the page's palette; the rail restored before first paint and held still by a view transition. Speed: parses cached by modification time, the highlighter started with the server, links prerendered on hover, and live reload connected only while a page is visible, since six idle tabs holding one connection each left new pages waiting.
- **`docs/`** — the folder for writing that spans the code is `docs/`, not `prose/`, so "prose" names only the package and the `@prose` marker; `.gitignore` cut to what this repo produces.

## Open work, in order

### 2a. `@prose` inside a class

- [ ] A `/** @prose` block counts at any depth when it starts its own line (only indentation before it), so markz's `class Parser` reads method by method (`block.ts`). Its chunk runs to the next block, as now; a block inside a function splits that function into two runs. `declaredIdentifiers` learns method names, for a block with no heading. JS, TS, CSS and HTML first; YAML and TOML keep column 0 until a repo needs otherwise. Spec §3.1.

### 2b. `prose build`: a static snapshot of the reader

`prose .` reads the working tree through the local server; `prose build` writes the same pages as static files, for any static host. One renderer, not a second site: the build calls what the server calls.

- [ ] **Spike first, on GitHub Pages**, the host for open-source repos (2c), and Cloudflare. GitHub Pages sets no headers and types a file by its extension (`.ts` is `video/mp2t`), so a page can't sit at `src/expression.ts`. Two layouts to try: `src/expression.ts.html`, if Pages serves `/src/expression.ts` from it as it serves `/about` from `about.html`; else `src/expression.ts/index.html`, which Pages reaches from `/src/expression.ts` by redirecting to the trailing slash. Whichever works on Pages is the layout, since it also works on Cloudflare. A two-file deploy answers it.
- [ ] **The seam.** Split `respond()` in `server.ts` into `renderRoute(root, files, path)` (a page, a redirect, or not found) and the HTTP around it. The build lists the routes (every file in the walk and every folder) and writes each result. A test holds the two to the same HTML, less the live-only parts.
- [ ] **URLs stay as they are.** `/src/expression.ts` locally is `/src/expression.ts` on the host: a folder's page is `folder/index.html`. The site sits at the domain's root, so links stay absolute (`/src/`), no base path. The spike decides which file backs that URL (`src/expression.ts.html`, or `src/expression.ts/index.html` with a trailing slash). A repo file named `index.html` collides with its folder's page; decide it after the spike.
- [ ] **What it publishes: tracked files only, as committed.** The build reads `HEAD` (`git ls-files` for the list, `git show HEAD:path` for the text), which is what the public repository already shows: no untracked scratch file or `.env` is published, and no ignored file, not even dimmed. It warns when the working tree has uncommitted changes, since those aren't in the build.
- [ ] **Live-only parts drop out.** No live-reload script, no `data-rendered` time, no **Open in editor** (its `vscode://file/Users/…` link would publish a local path). In its place in the bar: the version, `v0.1.1 · 74ba94f` (nearest tag, then the short commit; the commit alone before a first tag), so a reader knows which snapshot they're reading. Same input, same bytes: rebuilding an unchanged commit changes no file.
- [ ] **Output in `.prose/site/`**, `--out <dir>` to change it. The walk always skips the output folder; the build warns if `.prose/` isn't in `.gitignore`, never edits `.gitignore` itself, and refuses an output folder that holds tracked files. It ends with one line: pages written, where, from which commit.
- [ ] Tests: builds `examples/single`; the rail on every page; a Markdown page and a source page with its blocks; every link in the output resolves to a written page; no page references `/.prose/events` or `vscode://`; an untracked file isn't written; two builds are byte-identical.
- [ ] Spec: §4 gains `prose build`; §6's **Publishing** narrows to what stays out (a docs site with its own navigation, deploy targets, hosting config).

### 2c. `prose publish`

- [ ] `prose publish [--branch prose]`: build, then commit the output to the `prose` branch (an orphan branch holding only the site), without checking it out or touching the working tree: a temporary index, `git commit-tree` on the branch's last commit, `git update-ref`. Pushing stays a separate `git push origin prose`, so nothing leaves the machine unasked. A host deploys from that branch; the build being byte-identical means each publish commit holds only the pages that changed. Commit message: the source commit it was built from.
- [ ] `--domain abc.amitkaps.com` writes a `CNAME` file at the branch's root, so GitHub Pages serves the branch at that domain (Pages source: the `prose` branch, root; DNS: a CNAME record to `amitkaps.github.io`, DNS-only until GitHub issues the certificate). Given once: later publishes carry the branch's `CNAME` forward, so the domain lives in the one file Pages reads, with no config file (`--domain` again replaces it, `--no-domain` drops it). The branch also gets a `.nojekyll`, or Jekyll drops every path starting with `.` or `_`. Without `--domain`, no `CNAME` file, and the site stays at `<user>.github.io/<repo>/`, which needs the links to work under a base path: decide that when a repo first wants it.

### 2d. Every file in the walk

- [ ] Show every file git lists, not a set of extensions: dotfiles (`.gitignore`, `.github/`), `LICENSE`, snapshots, lockfiles. A text file is a highlighted run (plain text for an unknown language), capped with "… N more lines" past a size; a binary file is a small page with its size and type, an image shown inline. Spec §4.2.
- [ ] Locally, ignored entries appear dimmed and closed, at the level `.gitignore` names them (`git ls-files --others --ignored --exclude-standard --directory`: `node_modules/`, `dist/`), never walked into. Dim means ignored and nothing else. The build leaves them out (2b).
- [ ] Look at it in a browser on sitez and markz before the release: typography, folded code, mobile width.

### 3. Release 0.2.0

- [ ] README rewritten around the two things (spec intro), with the §5 snippet to copy.
- [ ] Release 0.2.0 as a GitHub release tarball, as 0.1.0 was.

### 4. Use it

- [ ] base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with spec §5, and fold sitez's open `@note` (`src/site.ts`) into its prose.
- [ ] `prose/` → `docs/` in sitez and markz (spec §3.4), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
- [ ] markz: make `@prose` blocks link to `grammar.md` instead of restating its rules (spec §3.5).
- [ ] Two weeks of work on sitez and markz, then decide whether the renderer stays (spec §7).

### Later

- [ ] Publish to npm once the CLI has settled; check whether an unscoped name is available for `npx`.

## Open questions

See spec §8.
