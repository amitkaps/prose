# Plan

Where the project is and what comes next, in order. Finished work gets a line or two. The detail lives in the code's `@prose`, the tests, `git log` and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only renderer work. This repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.3.0, on npm as `@amitkaps/prose` and as a GitHub release tarball.

### Since 0.3.0

- **The site on Cloudflare.** A Worker builds from `main`, so a merge deploys it ([development](development.md#the-site)). `prose publish` was dropped, since the one site that could use it deploys without it.
- **Reading on any screen.** A breadcrumb from the project's name, docs in the bar, folder pages in groups, a table of contents on a long page, and wider tables and code samples ([reading](reading.md#around-the-page)). A view in the URL was tried and dropped.
- **The renderer stays.** Its pages became the user documentation for this repository and for markz, so it has earned its place ([lessons](lessons.md#what-gets-read)).
- **The docs in plain sentences.** The [agent rules](usage.md#for-agents) ask for one idea per sentence. The docs were rewritten to follow them, and no longer teach chunks or a layout for `docs/`.
- **A parser to match.** A file is its prose comments, each with its span. A comment's link is its heading's id, and a comment counts when it starts its own line. Chunks, sections, the preamble, pending marks and name anchors went, with `names.ts`. Shell and Python are no longer read ([writing](writing.md#in-each-language)).
- **This repository as the example.** Every file opens with a titled `@prose`, every comment that opens a part has a heading, and the code's prose is in plain sentences. `style.css` reads in sections.
- **Shared files for every page.** The stylesheet and the script moved out of each page, into hashed files that a host caches for good. The project page went from 42 KB to 16 KB, and the site from 3.9 MB to 2.6 MB. The scripts that run before the first paint stay inline ([reading](reading.md#local-and-published)).

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

- [ ] **One package, with nothing to install beside it.** oxc and shiki do far more than prose now asks of them, and oxc brings a native binary for each platform.
  - [x] Bundle markz into `dist/`.
  - [x] Find comments with a small lexer instead of `oxc-parser`. A test checks it against the oxc that comes with vite-plus. JSX is out, since no repository here uses it.
  - [x] Move the page's frame, stylesheet and scripts into `src/page/`. The build strips their comments and formats them with oxfmt, so the pages read cleanly in the browser.
  - [ ] Highlight with the same lexer instead of shiki, into the palette's token colours. Compare a few pages with shiki's before it goes.
- [ ] **Use it on base, sitez and markz.**
  - Install the latest release, and remove `prose()` from their Vite configs. Replace the snippet in their `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - Move `prose/` to `docs/` in sitez and markz, with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website, so that moves to `site/` first, with its root scripts, workspace, package name and CI paths.
  - In markz, make `@prose` link to `grammar.md` instead of restating its rules ([writing](writing.md#links)).
  - Check each one in a browser, installed as any outside project would. Every kind of page renders, links between prose and code resolve, and the page reloads on save. Unmarked comments, like JSDoc, `//` and `svelte-ignore`, don't show as prose. Look at typography, folded code and a phone's width. base is SvelteKit, with `.svelte` files that use all three parts.

## Later

- [ ] **An accessibility review.** Keyboard navigation and shortcuts for the file tree, the mode switch, code runs and moving between pages. Focus order, and names for screen readers.
- [ ] **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).

- [ ] **The file tree on a large repository.** Every page carries the whole tree, so a site's size grows with the square of its file count. It's about 1 KB gzipped here. If it grows too large, the tree could become a shared file too, as long as its open folders still come back before the first paint.
- [ ] **Layers for the stylesheet.** `style.css` follows the page in order, but its rules still lean on that order. Cascade layers (`@layer`) could make each part's precedence explicit, so a part can move or change without breaking another.

## Open questions

- **Comment links on GitHub.** `src/store.ts#adding` works in the renderer, but GitHub scrolls only to a line, like `#L42`. Either accept it, or let whatever publishes the docs map links to lines.
- **A map command.** `prose outline` could print every first paragraph, if the grep in [the agent rules](usage.md#for-agents) proves too noisy for agents.
