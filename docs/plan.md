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

### 4. Use it

- [ ] Look at it in a browser on sitez and markz: typography, folded code, mobile width.
- [ ] Mobile: the button that shows the rail is an explorer icon, not the word **Files**.
- [ ] Mobile: the bar stacks, the breadcrumb on one row and the **Prose & Code / Prose only** switch below it. Today they share a fixed row, and a long path is squeezed until it breaks one character per line.
- [ ] base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
- [ ] `prose/` → `docs/` in sitez and markz ([convention](convention.md#writing-that-spans-the-code)), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
- [ ] markz: make `@prose` blocks link to `grammar.md` instead of restating its rules ([convention](convention.md#references)).
- [ ] Two weeks of work on sitez and markz, then decide whether the renderer stays ([spec](spec.md#test-cases)).

### Later

- [ ] `@prose` in `.gitignore`: its `#` comments are what the YAML and TOML scanner reads, so it's a mapping by file name and a row in [the convention](convention.md#prose-blocks). Python, shell, `Dockerfile` and `Makefile` use the same comment, when a repo has them.
- [ ] Publish to npm once the CLI has settled; check whether an unscoped name is available for `npx`.

## Open questions

See [the open questions](spec.md#open-questions).
