# Plan

Where the project is and what comes next, in order. Finished work gets a line or two. The detail lives in the code's `@prose`, the tests, `git log` and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only renderer work. This repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.3.0, on npm as `@amitkaps/prose` and as a GitHub release tarball.

### Since 0.3.0

- **The site on Cloudflare.** A Worker builds from `main`, so a merge deploys it ([usage](usage.md#deploying-this-site)). `prose publish` was dropped, since the one site that could use it deploys without it.
- **Reading on any screen.** A breadcrumb from the project's name, docs in the bar, folder pages in groups, a table of contents on a long page, and wider tables and code samples ([reading](reading.md#around-the-page)). A view in the URL was tried and dropped.
- **The renderer stays.** Its pages became the user documentation for this repository and for markz, so it has earned its place ([lessons](lessons.md#what-gets-read)).
- **The docs in plain sentences.** The [agent rules](usage.md#for-agents) ask for one idea per sentence. The docs were rewritten to follow them, and no longer teach chunks or a layout for `docs/`.

### 0.3.0

- **The reader's layout.** Text on the left and the file tree on the right, with the tree over the page on a narrow screen. Links and headings match how GitHub shows them.
- **More of the repository.** A `README.md` in every folder, and `@prose` in shell, Python and `.gitignore`.
- **A release on npm.** The workflow stages each version for approval on npmjs.com ([development](development.md)).

### 0.2.0

- **The rewrite.** The convention, and a renderer that only reads, as `prose .` and `prose build` ([reading](reading.md)).
- **The docs.** A README built around the two things, and the docs in `docs/`.

### 0.1.0

- **A larger tool.** A dev route inside the app, notes in the source, and symbol and staleness checks. On sitez and markz it went mostly unread, so it was dropped. The parser and the tree walk carried over ([lessons](lessons.md#what-use-taught)).

## Next, in order

- [ ] **Simplify the parser to match the convention.** The docs no longer teach chunks, pending blocks or name anchors, so the code that makes them can go.
  - A comment's link comes from its heading's id, as markz makes it, with duplicates in one file made unique. A comment without a heading has no link. Check sitez and markz for links to name anchors first.
  - Remove `names.ts` and its tests. oxc stays only to find JS and TS comments, and the AST walk for declared names goes.
  - Remove sections, anchor assignment, the `chunk-N` fallback, the preamble and the pending flag, with its mark and its CSS. A file becomes its summary and a list of comments, each with its span and body.
  - A comment counts when it starts its own line, at any depth. That replaces the statement ranges in the JS path and the depth counter in the CSS scanner.
  - Stop reading prose from Python and shell. Neither is used here or in the field repos, and Python's docstrings and indentation would need rules nobody is testing. YAML, TOML and `.gitignore` stay, since this repository's workflows, `wrangler.toml` and `.gitignore` carry prose. Update the table in [writing](writing.md#in-each-language) in the same change.
- [ ] **Use it on base, sitez and markz.**
  - Install the latest release, and remove `prose()` from their Vite configs. Replace the snippet in their `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - Move `prose/` to `docs/` in sitez and markz, with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website, so that moves to `site/` first, with its root scripts, workspace, package name and CI paths.
  - In markz, make `@prose` link to `grammar.md` instead of restating its rules ([writing](writing.md#links)).
  - Check each one in a browser, installed as any outside project would. Every kind of page renders, links between prose and code resolve, and the page reloads on save. Unmarked comments, like JSDoc, `//` and `svelte-ignore`, don't show as prose. Look at typography, folded code and a phone's width. base is SvelteKit, with `.svelte` files that use all three parts.

## Later

- [ ] **An accessibility review.** Keyboard navigation and shortcuts for the file tree, the mode switch, code runs and moving between pages. Focus order, and names for screen readers.
- [ ] **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).

## Open questions

- **Comment links on GitHub.** `src/store.ts#adding` works in the renderer, but GitHub scrolls only to a line, like `#L42`. Either accept it, or let whatever publishes the docs map links to lines.
- **A map command.** `prose outline` could print every first paragraph, if the grep in [the agent rules](usage.md#for-agents) proves too noisy for agents.
