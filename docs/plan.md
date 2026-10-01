# Plan

Where the project is and what comes next, in order. Finished work is a line or two: the detail lives in the code's `@prose` blocks, the tests, `git log`, and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only renderer work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.2.0, a GitHub release tarball.

- **0.1.0**: a dev route with notes, symbol and staleness checks. Used on sitez and markz it went mostly unread, so it was dropped; the parser and the tree walk carried over ([design](design.md#whats-out-and-why), [lessons](lessons.md)).
- **The rewrite**: the convention, and `prose .`, `prose build` and `prose publish` as a renderer that only reads ([reading](reading.md)).
- **0.2.0**: the README around the two things, and the docs in `docs/`.
- **Since 0.2.0**: the reader's layout (text left, file tree right, a popover on narrow screens), a `README.md` in every folder, links and headings that match how GitHub shows them, `@prose` in shell, Python and `.gitignore`, and current dependencies (Node 26 and 24, TypeScript 7).

## Next, in order

- [ ] **The README.** It opens with the problem (code changes faster than it's read), links to the docs by what a reader wants, a link and a gloss for markz, and "see it live". No screenshot until the layout is stable.
- [ ] **Install without the tarball:** `npx` or an npm install (see Later).
- [ ] **Republish the site**, so the old `examples/` content goes (`prose publish`, then `git push origin prose`).
- [ ] **Use it.**
  - Look at it in a browser on sitez and markz: typography, folded code, mobile width.
  - base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - `prose/` → `docs/` in sitez and markz ([writing](writing.md#writing-that-spans-the-code)), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
  - markz: make `@prose` blocks link to `grammar.md` instead of restating its rules ([writing](writing.md#references)).
  - Two weeks of work on sitez and markz, then decide whether the renderer stays ([reading](reading.md#test-cases)).

## Later

- [ ] Accessibility review: keyboard navigation and shortcuts (the file tree, the mode switch, code runs, jumping between pages), focus order, and screen-reader names.
- [ ] A screenshot of a rendered file in the README, once the layout is stable.
- [ ] Publish to npm once the CLI has settled; check whether an unscoped name is available for `npx`.

Open questions are in [reading](reading.md#open-questions).
