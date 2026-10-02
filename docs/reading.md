# Reading a repository

What the human sees when they read a repository with prose. Each file is one page, and the pages are the same locally and as a published site. How to run it is in [usage.md](usage.md), and the convention it reads is in [writing.md](writing.md).

It works on any repository, with no config. A repository with no `@prose` at all still reads as its Markdown and its code.

## Pages

A page's address is its file's path in the repository. So a relative link in the prose works the same here as on GitHub ([references](writing.md#links)).

- **A folder** (`/src/`) shows its `README.md` first. Then it lists what's in it under **Folders**, **Docs** and **Code**, each with its first paragraph as a summary. A file that could carry prose but has none is named on one line, **No prose yet**. That makes coverage visible where you read, without a report. Files that can't carry prose, like `LICENSE` or a lockfile, are named on a last line, **Other files**. Locally, a dim line also names what `.gitignore` leaves out of the folder. It has no links, since there's nothing there to read.
- **A Markdown file** (`/docs/plan.md`) renders as it is.
- **A source file** (`/src/store.ts`) reads as one document. Its first `@prose` comes first, then each later one in source order, with the code between them. Each run of code sits in a panel that can fold. Its header shows which lines it holds and the language, and stays visible when the code is folded. Code keeps the formatter's width of 100 columns, wider than the prose, so it wraps only on a narrow screen. Headings in later comments show one level down. A `#` in the margin beside a later comment's first heading [links](writing.md#links) to it. A file with no prose says so, and shows its code as one run.
- **Any other file** (`package.json`, `.gitignore`) shows as highlighted text. A long one is cut, with a note on how much is left. A binary file shows its type and size, and a small image is shown.

## Around the page

The text is on the left and the file tree on the right. The page grows with a wide window, so a wide screen shows more page and less margin. Tables and code samples in the prose can be wider than the text, up to the width of a code run.

- **The file tree** shows the repository as an editor's explorer does. Folders come first, and a folder's `README.md` comes ahead of its other files. The folders around the current page are open, and folders the reader opened stay open from page to page. On a narrow screen, the tree slides over the page from an icon in the bar.
- **The bar** holds the project's name, which links to the root. The name comes from the `origin` repository, not the checkout folder ([src/repo.ts](../src/repo.ts)). Next come links to the docs in `docs/`, in the order `docs/README.md` lists them ([writing](writing.md#folders-and-docs)). On a narrow screen they fold behind a **Docs** button.
- **The breadcrumb** above the text runs from the project's name to the current page, and every crumb is a link. Locally, it ends with a link that opens the file in the editor.
- **On this page** is a table of contents, on a page with three or more second- and third-level headings. It sits beside the text when there's room, and folds into one line under the breadcrumb when there isn't. It marks the section being read as the page scrolls.
- **The Prose & Code / Prose only switch** sets whether code runs start open or folded. A run's header still opens or closes that run on its own. The switch is in the same place on every page, and disabled where there's no code. It's the reader's own setting, kept in their browser and not in the address. A `?view=` in the address was tried and dropped. A link that carried it passed the sharer's choice to whoever opened it. A link without it let the address and the page disagree.

## What it reads

- **Every file git would track.** That's the tracked files, plus untracked ones that `.gitignore` doesn't exclude, so a new file shows up before it's committed. Dotfiles and `.github/` are included. Outside a git repository, it skips `node_modules`, `dist` and dot-folders.
- **Prose from Markdown and the languages in [writing.md](writing.md#in-each-language).** Generated files, like lockfiles and anything over 200 KB, show as plain text, since nobody writes prose into them.
- **Nothing outside the repository.** An address outside it, or for a file it doesn't read, is a 404.

## Local and published

`prose .` serves the pages locally, and `prose build` writes the same pages as static files ([usage.md](usage.md)). Both come from the same code, so a published site is the same reader, not a second design.

- **Local pages are live.** A page reloads when a file it shows changes, and keeps its scroll position.
- **A published site is one commit.** The build renders the files tracked at `HEAD`, as the public repository shows them. Untracked, ignored and uncommitted files never reach the site, and the build warns when there are uncommitted changes. Below the file tree, a footer names the commit, and the tag when `HEAD` has one. Both link to GitHub.
- **Addresses stay the same.** `/src/store.ts` is `/src/store.ts` in both, so a link works in either. A static host serves each page without its `.html`, and without a redirect.
- **Pages share one stylesheet and one script.** They're files under `/prose/`, each named by a hash of its text, so a page carries only its own HTML. The build writes a `_headers` file that asks the host to cache them for good ([assets.ts](../src/assets.ts)).
- **A missing page stays in the site.** The build writes its own `404.html`, with the file tree, for the host to serve.
- **The build owns its folder.** It writes into `.prose` and clears it first. So it refuses any folder it didn't make, and it never follows a link out of the commit.
