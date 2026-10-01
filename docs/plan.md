# Plan

Roadmap for building `docs/spec.md`; section numbers refer to it. This file holds the order of the work and items that touch several files. Finished work is one line each: the detail lives in the code's `@prose` blocks, the tests, `git log`, and `docs/lessons.md`.

## Done

- **0.1.0 and after** — a dev route on Devframe with a Svelte client, the `@note` annotator with safe writes, symbol and staleness checks, the HTML strip, and a released tarball (#2–#14). The parser (comments from `oxc-parser`, content-derived anchors, `.svelte`/YAML/TOML scanners) and the git-aware tree walk carry over; the rest is dropped ([design](design.md#whats-out-and-why)).
- **Field use and the rewrite** — sitez and markz used 0.1.0; the route, notes and checks went unused, the `prose/` docs and `@prose` were read (`lessons.md`). The spec is now the convention plus a read-only renderer (#15–#17).
- **Cut the dropped code** — Devframe, the client, the Vite plugin, notes, checks and git blame are gone; the parser keeps blocks, chunks, pending and anchors (`declaredIdentifiers` moved to `src/names.ts`), and `src/tree.ts` is a plain walk with `prose/` as an ordinary folder. The library exports the parser and the tree until `prose .` lands.
- **`prose .`** — `src/cli.ts`, `src/server.ts`, `src/render.ts`, `src/highlight.ts`, `src/style.ts`: folder, Markdown, source and JSON pages as server-rendered HTML, weaving ported from the 0.1.0 client, Markdown through markz, shiki on the WASM engine with a content-keyed cache, live reload over server-sent events, default port 1234, Node 26 (markz requires it). The file tree on the left (`src/rail.ts`), from the walk's file list alone, as the 0.1.0 client's rail was. Code shown by default with file line numbers, wrapped with a hanging indent, tabs at two; a remembered **Prose & Code / Prose only** switch, centred in the bar; a header on every run (chevron, lines, language) that stays when collapsed; code widened to 100 columns beside a prose measure; shiki's CSS-variables theme in the page's palette; the rail restored before first paint and held still by a view transition. Speed: parses cached by modification time, the highlighter started with the server, links prerendered on hover, and live reload connected only while a page is visible, since six idle tabs holding one connection each left new pages waiting.
- **`@prose` inside a class** — a JS, TS or CSS block counts at any depth when it starts its own line, so markz's `class Parser` reads method by method (`block.ts`, 16 blocks where it had one). A block inside a class or function is named by the first member or declaration below it, from the file's AST (`declaredAfter` in `src/names.ts`). YAML and TOML keep column 0.
- **`prose build`** — the reader as static files (spec §4.4): `renderRoute` in `server.ts` is the seam the server and `src/build.ts` share; `HEAD` exported with `git archive`; a file's page at its path plus `.html`, which a GitHub Pages spike (`amitkaps/pages`) showed is served at the local URL with no redirect, and a source `index.html` at `index.html.html`; the tag and commit in the bar, no live parts, the same bytes per commit; output in `.prose/site`, a folder it made or none. Cloudflare's `.html` handling is untested.
- **`prose publish`** — the build committed to an orphan `prose` branch through a temporary index, `commit-tree` and a conditional `update-ref`, never checking it out and never pushing (spec §4.5, `src/publish.ts`); `--domain` writes `CNAME`, carried forward; `.nojekyll`. This repo publishes to `prose.amitkaps.com` (DNS on Cloudflare, DNS-only, to `amitkaps.github.io`), so no site needs a base path yet.
- **Every file in the walk** — every file git lists has a page (spec §4.1, §4.2): dotfiles, `LICENSE`, lockfiles, images. Text past 1,000 lines or 100 KB is cut with what's left said; a binary file gives its type and size, an image shown inline as a `data:` URL; lockfiles and files over 200 KB aren't parsed for prose. Ignored files stay out of the rail; locally a folder's page ends with `Ignored here:`, which the build leaves out. The walk never follows a symbolic link, so a build can't publish a file outside the commit.
- **A 404 page** — `prose build` writes `404.html` with the file tree, which GitHub Pages and Cloudflare serve for any missing address, and GitHub Pages for all of `.github/`, which it never publishes (a spike on `amitkaps/pages`).
- **0.2.0** — the README rewritten around the two things, with install, the commands and the §5 snippet; released as a GitHub release tarball, as 0.1.0 was.
- **`docs/`** — the folder for writing that spans the code is `docs/`, not `prose/`, so "prose" names only the package and the `@prose` marker; `.gitignore` cut to what this repo produces.

## Open work, in order

### 4. Use it

- [ ] Look at it in a browser on sitez and markz: typography, folded code, mobile width.
- [ ] Mobile: the button that shows the rail is an explorer icon, not the word **Files**.
- [ ] Mobile: the bar stacks, the breadcrumb on one row and the **Prose & Code / Prose only** switch below it. Today they share a fixed row, and a long path is squeezed until it breaks one character per line.
- [ ] base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with spec §5, and fold sitez's open `@note` (`src/site.ts`) into its prose.
- [ ] `prose/` → `docs/` in sitez and markz ([convention](convention.md#writing-that-spans-the-code)), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
- [ ] markz: make `@prose` blocks link to `grammar.md` instead of restating its rules ([convention](convention.md#references)).
- [ ] Two weeks of work on sitez and markz, then decide whether the renderer stays (spec §7).

### Later

- [ ] `@prose` in `.gitignore`: its `#` comments are what the YAML and TOML scanner reads, so it's a mapping by file name and a row in spec §3.1. Python, shell, `Dockerfile` and `Makefile` use the same comment, when a repo has them.
- [ ] Publish to npm once the CLI has settled; check whether an unscoped name is available for `npx`.

## Open questions

See spec §8.
