# The renderer, in detail

How `prose` behaves: what each page shows, what it reads, how it renders, and what `prose build` and `prose publish` write. The convention it reads is in [convention.md](convention.md), the reasons in [design.md](design.md), and how to use it in [usage.md](usage.md).

## `prose .`

`prose [dir]` (default `.`) starts a small, read-only HTTP server on the repository and opens it in the browser. Every page is rendered to HTML on request: a folder, a Markdown file, or a source file shown as its prose. There's no client app and no state; the browser gets plain HTML, one stylesheet and a few lines of script for live reload.

It needs no config, no Vite and no dev server, and it works on any repository: one with no `@prose` at all still reads as its Markdown and its code.

### Pages

URLs mirror repo paths, so a relative link in the prose works the same in the renderer as on GitHub ([references](convention.md#references)).

- **A folder** (`/`, `/src/`): its `README.md`, then its subfolders and files, each with its first paragraph: a folder's from its `README.md`, a Markdown file's from its first paragraph, a source file's from its file prose. A file that could carry prose and has none says *undocumented*, so coverage is visible where you read, without a report; one that can't (`LICENSE`, `package.json`, a lockfile, an image) shows just its name. Locally, the page ends with one dim line naming what `.gitignore` leaves out of that folder, at the level it's named (`Ignored here: node_modules/ dist/ .env`): no links and no counts, since there's nothing there to read.
- **A Markdown file** (`/docs/plan.md`): rendered as it is.
- **A source file** (`/src/store.ts`): one document. The file prose first, then each chunk's prose in source order, with its code between them. Each run of code is a panel with a header that stays in every mode (a chevron, how many lines and which, the language), numbered with the file's own line numbers, highlighted, and wrapped only past 100 columns: prose keeps the reading measure, code widens to the formatter's print width. A pending chunk shows as its prose with a *pending* mark. Each block's [anchor](convention.md#anchors) is its fragment, with a `#` in the margin beside its first line, heading or text, to link to it; the file prose, being the top of the page, has none. A **Prose & Code / Prose only** switch sets whether runs start open, remembered across pages; a run's header opens or closes that run on its own. The switch is on every page, in the same place, disabled where there's no code. A file with no prose says so, and is one run with the same header.
- **Any other file** (`package.json`, `LICENSE`, `.gitignore`, a lockfile): a text file is one highlighted run, cut at 1,000 lines or 100 KB with how much is left said at the end; a binary file says what it is and how big, and an image up to 1 MB is shown.

The text is on the left and the repository's file tree on the right, as an editor's explorer shows it: folders first, a folder's `README.md` ahead of its other files (a row for the folder's page, highlighted there), the folders around the current page open, and the reader's own opened folders kept from page to page. On a narrow screen the tree slides over the page from the right, behind an icon in the bar. The bar holds the project's name (a link to the root), the mode switch and that icon. The text's side margins, and the project's name above them, come from the width left beside the tree: equal on a narrow page, then the left stops at 7rem and the rest goes to the right, so the name always lines up with the text. Above the text is a breadcrumb to the page's ancestors, wrapping when long, with a link to open the file in the editor at its end, on a local page only. The page reloads when a file it shows changes, keeping the scroll position.

### What it reads

- Every file git would track, whatever its type: tracked files, plus untracked ones not ignored by `.gitignore`, so a brand-new file shows up before it's committed. Dotfiles and `.github/` included. Ignored files stay out of the file tree, which is the same locally and published; a folder's page names them ([pages](#pages)). Outside a git repository, a fixed skip list (`node_modules`, `dist`, dot-folders).
- Prose is read from Markdown and from the languages in [convention.md](convention.md#prose-blocks), except generated files: lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, …) and anything over 200 KB are shown as text.
- A request for a path outside the root, or for a file the walk doesn't hold, is a 404.

### How it renders

- JS and TS comments, including a `.svelte` file's `<script>`, come from `oxc-parser` (its comment list and the AST for depth). CSS, HTML, YAML and TOML use a small scanner.
- Markdown, in files and in prose blocks, is rendered with [markz](https://github.com/amitkaps/markz). What markz doesn't support stays literal text.
- Code is highlighted on the server with shiki, in the page's own palette: each token's colour is a CSS variable the stylesheet sets for light and dark.
- One stylesheet: a readable column, light and dark, tabs two columns wide. Moving between pages is a cross-document view transition with the file tree held still.
- A file is parsed when its page is requested, and kept by its modification time and size, so a changed file is always read afresh; highlighted code is kept by its text. A folder page reads only its children's first paragraphs. The highlighter starts with the server, and Chrome prerenders a link when the pointer rests on it, so most pages are already built when clicked.
- It binds to `127.0.0.1`; `--port` picks the port (default `1234`, or the next free one).

## `prose build`

`prose build [dir]` writes the same pages as static files, for any static host, into `.prose/site` (`--out` to change it). The pages come from the same code as the server's, so the site is the reader, not a second design.

- **One commit, as the public repository shows it.** The build renders `HEAD`'s tracked files (`git archive`), not the working tree: no untracked or ignored file reaches the site, and it warns when there are uncommitted changes, since they aren't in it. A folder's page doesn't name what's ignored, which exists only on one machine, and a tracked symbolic link is never followed, so it can't publish a file outside the commit.
- **URLs as they are locally.** `/src/store.ts` is `/src/store.ts`: a folder's page is `folder/index.html` and a file's is its path plus `.html` (`src/store.ts.html`), which GitHub Pages serves at the path without the `.html`, with no redirect. The site sits at a domain's root. A source file named `index.html` would be its folder's page there, so its page is `index.html.html`, and links to it say so.
- **Its own 404 page.** `404.html`, with the file tree, which GitHub Pages and Cloudflare serve for any missing address, so a dead link keeps the reader in the site. GitHub Pages never publishes `.github/`, so on that host its pages are this page too.
- **No live parts.** No live reload, no render time, no **Open in editor**; in the rail's footer, the snapshot instead: the short commit, and the tag only when `HEAD` is that tag (`Snapshot · v0.2.0 · 1c77293`), since the nearest earlier tag would name a release the page isn't. Both link to GitHub when `origin` is there. The same commit gives the same bytes, so a rebuild changes only the pages that changed.
- **Its own folder only.** The build clears its output first, so it refuses a folder it didn't make: one holding the repository or tracked files, or a non-empty one without its marker. It never edits `.gitignore`; it warns when the output isn't ignored.

## `prose publish`

`prose publish [dir]` commits the build to a branch a host deploys from: `prose` by default (`--branch` to change it), an orphan branch holding only the site. GitHub Pages serves it with the branch as its source.

- **Nothing else changes.** The branch is never checked out: the working tree, the index and `HEAD` stay as they were. The commit says which source commit it was built from; a publish that changes no page makes no commit.
- **It doesn't push.** `git push origin prose` is a separate step, so nothing leaves the machine unasked.
- **A domain in one file.** `--domain docs.example.com` writes a `CNAME` file at the branch's root, the file Pages reads the domain from, and later publishes keep it (`--domain` again replaces it, `--no-domain` drops it). The site sits at the domain's root ([`prose build`](#prose-build)); the DNS record, a CNAME to `<user>.github.io`, is the owner's to add. The branch also gets a `.nojekyll`, so Pages serves every path as it is.

## Test cases

- **[`tests/fixtures/simple/`](../tests/fixtures/simple/)**: the test fixture, a counter on one static page (`index.html`, `style.css`, `main.js`, `README.md`) with file prose in all three files, headed blocks, and one pending chunk. It exercises the parser and every page kind.
- **Three real repos**, installing the released package as any outside project would: [amitkaps/base](https://github.com/amitkaps/base) (SvelteKit, `.svelte` with all three parts), [amitkaps/sitez](https://github.com/amitkaps/sitez) (89 `@prose` blocks and a short `prose/idea.md`), and [amitkaps/markz](https://github.com/amitkaps/markz) (about 4,600 lines, and a tested grammar in `prose/` that `@prose` should link to rather than restate).

Verify:

- [ ] `prose .` on each repo: folder, Markdown, source and plain-text pages render; relative links between prose and code resolve; the page reloads on save.
- [ ] Unmarked comments (JSDoc, `//`, `svelte-ignore` and other pragmas) are not shown as prose.
- [ ] A path outside the root is a 404.
- [ ] **The real test:** over two weeks of work on sitez and markz, the human opens `prose .` without being prompted. If not, Prose is the convention alone, and the renderer is dropped too.

## Open questions

- **Nested chunks.** Should prose blocks for class members and nested functions become sub-chunks?
- **Anchors beyond JS/TS.** CSS, HTML and YAML chunks fall back to a heading or position ([anchors](convention.md#anchors)). A CSS chunk's first selector, or an HTML chunk's first `id`, could serve.
- **Block anchors on GitHub.** `src/store.ts#addTodo` works in the renderer, but GitHub scrolls only to `#L42`. Accept it, or have whatever publishes the docs map anchors to lines when it links code.
- **A map command.** `prose outline` printing every first paragraph, if the grep in [the agent rules](usage.md#for-agents) proves too noisy for agents.
