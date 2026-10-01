# Plan

The order of the work and items that touch several files. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and [lessons.md](lessons.md).

## Done

- **0.1.0** — a dev route on Devframe with a Svelte client, notes, symbol and staleness checks. Used on sitez and markz it went mostly unread, so it was dropped; the parser and the tree walk carried over ([design](design.md#whats-out-and-why), [lessons](lessons.md)).
- **The rewrite** — the convention plus a read-only renderer, the dropped code cut.
- **`prose .`** — `cli.ts`, `server.ts`, `render.ts`: folder, Markdown, source and plain-text pages as server-rendered HTML, with live reload and the file tree ([spec](spec.md)).
- **`@prose` at any depth** — a block counts inside a class, function or rule when it starts its own line, named from the declaration below it.
- **`prose build`** — the same pages as static files from `HEAD`, with its own 404 page ([spec](spec.md#prose-build)).
- **`prose publish`** — the build committed to an orphan `prose` branch, never checked out and never pushed; this repo is [prose.amitkaps.com](https://prose.amitkaps.com) ([spec](spec.md#prose-publish)).
- **Every file in the walk** — dotfiles, `LICENSE`, lockfiles and images get a page; ignored files are one line on their folder's page.
- **0.2.0** — the README around the two things, released as a GitHub release tarball.
- **`docs/`** — writing that spans the code lives in `docs/`, not `prose/`.
- **Tests and docs layout** — tests in `tests/`, the fixture in `tests/fixtures/simple`, and the docs split into [design](design.md), [convention](convention.md), [usage](usage.md) and [spec](spec.md).

## Open work, in order

### The reader's layout

Reading first: the text on the left, the explorer on the right. Agreed 2026-10-01; each step is its own PR.

- [x] **Footer: Snapshot and Live.** The rail's footer says **Live** (dim when the server is lost) on `prose .`, and **Snapshot · tag · commit** on a built site, the tag only when `HEAD` is exactly that tag, with a GitHub mark linking to the repository. The tag used to be the nearest earlier one, so a site built after a release named it wrongly.
- [x] **Layout.** The reading column left-aligned, the rail pinned to the right edge. The bar is the project name at the top left (plain text, a link to `/`, not underlined), the **Prose & Code / Prose only** switch, and the explorer toggle at the right. The breadcrumb moves to the top of the reading column, where it wraps, with **Open in editor** at its end, local only. This replaces the two mobile items under *Use it*.
- [x] **Rail.** A sidebar-panel icon (right side) in place of the word **Files**; open by default on desktop, remembered, hidden on mobile where it slides over from the right. A folder's name opens its page, the chevron alone folds it, and a folder's `README.md` is listed first in it, highlighted on the folder page. Every tracked file is listed, dotfiles included; what `.gitignore` leaves out stays out.

### Fix what the first readers found

An outside review of the published site (2026-10-01). The site it read predates the docs split and still has `examples/`, so republish first and re-read before judging. Checked against the code: `index.html.html` is intended (the folder page owns `index.html`; [spec](spec.md#prose-build)), and `main.js`/`style.css` resolve either way, but the rail links them root-absolute and the folder listing relative.

Make the repository follow its own convention:

- [ ] A `README.md` in `.github/`, `docs/`, `src/` and `tests/`. `docs/README.md` is the reading order for the docs, so the root README can stop indexing them. This fixes the landing page's four *undocumented* folders.
- [ ] Audit every first paragraph against the agent rules: three lines, what the file means and not what its code does. `src/parser.ts` is the known miss. Cite the convention once per file, not in every block; the links added in the docs split made the paragraphs longer.
- [ ] Say the summary rule once, in [spec](spec.md#pages): a file that could carry prose and has none is *undocumented*; one that can't (`LICENSE`, `package.json`, lockfiles, images) shows its type and nothing else.

Reader fixes:

- [ ] `/** @prose *\/` shows its backslash: the parser unescapes `*\/` to `*/` in a block's body.
- [ ] Headings inside a source file's blocks render one level down, so a block's `# Filtering` is an `h2` under the file's own `h1`. Decide whether the file prose keeps its level.
- [ ] A run's header reads `75 lines · 9–83 · ts`, with the separator in the markup, not only in CSS.
- [ ] One link form: root-absolute everywhere (rail, listing, breadcrumb).
- [ ] A folder's `README.md`: a "from `README.md`" line under the breadcrumb on the folder page, and `/folder/README.md` redirecting to `/folder/`. A static host can't redirect, so `build` writes `folder/README.md.html` as a meta refresh.

README and docs:

- [ ] The README opens with the problem (code changes faster than it's read), a screenshot of a rendered file, and a link and a gloss for markz. "Read with it" becomes "see it live".
- [ ] `Develop` and `Release` move out of the README to `docs/development.md`, where `node dist/cli.js` is the right command; the README says `prose` throughout.
- [ ] `npx` or an npm install in place of the tarball (see Later).

### 4. Use it

- [ ] Look at it in a browser on sitez and markz: typography, folded code, mobile width.
- [ ] base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
- [ ] `prose/` → `docs/` in sitez and markz ([convention](convention.md#writing-that-spans-the-code)), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
- [ ] markz: make `@prose` blocks link to `grammar.md` instead of restating its rules ([convention](convention.md#references)).
- [ ] Two weeks of work on sitez and markz, then decide whether the renderer stays ([spec](spec.md#test-cases)).

### Later

- [ ] Accessibility review: keyboard navigation and shortcuts (the file tree, the mode switch, code runs, jumping between pages), focus order, and screen-reader names.
- [ ] `@prose` in `.gitignore`: its `#` comments are what the YAML and TOML scanner reads, so it's a mapping by file name and a row in [the convention](convention.md#prose-blocks). Python, shell, `Dockerfile` and `Makefile` use the same comment, when a repo has them.
- [ ] Publish to npm once the CLI has settled; check whether an unscoped name is available for `npx`.

## Open questions

See [the open questions](spec.md#open-questions).
