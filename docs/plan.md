# Plan

Where the project is and what comes next, in order. Finished work gets a line or two. The detail lives in the code's `@prose`, the tests, `git log` and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only renderer work. This repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.6.0, on npm as `@amitkaps/prose` and as a GitHub release tarball.

### 0.6.0

- **More checks.** `prose check` warns about a link to a file or heading that isn't there, a heading that skips a level, `@prose` sharing its line, and a summary with no title. It also warns about a file with no `@prose`, a folder with no `README.md`, and an export a library ships with no comment ([usage](usage.md#warnings)). A repository that upgrades will likely see new warnings.
- **Advice on style.** `prose style` reads the files just written for long summaries, long sentences, and colons, semicolons or asides that join two ideas. It always passes, and never shows on a page ([usage](usage.md#style)).
- **What isn't checked is counted.** A file `.gitattributes` marks `prose-unchecked`, `linguist-vendored` or `linguist-generated` isn't checked. Both commands end with how many files they read and how many were left out. A local page says when its file wasn't checked.

### 0.5.0

- **Tables that read well.** Rows with no grid, a quiet header, and cells that wrap between words, so a column of short words keeps its room. A table that scrolls shows it, and `---:` alignment now shows. A doc with no table of contents lets a table grow to a code run's width, which ship's dashboard needed ([reading](reading.md#around-the-page)).
- **The text holds still.** The window alone sets where the text sits, so opening or closing the tree no longer moves it. The table of contents sits beside the text only with room to spare, as far from it as the text is from the window's edge. Otherwise it's at the top of the tree, as VS Code's outline is. The breadcrumb then stays under the bar and names the section being read, as Starlight's does, and opens the contents. The folded contents above the text went, so every page's text starts at the same height.
- **Inline code and four tones.** Inline code has a hairline edge and pads only its sides, so it never pushes lines apart. The stylesheet has four tones, `--success`, `--warning`, `--danger` and `--info`, each with a soft background. The live dot is the first to use one.
- **Warnings, with codes.** `prose check` prints what the text gets wrong and fails on it. `prose build` prints the same, and a local page lists its own at its foot. Each warning has a code, markz's or one of prose's three. Text marked `linguist-vendored` isn't checked ([usage](usage.md#warnings)).

### 0.4.0

- **The site on Cloudflare.** A Worker builds from `main`, so a merge deploys it ([development](development.md#the-site)). `prose publish` was dropped, since the one site that could use it deploys without it.
- **Reading on any screen.** A breadcrumb from the project's name, docs in the bar, folder pages in groups, a table of contents on a long page, and wider tables and code samples ([reading](reading.md#around-the-page)). A view in the URL was tried and dropped.
- **The renderer stays.** Its pages became the user documentation for this repository and for markz, so it has earned its place ([lessons](lessons.md#what-gets-read)).
- **The docs in plain sentences.** The [agent rules](usage.md#for-agents) ask for one idea per sentence. The docs were rewritten to follow them, and no longer teach chunks or a layout for `docs/`.
- **A parser to match.** A file is its prose comments, each with its span. A comment's link is its heading's id, and a comment counts when it starts its own line. Chunks, sections, the preamble, pending marks and name anchors went, with `names.ts`. Shell and Python are no longer read. An `.html` file is read part by part, as a `.svelte` file is, so its scripts and styles can carry prose ([writing](writing.md#in-each-language)).
- **This repository as the example.** Every file opens with a titled `@prose`, every comment that opens a part has a heading, and the code's prose is in plain sentences. `style.css` reads in sections.
- **One package, with nothing beside it.** markz is bundled into `dist/`. A small lexer replaced `oxc-parser` and finds the same comments, and small tokenizers replaced shiki and colour code as it did ([lessons](lessons.md#rendering)). The page's frame, stylesheet and scripts are files in `src/page/`, stripped of comments and formatted at build. prose has no dependencies, and ships without comments or sourcemaps, at about 200 KB unpacked instead of 655 KB ([development](development.md#what-ships)).
- **Shared files for every page.** The stylesheet and the script moved out of each page, into hashed files that a host caches for good. The project page went from 42 KB to 16 KB, and the site from 3.9 MB to 2.6 MB. The scripts that run before the first paint stay inline ([reading](reading.md#local-and-published)).
- **A stylesheet in layers.** `style.css` is in three cascade layers, tokens, base and components, and each component nests its parts with `&`. Fonts, chevrons and motion are tokens, and buttons and popovers start bare. A test keeps every rule in a layer. Each step was checked against every element's computed style, at six widths and in each of the page's states.
- **A design pass.** Colours are in OKLCH, with softer ink and paper in both modes. Five type sizes, two radii and one focus ring replace the ad hoc values. The breadcrumb is quieter, with more room around it. Each project gets an accent from its name, a tab icon in it, and tabs titled by the page ([reading](reading.md#around-the-page)).
- **An accessibility review.** `pnpm run axe` audits every page and `pnpm run keyboard` reads a page of each kind by keyboard, both before a release ([development](development.md#release)). Folders in the tree open and close, and only files are pages. Every page has a title, there's a skip link to the text, and a code run's header is named as code. Ruled out:
  - A reason a reader can hear on the disabled switch. A disabled button is out of the tab order, and saying why would be noise on every doc.
  - Labels for a task list's checkboxes. markz writes them as GFM does, and the audit accepts it ([tests/axe.ts](../tests/axe.ts)).
  - Keyboard shortcuts, since single keys clash with a screen reader's. And the ARIA tree pattern, since the rail is navigation, a list of links.

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

- [ ] **Checks for more of the rules.** `prose check` reads more of [the agent rules](usage.md#for-agents), in five steps. Each was run on markz, sitez, ship and pagez first, to see what it finds. The first four are in 0.6.0.
  - Advice on style, from `prose style` on the files just written. It's never in CI or on a page. Done ([usage](usage.md#style)).
  - Read `.gitattributes` for prose, and a `prose-unchecked` attribute for text that isn't checked, like fixtures. Done ([usage](usage.md#warnings)).
  - Warnings on structure. A link to a file or heading that isn't there, a heading that skips a level, `@prose` on one line with its text, and a file's summary with no heading. Done ([usage](usage.md#warnings)). A later comment may open with `##` under a `#` before it, since markz nests 84 that way, so only a skip warns.
  - Warnings on what's missing. A source file with no `@prose`, a folder with no `README.md`, and a library's export with no comment. Done ([usage](usage.md#warnings)). A folder of only JSON, like `.vscode/`, isn't asked for a README.
  - One term for each concept, from a short glossary, as a note.
- [ ] **Use it on base, sitez and markz.**
  - Install the latest release, and remove `prose()` from their Vite configs. Replace the snippet in their `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - Move `prose/` to `docs/` in sitez and markz, with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website, so that moves to `site/` first, with its root scripts, workspace, package name and CI paths.
  - In markz, make `@prose` link to `grammar.md` instead of restating its rules ([writing](writing.md#links)).
  - Check each one in a browser, installed as any outside project would. Every kind of page renders, links between prose and code resolve, and the page reloads on save. Unmarked comments, like JSDoc, `//` and `svelte-ignore`, don't show as prose. Look at typography, folded code and a phone's width. base is SvelteKit, with `.svelte` files that use all three parts.

## Later

- [ ] **A pass with VoiceOver.** One page of each kind, the tree, the switch, a code run, and the live dot when the server stops. The checks so far are what a machine can do.

- [ ] **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).

- [ ] **The file tree on a large repository.** Every page carries the whole tree, so a site's size grows with the square of its file count. It's about 1 KB gzipped here. If it grows too large, the tree could become a shared file too, as long as its open folders still come back before the first paint.

## Open questions

- **Comment links on GitHub.** `src/store.ts#adding` works in the renderer, but GitHub scrolls only to a line, like `#L42`. Either accept it, or let whatever publishes the docs map links to lines.
- **A map command.** `prose outline` could print every first paragraph, if the grep in [the agent rules](usage.md#for-agents) proves too noisy for agents.
- **The tones as a promise.** A project's own page, like ship's dashboard, could use `--success` and the other tones instead of its own colours. That makes the names public, so renaming one would break someone's page. Either list them in [reading](reading.md#around-the-page) as tokens a page may use, or keep them prose's own. It waits for a page that needs them.
- **A project's own pages as elements.** A doc could hold a standalone page as a Markz element, such as markz's Quality page as `{@markz-quality}`, or ship's drift tables. markz already writes the tag. prose would add the script that defines it, written any way a custom element can be, and never run the project's build. The page would then sit in prose's frame, and couldn't drift from its bar. It waits, because two working pages don't pay for what it adds.
  - A place for the scripts. prose has no folders or options of its own, only the docs it links in the bar.
  - A way in for data. An element needs data the project's code generates, and prose reads only what is committed.
  - The project's code in the browser. `prose .` would run each repository's scripts, including a repository someone else wrote.
  - Exceptions to [design](design.md#what-it-isnt). prose would become a little of a site generator, and a little part of the app.
  - An iframe is the way to try first, and it needs nothing from prose. markz refuses `{@iframe}`, but an `=html` block passes `<iframe src="/quality.html">` through. The page keeps its own look, and its scripts run in their own document. It has a fixed height, follows the system's theme rather than prose's switch, and needs `target="_top"` on its links. `prose .` may not serve a page the project generates.
  - Revisit it with a third standalone page, or a request from a repository that isn't ours. An element format such as sitez's elementz isn't needed, since a custom element is the browser's own standard.
