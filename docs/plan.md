# Plan

Where the project is and what comes next, in order. Finished work is a line or two: the detail lives in the code's `@prose` blocks, the tests, `git log`, and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only renderer work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.3.0, on npm as `@amitkaps/prose` and as a GitHub release tarball.

- **0.1.0**: a dev route with notes, symbol and staleness checks. Used on sitez and markz it went mostly unread, so it was dropped; the parser and the tree walk carried over ([design](design.md#whats-out-and-why), [lessons](lessons.md)).
- **The rewrite**: the convention, and `prose .` and `prose build` as a renderer that only reads ([reading](reading.md)).
- **0.2.0**: the README around the two things, and the docs in `docs/`.
- **0.3.0**: the reader's layout (text left, file tree right, a popover on narrow screens), a `README.md` in every folder, a README that opens with the problem and links to the docs, links and headings that match how GitHub shows them, `@prose` in shell, Python and `.gitignore`, current dependencies (Node 26 and 24, TypeScript 7), an npm release (the workflow stages each version for approval on npmjs.com).
- **The site on Cloudflare, and no `prose publish`**: a Worker builds from `main` with `wrangler.toml` in the repository, so a merge deploys it and prose holds no host code ([usage](usage.md#deploying-this-site)). The command that committed a site to a branch was dropped: the one site that could have used it deploys without it, and other projects will do the same.
- **Reading on any screen**: the breadcrumb runs from the project's name, the page grows with a wide window, tables and code samples widen past the text, the bar links the docs `docs/README.md` lists, folder pages group what's in them, a long page has a table of contents, and EBNF is highlighted ([reading](reading.md#pages)). A view in the URL was tried and dropped ([design](design.md#whats-out-and-why)).

## Next, in order

- [ ] **Use it.**
  - Look at it in a browser on sitez and markz: typography, folded code, mobile width.
  - base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - `prose/` → `docs/` in sitez and markz ([writing](writing.md#writing-that-spans-the-code)), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
  - markz: make `@prose` blocks link to `grammar.md` instead of restating its rules ([writing](writing.md#references)).
  - Two weeks of work on sitez and markz, then decide whether the renderer stays ([reading](reading.md#test-cases)).

## Later

- [ ] Accessibility review: keyboard navigation and shortcuts (the file tree, the mode switch, code runs, jumping between pages), focus order, and screen-reader names.
- [ ] A screenshot of a rendered file in the README, once the layout is stable.

Open questions are in [reading](reading.md#open-questions).
