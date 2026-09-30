# Prose

Prose lets coding agents explain the code they write, and lets humans read the resulting repository as a document.

It is two things:

- **`@prose`**, a convention for writing human-oriented meaning directly into source code (§3).
- **`prose`**, a read-only renderer that opens any repository in the browser as a Markdown-first document (§4).

Nothing else is required.

Repo: [amitkaps/prose](https://github.com/amitkaps/prose) · npm: `@amitkaps/prose` · web: [prose.amitkaps.com](https://prose.amitkaps.com)

## 1. Why

**The human keeps the mental model by reading prose, not code.** One person works with coding agents that change code faster than it can be read. What the human needs is the model of the whole design: what the project promises, how it's put together, and why. The agent writes the code and most of the prose. The human reads the prose and gives direction in the chat.

**The agent explains as it builds.** The loop is: the human gives direction → the agent changes code → the agent updates the `@prose` next to it, and any doc the change affects, in the same change → the human reads the result and redirects. The explanation is in the code it explains, so it changes in the same diff or visibly doesn't.

**The browser is a reading surface.** The source of truth is the repository, changed by the human's editor and the agent's tools. The renderer edits nothing, keeps no state and doesn't replace grep or the agent's own reading. It gives the human a better way to read.

**Short prose is what makes it work.** A promises doc short enough to hold in mind lets decisions be argued from what the project promises rather than from taste. A first paragraph of three lines is a map; one of three packed sentences is a chore. The convention limits length (§5) because long prose stops being read, and prose that isn't read stops being kept.

**One marker.** The convention has `@prose` and nothing else. Plan state, sections and progress come from structure: a prose block with no code under it is a plan item, a heading is a section, filled code is done. A `@todo`, `@decision` or `@note` marker would be one more thing to keep in sync; decisions go into the prose they change.

**Standard files, not a toolchain.** Adopting a new file type or compiler breaks `tsc`, the language server, formatters, linters and every other standard workflow. `@prose` is a comment, like JSDoc, so every tool keeps working.

**How it got this small.** 0.1.0 was much more: a dev route inside the app's Vite server, notes written back into source, mechanical checks, a planned review view. Used on real projects, the route was barely opened, notes weren't used, and checks never ran; the `prose/` docs and the `@prose` blocks were read. §6 lists what was dropped, and `lessons.md` has the evidence.

## 2. Scope

| In                                                                      | Out (§6)                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `@prose` in `.ts`, `.js`, `.css`, `.html`, `.svelte`, `.yaml`/`.yml`, `.toml` | New file types, tangling, `.ts.md`             |
| Rendering any repository read-only: Markdown, source with its prose, other text | Editing anything, notes, review state        |
| Local reading, and the same pages as a static site (`prose build`, `prose publish`) | Hosting and deploys; a docs site with its own navigation |
| First paragraphs as summaries                                           | Checks, coverage reports, LLM summaries              |

Target: one person's repositories, up to about 500 files.

## 3. The convention

### 3.1 Prose blocks

A **prose block** is a comment whose first token is the **`@prose`** marker. The same rule applies in every language:

| Language      | Prose block                         |
| ------------- | ----------------------------------- |
| JS, TS, CSS   | `/** @prose … */` on its own line   |
| HTML, markup  | `<!-- @prose … -->`                 |
| YAML, TOML    | `# @prose …`, one `#` per line, at column 0 |

```js
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
```

```html
<!-- @prose
The count lives in an `<output>`, announced to screen readers when it changes.
-->
```

- The body is everything after `@prose`, with the leading ` * ` stripped in JS, TS and CSS. It is Markdown, in [markz](https://github.com/amitkaps/markz)'s dialect: the everyday GFM syntax, without setext headings, reference links or raw HTML.
- **`@prose` starts the block on its own line, and the closing delimiter (`*/` or `-->`) sits on its own line too** — never `/** @prose text */` on one line. In JS/TS/CSS this keeps every body line gutter-prefixed with ` * `, so formatters (oxfmt) re-indent the block as JSDoc, and a body line that itself starts with `*` (a Markdown bullet) can't be mistaken for the gutter.
- **Every other comment is a code comment**, including unmarked `/** */` JSDoc, `//`, `/* */`, and unmarked `<!-- -->`. So API docs like `/** @param x */`, `// TODO`, and tool pragmas like `<!-- svelte-ignore … -->` are never read as prose.
- The marker is opt-in because comments already have many owners: JSDoc, Vite, Svelte, formatters, and linters. Adding a marker is the explicit step of promoting a comment to prose.
- In JS, TS and CSS, a prose block counts at any depth when it starts its own line, with only indentation before it: at top level, or inside a class, function or rule, so a class reads method by method. Its chunk runs to the next block, as at top level, so a block inside a function splits that function's code in two. One that shares its line with code (`call(/** @prose … */ x)`) is an ordinary comment in the code.
- TypeScript treats `@prose` as a JSDoc tag, so an editor hover shows the prose as that tag's text. It's readable, if slightly noisy.
- YAML and TOML have no block-comment delimiter, so a prose block there is a maximal run of `#`-prefixed lines starting with a `# @prose` line, each line's own `# ` gutter stripped. Only column 0 counts; an indented `#` comment is an ordinary comment.
- In `.svelte` files, each part follows its own language's rule: `<script>` the JS/TS rule, the markup the HTML rule, `<style>` the CSS rule. The chunks from all three parts are merged in source order.

**What ships.** Minifiers drop `/** @prose */` from JS and CSS (they keep only `@license`, `@preserve` and `/*!` comments), and the Svelte compiler drops markup comments. A hand-written `.html` file served as it is keeps its comments, so a `<!-- @prose -->` there is visible in the page source. Keep prose out of shipped `.html`, or strip it in the build. Sourcemaps with `sourcesContent` carry every comment too.

### 3.2 Blocks and chunks

Within a file:

1. The **first prose block** is the **file prose**.
2. Each later prose block, together with the code that follows it up to the next prose block, is a **chunk**.
3. A chunk whose code is empty (only whitespace before the next prose block or end of file) is **pending**: a plan item, written before its code.
4. Code between the file prose and the first chunk (typically imports) is the **preamble**.
5. A prose block whose first line is a Markdown heading (`# Filtering`) is just a heading in the flow. There is no separate section level.

**The file is the smallest unit.** A chunk read on its own, without the rest of its file, loses the imports, the neighbouring definitions, the order things happen in. So the renderer shows a whole file as one document, each chunk's prose directly above its code, top to bottom as it was written.

Example, `src/store.ts`:

```ts
/** @prose
 * The todo store. Holds the list in memory, persists it to `localStorage`,
 * and notifies subscribers after every change.
 */

import { save, load } from "./persist";

/** @prose
 * # Adding and toggling
 *
 * `addTodo` appends a todo with `completed: false`. Empty text is ignored.
 */
export function addTodo(text: string) {
  /* … */
}

/** @prose
 * `toggleTodo` flips a todo's `completed` flag by id.
 */
export function toggleTodo(id: string) {
  /* … */
}

/** @prose
 * # Filtering
 *
 * Todos can be filtered by status. The filter persists in the URL hash.
 */
```

The last block is a pending chunk: a plan item with no code yet.

**Anchors.** Each block has an anchor, used as the fragment of its URL in the renderer (`src/store.ts#addTodo`) and in links from other prose. It's derived from content, so it names the same block after unrelated edits elsewhere in the file:

1. The file prose is `file`.
2. Otherwise, the slug of the block's heading, when it opens with one: `filtering` for the pending chunk above. The heading is what a reader sees, so it names the block before the code does.
3. Otherwise, the first name the chunk's code declares: `addTodo`, `toggleTodo`; for a block inside a class or function, the first member or declaration below it: `metadata`. (JS and TS.)
4. Otherwise, a positional fallback (`chunk-3`), the only kind that moves when blocks are inserted above it.

A repeated anchor within a file gets a `-2`, `-3` suffix in source order.

### 3.3 Folders and project

A folder's `README.md` is its prose, and the root `README.md` is the project's. These are ordinary READMEs; GitHub already renders them.

### 3.4 Writing that spans the code

Some writing has no natural home in one comment or one README: what the project promises, architecture that spans files, the order of the work, lessons learned building it. The convention suggests a root `docs/` folder of Markdown files for it:

```text
docs/
  idea.md
  plan.md
  lessons.md
```

- **Keep one short promises doc.** `idea.md`, `spec.md`, whatever the project calls it: what the project promises and what it leaves out ("not in v1"). In use it was the most valuable file: decisions could be argued from it, and its non-goals stopped scope creep. It pays off because it's short enough to hold in mind.
- **Decisions land in the prose.** A decision reached in the chat that spans files goes into the doc it changes, in the same change as the code (§5). One that concerns a single spot goes into that spot's `@prose`.
- **`docs/` is a suggestion, not a mechanism.** The renderer treats it as an ordinary folder of Markdown (§4.1). Because it's plain Markdown linked by repo path, a static site generator can publish it as it is; what gets published, and how internal docs like `plan.md` stay off a site, is that tool's concern.

### 3.5 References

A reference is an ordinary relative Markdown link, so it reads and clicks the same on GitHub, in the editor's preview, in the renderer, and on a site that publishes `docs/`:

```text
src/session.ts                     a file
src/session.ts#createSession       a block in it, by its anchor (§3.2)
docs/architecture.md               a doc
docs/architecture.md#sessions      a section of it, by heading slug
```

**State a rule once, and link to it.** When a doc or a tested file owns a rule (a grammar, a schema, a contract), a `@prose` block links to it and keeps only how and why this code does it. Restating the rule in several places means only one copy is tested, and the others drift.

## 4. The renderer: `prose .`

`prose [dir]` (default `.`) starts a small, read-only HTTP server on the repository and opens it in the browser. Every page is rendered to HTML on request: a folder, a Markdown file, or a source file shown as its prose. There's no client app and no state; the browser gets plain HTML, one stylesheet and a few lines of script for live reload.

It needs no config, no Vite and no dev server, and it works on any repository: one with no `@prose` at all still reads as its Markdown and its code.

### 4.1 Pages

URLs mirror repo paths, so a relative link in the prose works the same in the renderer as on GitHub (§3.5).

- **A folder** (`/`, `/src/`): its `README.md`, then its subfolders and files, each with its first paragraph: a folder's from its `README.md`, a Markdown file's from its first paragraph, a source file's from its file prose. A source file without prose says *undocumented*, so coverage is visible where you read, without a report. Locally, the page ends with one dim line naming what `.gitignore` leaves out of that folder, at the level it's named (`Ignored here: node_modules/ dist/ .env`): no links and no counts, since there's nothing there to read.
- **A Markdown file** (`/docs/plan.md`): rendered as it is.
- **A source file** (`/src/store.ts`): one document. The file prose first, then each chunk's prose in source order, with its code between them. Each run of code is a panel with a header that stays in every mode (a chevron, how many lines and which, the language), numbered with the file's own line numbers, highlighted, and wrapped only past 100 columns: prose keeps the reading measure, code widens to the formatter's print width. A pending chunk shows as its prose with a *pending* mark. Each block's anchor (§3.2) is its fragment, with a `#` in the margin beside its first line, heading or text, to link to it; the file prose, being the top of the page, has none. A **Prose & Code / Prose only** switch sets whether runs start open, remembered across pages; a run's header opens or closes that run on its own. The switch is on every page, in the same place, disabled where there's no code. A file with no prose says so, and is one run with the same header.
- **Any other file** (`package.json`, `LICENSE`, `.gitignore`, a lockfile): a text file is one highlighted run, cut at 1,000 lines or 100 KB with how much is left said at the end; a binary file says what it is and how big, and an image up to 1 MB is shown.

Every page has the repository's file tree on the left, as an editor's explorer shows it: folders first, the folders around the current page open, and the reader's own opened folders kept from page to page. On a narrow screen it sits behind a **Files** button. Every page also has a breadcrumb to its ancestors and a link to open the file in the editor. The page reloads when a file it shows changes, keeping the scroll position.

### 4.2 What it reads

- Every file git would track, whatever its type: tracked files, plus untracked ones not ignored by `.gitignore`, so a brand-new file shows up before it's committed. Dotfiles and `.github/` included. Ignored files stay out of the file tree, which is the same locally and published; a folder's page names them (§4.1). Outside a git repository, a fixed skip list (`node_modules`, `dist`, dot-folders).
- Prose is read from Markdown and from the languages in §3.1, except generated files: lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, …) and anything over 200 KB are shown as text.
- A request for a path outside the root, or for a file the walk doesn't hold, is a 404.

### 4.3 How it renders

- JS and TS comments, including a `.svelte` file's `<script>`, come from `oxc-parser` (its comment list and the AST for depth). CSS, HTML, YAML and TOML use a small scanner.
- Markdown, in files and in prose blocks, is rendered with [markz](https://github.com/amitkaps/markz). What markz doesn't support stays literal text.
- Code is highlighted on the server with shiki, in the page's own palette: each token's colour is a CSS variable the stylesheet sets for light and dark.
- One stylesheet: a readable column, light and dark, tabs two columns wide. Moving between pages is a cross-document view transition with the file tree held still.
- A file is parsed when its page is requested, and kept by its modification time and size, so a changed file is always read afresh; highlighted code is kept by its text. A folder page reads only its children's first paragraphs. The highlighter starts with the server, and Chrome prerenders a link when the pointer rests on it, so most pages are already built when clicked.
- It binds to `127.0.0.1`; `--port` picks the port (default `1234`, or the next free one).

### 4.4 `prose build`

`prose build [dir]` writes the same pages as static files, for any static host, into `.prose/site` (`--out` to change it). The pages come from the same code as the server's, so the site is the reader, not a second design.

- **One commit, as the public repository shows it.** The build renders `HEAD`'s tracked files (`git archive`), not the working tree: no untracked or ignored file reaches the site, and it warns when there are uncommitted changes, since they aren't in it. A folder's page doesn't name what's ignored, which exists only on one machine, and a tracked symbolic link is never followed, so it can't publish a file outside the commit.
- **URLs as they are locally.** `/src/store.ts` is `/src/store.ts`: a folder's page is `folder/index.html` and a file's is its path plus `.html` (`src/store.ts.html`), which GitHub Pages serves at the path without the `.html`, with no redirect. The site sits at a domain's root. A source file named `index.html` would be its folder's page there, so its page is `index.html.html`, and links to it say so.
- **Its own 404 page.** `404.html`, with the file tree, which GitHub Pages and Cloudflare serve for any missing address, so a dead link keeps the reader in the site. GitHub Pages never publishes `.github/`, so on that host its pages are this page too.
- **No live parts.** No live reload, no render time, no **Open in editor**; in its place, the snapshot: the nearest tag and the short commit (`v0.1.0 · 1c77293`). The same commit gives the same bytes, so a rebuild changes only the pages that changed.
- **Its own folder only.** The build clears its output first, so it refuses a folder it didn't make: one holding the repository or tracked files, or a non-empty one without its marker. It never edits `.gitignore`; it warns when the output isn't ignored.

### 4.5 `prose publish`

`prose publish [dir]` commits the build to a branch a host deploys from: `prose` by default (`--branch` to change it), an orphan branch holding only the site. GitHub Pages serves it with the branch as its source.

- **Nothing else changes.** The branch is never checked out: the working tree, the index and `HEAD` stay as they were. The commit says which source commit it was built from; a publish that changes no page makes no commit.
- **It doesn't push.** `git push origin prose` is a separate step, so nothing leaves the machine unasked.
- **A domain in one file.** `--domain docs.example.com` writes a `CNAME` file at the branch's root, the file Pages reads the domain from, and later publishes keep it (`--domain` again replaces it, `--no-domain` drops it). The site sits at the domain's root (§4.4); the DNS record, a CNAME to `<user>.github.io`, is the owner's to add. The branch also gets a `.nojekyll`, so Pages serves every path as it is.

## 5. Agent contract

A snippet for the project's `CLAUDE.md` / `AGENTS.md`:

- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`.
- Every prose block, file, folder and doc begins with a short first paragraph that is its summary for the human: about three lines, one idea per sentence. It says what the node means, not what its code does; detail goes in the chunks below. When a change alters a node's role, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments, in markz's Markdown. Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change: into the doc they change when they span files, into the `@prose` block when they concern one spot. Write docs for a reader who wasn't in the chat, since they may be published as they are. Keep the promises doc short, and update its non-goals when something is ruled out.
- Keep the plan current: what's done in one line each, what's next in order. Work that belongs to one file can be a pending chunk there instead.
- To find your way: `grep -rn -A4 "@prose" src` is the map; `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet.

## 6. Out of scope, and why

0.1.0 built all of this. Each is out with its reason, so it isn't rebuilt by default; `lessons.md` has the detail.

- **Editing, from the browser or anywhere else.** The repository is the source of truth, changed by the editor and the agent (§1).
- **A dev route inside the app's Vite server, on Devframe** (typed RPC, synced state, a Svelte client). It needed the app running and was rarely opened; a standalone renderer on any repo (§4) replaces it.
- **`@note` annotations in source.** Discussion happened in the chat over several turns, and the agent wrote the outcome into the prose. In two repos, one note sat open for weeks and the other had none.
- **Checks** (unresolved symbols, git-blame staleness, reference and duplication checks) **and a `prose check` CLI.** They never ran in the field repos. The one real drift found was about meaning, which no mechanical check catches; the agent updates prose and code together, so staleness rarely fires; a site generator can check links when it publishes.
- **A *since* view for reviewing changes.** The human didn't review block by block; they read the prose that says what the code means now.
- **Agent-written dev tools and an import-graph diagram.** Never built; nothing asked for them.
- **The Vite plugin that stripped `@prose` from built HTML.** Only hand-written `.html` needs it (§3.1).
- **A docs site, hosting and deploys.** `prose build` writes the reader as it is and `prose publish` commits it to a branch (§4.4, §4.5); pushing it is a separate step. A site with its own navigation, chosen pages and design is a static site generator's job (§3.4), and where the files are hosted is the host's.

## 7. Test cases

- **[`examples/single/`](../examples/single/)**: a counter on one static page (`index.html`, `style.css`, `main.js`, `README.md`) with file prose in all three files, headed blocks, and one pending chunk. It exercises the parser and every page kind.
- **Three real repos**, installing the released package as any outside project would: [amitkaps/base](https://github.com/amitkaps/base) (SvelteKit, `.svelte` with all three parts), [amitkaps/sitez](https://github.com/amitkaps/sitez) (89 `@prose` blocks and a short `prose/idea.md`), and [amitkaps/markz](https://github.com/amitkaps/markz) (about 4,600 lines, and a tested grammar in `prose/` that `@prose` should link to rather than restate).

Verify:

- [ ] `prose .` on each repo: folder, Markdown, source and plain-text pages render; relative links between prose and code resolve; the page reloads on save.
- [ ] Unmarked comments (JSDoc, `//`, `svelte-ignore` and other pragmas) are not shown as prose.
- [ ] A path outside the root is a 404.
- [ ] **The real test:** over two weeks of work on sitez and markz, the human opens `prose .` without being prompted. If not, Prose is the convention alone, and the renderer is dropped too.

## 8. Open questions

- **Nested chunks.** Should prose blocks for class members and nested functions become sub-chunks?
- **Anchors beyond JS/TS.** CSS, HTML and YAML chunks fall back to a heading or position (§3.2). A CSS chunk's first selector, or an HTML chunk's first `id`, could serve.
- **Block anchors on GitHub.** `src/store.ts#addTodo` works in the renderer, but GitHub scrolls only to `#L42`. Accept it, or have whatever publishes the docs map anchors to lines when it links code.
- **A map command.** `prose outline` printing every first paragraph, if the grep in §5 proves too noisy for agents.
- **Static export.** Writing the same pages as static HTML, to read without a server. Only if serving locally isn't enough.
