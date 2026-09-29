# Prose

Standard web source files, a light prose convention in their comments and in `prose/`, a read-only viewer that shows the codebase as Markdown, and a checker that keeps the prose honest.

- The **app** is where the code executes.
- **`prose serve`** is where prose and code are read.
- **`prose check`** is how an agent, or CI, knows the prose still matches the code.

Repo: [amitkaps/prose](https://github.com/amitkaps/prose) · npm: `@amitkaps/prose` · web: [prose.amitkaps.com](https://prose.amitkaps.com)

## 1. Thesis

**The human keeps the mental model by reading prose, not code.** One person works with coding agents that change code faster than it can be read. What the human needs is the model of the whole design: what the project promises, how it's put together, and why. The agent writes the code and most of the prose; the human reads the prose and gives direction in the chat.

**What actually got used.** The first version of Prose (0.1.0) was a dev route in the app's Vite server: a navigable, annotatable view, notes written back into source, a planned *since* view for review. Used on real projects ([sitez](https://github.com/amitkaps/sitez), [markz](https://github.com/amitkaps/markz), [base](https://github.com/amitkaps/base)), the route was barely opened. What was read, and what paid off, was:

- the `prose/` docs, especially a short one stating what the project promises and what it leaves out, and `plan.md` for where the work stands;
- `@prose` blocks, now and then, mostly found by grep, as a map of which file does what;
- `prose/` docs published as the project's documentation: markz's site renders its `prose/*.md` in place, so the docs readers see are the docs the project is designed by (§3.6);
- nothing in `@note`. Discussion happened in the chat, over several turns, and the agent wrote the outcome back into `spec.md` or `plan.md`.

So Prose is now the part that worked: the convention (§3), a plain Markdown viewer for reading it (§6), and a checker (§5). `lessons.md` has the details; §7 lists what was dropped.

**Specs and plans drift when they live outside the repo.** A spec in a wiki, disconnected from the commits that implement it, rots because nothing forces it to change in the same diff. Prose keeps both kinds of explanation in the repo: prose about *a specific piece of code* lives in it (`@prose`, §3.1), so it changes in the same diff or is visibly stale (§5.2); prose that explains *across* the codebase lives in `prose/` (§3.4), in the same commits. The failure mode isn't a separate file; it's a separate system.

**`prose/` is a first-class surface of the project**, beside the code, not an appendix to it:

| Folder   | Holds                                                    | Read by Prose                     |
| -------- | -------------------------------------------------------- | --------------------------------- |
| `src/`   | the executable implementation, with `@prose` in its comments | yes: chunks, files, folders (§3.1–§3.3) |
| `prose/` | project understanding: prose whose subject spans more than one file or folder; often also the published documentation (§3.6) | yes: L3 documents (§3.4), linked to the code (§3.5) |
| `docs/`  | the project's own documentation site, if it has one, which may render `prose/` | as ordinary code; building sites is out of scope (§2) |

**Short prose is what makes it work.** A promises doc short enough to hold in mind lets decisions be argued from what the project promises rather than from taste. A first paragraph of three lines is a map; one of three packed sentences is a chore. The convention limits length (§8) because long prose stops being read, and prose that isn't read stops being kept.

**One marker.** The convention has `@prose` and nothing else. Plan state, sections and progress come from structure: a prose block with no code under it is a plan item, a heading is a section, filled code is done. A `@todo`, `@decision` or `@note` marker would be one more thing to keep in sync; decisions go into the prose they change.

**Standard files, not a toolchain.** Adopting a new file type or compiler is expensive even for one person, and breaks `tsc`, the language server, oxlint, oxfmt, vite and every other standard workflow. Prose is a convention (like JSDoc), a CLI that reads it, and an optional Vite plugin whose only job is stripping `@prose` from built HTML (§6.4).

**The agent keeps the map current while it works.** The loop is: the human gives direction in the chat → the agent changes code → the agent updates `@prose` and `prose/` in the same change → the human reads the prose, in the viewer or the editor, and redirects. First paragraphs make the map scannable without an LLM pass (§4); the checks (§5) are mechanical, so they can't hallucinate either.

**What the mechanical checks can't do.** The checks catch prose that names something that doesn't exist, or that wasn't touched when its code was. They can't catch prose that was rewritten in the same change and is simply wrong. That is what the human's reading is for.

## 2. Scope

| In                                                                      | Out                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `.ts`, `.js`, `.css`, `.html`, `.svelte`, `.yaml`/`.yml`, `.toml` with prose in comments | New file types, tangling, `.ts.md` |
| Folder `README.md` as folder prose; `prose/` for cross-cutting prose, publishable as-is (§3.6) | Building the project's documentation site |
| `prose serve`: a read-only Markdown view of the project (§6) | Writing anything from the viewer |
| `prose check`: symbol, staleness and reference checks (§5) | LLM-generated summaries (first paragraphs are used) |
| Stripping `@prose` from built HTML (§6.4) | Anything else in production builds |

Target: small apps, audience of one, for personal use. Up to about 500 source files.

The workflow it assumes is one person working in sessions with agents, often for a long time before committing. So nothing may depend on work having been committed: the viewer reads the working tree, and the staleness check counts uncommitted lines as newest (§5.2).

## 3. The convention

### 3.1 Prose blocks

A **prose block** is a comment whose first token is the **`@prose`** marker. The same rule applies in every language:

| Language      | Prose block                         |
| ------------- | ----------------------------------- |
| JS, TS, CSS   | `/** @prose … */` at top level      |
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

- The body is everything after `@prose`, with the leading ` * ` stripped in JS, TS and CSS. It is CommonMark + GFM.
- **`@prose` starts the block on its own line, and the closing delimiter (`*/` or `-->`) sits on its own line too** — never `/** @prose text */` on one line. In JS/TS/CSS this keeps every body line gutter-prefixed with ` * `, so formatters (oxfmt) re-indent the block as JSDoc, and a body line that itself starts with `*` (a Markdown bullet) can't be mistaken for the gutter. In HTML there's no gutter; the rule is for readability.
- **Every other comment is a code comment**, including unmarked `/** */` JSDoc, `//`, `/* */`, and unmarked `<!-- -->`. So API docs like `/** @param x */`, `// TODO`, and tool pragmas like `<!-- svelte-ignore … -->` are never read as prose.
- The marker is opt-in because comments already have many owners: JSDoc, Vite, Svelte, formatters, and linters. Adding a marker is also the explicit step of promoting a comment to prose.
- In JS, TS and CSS, prose blocks inside function, class, or rule bodies (or any nested callback or object literal) are ignored. Ignored, not silently dropped: each one is reported as a warning on its file, so a misplaced block shows up instead of vanishing.
- JS and TS comments, including a `.svelte` file's `<script>`, are found with `oxc-parser` (its comment list and the AST for depth), the same parser the symbol check uses. CSS, HTML, YAML and TOML use a small scanner of their own.
- TypeScript treats `@prose` as a JSDoc tag, so an editor hover shows the prose as that tag's text. It's readable, if slightly noisy.
- YAML and TOML have no block-comment delimiter, so a prose block there is a maximal run of `#`-prefixed lines starting with a `# @prose` line, each line's own `# ` gutter stripped. Only counts at column 0 — an indented `#` comment (nested inside a mapping/table) is an ordinary comment, the same "top level only" rule braces get. A generated lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, …) is excluded by filename regardless of extension.

In `.svelte` files, each part follows its own language's rule: `<script>` follows the JS/TS rule, the markup follows the HTML rule, and `<style>` follows the CSS rule. The chunks from all three parts are merged in source order. The file prose is the first prose block in any of the parts.

A `.md` file that isn't a `README.md` (for example, site content) is shown as a prose-only document. It has no chunks.

JSON files (`package.json`, `tsconfig.json`, …) can't carry a comment, so they are shown as **raw** files: highlighted text, no prose, no chunks, no checks, counted as neither documented nor undocumented. Generated lockfiles are excluded, and so is anything over 200 KB.

### 3.2 Blocks and chunks

Within a file:

1. The **first prose block** is the **file prose**.
2. Each later prose block, together with the code that follows it up to the next prose block, is a **chunk**.
3. A chunk whose code is empty (only whitespace before the next prose block or end of file) is **pending**. That is a plan item (§1).
4. Code between the file prose and the first chunk (typically imports) is the **preamble**. It supplies names the symbol check resolves (§5.1), and the viewer folds it like any other code.
5. A prose block whose first line is a Markdown heading (`# Filtering`) is just a heading in the flow. There is no separate section level.

**The file is the smallest unit you navigate to.** A chunk read on its own, without the rest of its file, doesn't make sense: it loses the imports, the neighbouring definitions, the order things happen in. So chunks are not pages. On its file's page a chunk appears in place, its prose directly above its code, and the file reads top to bottom as it was written.

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

The last block is a pending chunk: a plan item with no code yet, shown in place at the end of the file.

**Anchors.** Each block has an anchor, used as the fragment in its viewer URL (§6.1) and in links from `prose/` docs (§3.5, §5.3). An anchor must name the same block after unrelated edits elsewhere in the file, so it's derived from content, not position:

1. The file prose is `file`.
2. Otherwise, the first name the chunk's code declares: `addTodo`, `toggleTodo`. (JS and TS only, like §5.1.)
3. Otherwise, the slug of the block's heading: `filtering` for the pending chunk above.
4. Otherwise, a positional fallback (`chunk-3`), the only kind that moves when blocks are inserted above it.

A repeated anchor within a file gets a `-2`, `-3` suffix in source order. The chunks above are `src/store.ts#addTodo`, `#toggleTodo` and `#filtering`.

### 3.3 Folders and project

- A folder's `README.md` is its **folder prose** (L2).
- The root `README.md` is the **project prose** (L3).

These are ordinary READMEs; GitHub already renders them.

### 3.4 Cross-cutting prose: `prose/`

Not every piece of prose has a natural home in a comment or a README: what the project promises, architecture that spans files, the order of the work, lessons learned building the thing. Forcing that into one function's comment distorts it as much as leaving it in a wiki does. `prose/` is where it goes instead:

```text
prose/
  idea.md
  plan.md
  lessons.md
```

- **No required names, one recommended doc.** Prose doesn't require specific filenames. It does recommend one short doc (`idea.md`, `spec.md`, whatever the project calls it) that says what the project promises and what it leaves out ("not in v1"). In use it was the most valuable file: decisions could be argued from it, and its non-goals stopped scope creep. It pays off because it's short enough to hold in mind, so keep it that way.
- **Decisions land here.** A decision reached in the chat that spans files is written into the `prose/` doc it changes, in the same change as the code (§8). One that concerns a single spot goes into that spot's `@prose`.
- **The rule of thumb:** prose belongs next to what it explains — in the code via `@prose`, in a folder via `README.md`. `prose/` is for prose that explains *across* the codebase, not a substitute for either.
- **`prose/` docs are checked, not just displayed** (§5.3): they carry no marker, so what ties them to the code is the identifiers and anchors they cite.
- Shown at L3, alongside the project prose (§4), not nested as an ordinary folder. Only the root `prose/` is special: a `src/prose/` folder is an ordinary folder.

The tree includes the files git would track: tracked files plus untracked ones not ignored by `.gitignore`, so a brand-new file shows up before it's committed. Outside a git repository, the tree falls back to a fixed skip list (`node_modules`, `dist`, dot-folders).

### 3.5 References

A reference names a place in the project, and the syntax is an ordinary relative Markdown link, so it reads and clicks the same on GitHub, in the editor's preview, in the viewer (§6.1) and on a site that publishes `prose/` (§3.6):

```text
src/session.ts                     a file
src/session.ts#createSession       a block in it, by its anchor (§3.2)
prose/architecture.md              a prose/ doc
prose/architecture.md#sessions     a section of it, by heading slug
```

An inline code span that names an identifier (`` `createSession` ``) is a reference too, resolved by the symbol check (§5.1).

**State a rule once, and link to it.** When a `prose/` doc or a tested file owns a rule (a grammar, a schema, a contract), a `@prose` block links to it and keeps only how and why this code does it. Restating the rule in several places means only one copy is tested, and the others drift.

### 3.6 Publishing `prose/`

The docs a project is designed by are usually the ones its users need too: what it is, the language or API it offers, how it's built, what it learned. So `prose/` is written to be published as it is, with no copy in `docs/` to drift. [markz](https://github.com/amitkaps/markz) does this: its site renders `prose/markz.md` as the home page and `syntax.md`, `grammar.md`, `design.md` and `lessons.md` as pages, read in place at build time, and the repo's `README.md` stays for GitHub.

The convention already fits a site, as long as the docs keep to it:

- **No metadata block.** A doc's title is its first heading and its summary is its first paragraph (§4), so a site reads both from the Markdown itself.
- **Links by repo path** (§3.5). A site maps a link to another published doc onto that doc's route, and any other relative link (to code, or to an unpublished doc) onto the file on GitHub, so no link breaks in either place.
- **Written for a reader who wasn't in the chat.** A decision is recorded as what the project does and why, not as the conversation that reached it. Neutral, current, rewritten rather than appended (§8).
- **The site chooses what's published.** Not every `prose/` doc is for users: `plan.md` usually isn't. The site lists the docs it renders; Prose prescribes no marker for it.

Building the site is the project's own work (markz renders its pages with markz). Prose's part is keeping the docs publishable, and checking their links (§5.3).

## 4. Hierarchy

| Level | Unit    | Prose from           | Structure from                          |
| ----- | ------- | -------------------- | --------------------------------------- |
| L3    | project | root `README.md` + `prose/*.md` | folder tree                  |
| L2    | folder  | folder `README.md`   | files and subfolders                    |
| L1    | file    | file prose block     | its chunks, in place, and its code      |

**L3 is a small set of documents, not one.** The project page shows the root `README.md` first, then every `prose/*.md` file, each summarized by its first paragraph. They're alphabetical by filename; `prose/` has no prescribed taxonomy to rank by (§3.4).

**Summaries are first paragraphs.** At any level, each child is shown as its name plus the first paragraph of its prose. No LLM is involved: the agent keeps prose current (§8), and the viewer only selects from it. A child with no prose shows as *undocumented*.

The first paragraph says what the node *means* (its role, its intent, how it fits), not what its code does line by line. It is short (about three lines, §8) and the agent rewrites it whenever the node's role changes.

**What the map is for.** In use, the first paragraphs mostly help *find* the right file — grepping them beats reading code — and hold the design in mind across the project. They don't replace reading a file once you're changing it. That is enough to be worth keeping.

## 5. Checks

The checks run in `prose check` (§5.4). They produce warnings; none is generated text.

### 5.1 Symbol check

In a chunk's prose, an inline code span that looks like an identifier (`addTodo`, `store.subscribe`) is resolved against identifiers the project declares:

1. **In the chunk's own code:** it resolves.
2. **Elsewhere in the project:** it resolves, to that chunk.
3. **Nowhere:** it is flagged as an **unresolved symbol**.

Keywords and literals (`true`, `null`, `undefined`) and spans that aren't identifier-shaped (`completed: false`) are skipped. This applies to JS and TS; CSS selectors and HTML ids come later.

### 5.2 Staleness check

Using `git blame -w --porcelain` per file, a chunk is **possibly stale** when its newest code line is newer than its newest prose line. Uncommitted changes count as newest. `-w` ignores whitespace-only changes, and a `.git-blame-ignore-revs` file, if present, is passed along, so a reformat neither flags nor clears anything.

This is a heuristic signal, computed on demand, with nothing stored. Editing the prose (even to confirm it) clears it. Its limits:

- It fires when code changes and its prose doesn't. An agent following §8 updates both in the same change, so on agent work it mostly stays quiet. It says nothing about whether the updated prose is right (§1).
- Uncommitted lines all count as newest, so within an uncommitted session a chunk whose code and prose were both touched is never stale.
- A tuning change (a faster loop, same behaviour) rightly leaves prose alone and still flags it. Clearing it only takes a prose edit, so it's a prompt to reread the prose against the code, not a guarantee.

### 5.3 Cross-cutting checks: `prose/` against `@prose`

Cross-cutting docs stay checkable against the code, the same way chunk prose is. A `prose/*.md` file carries no marker, so the link to the code is what it cites.

1. **Symbol check on docs.** Inline code spans in a `prose/*.md` file resolve as in §5.1, against the project-wide declaration table. Only the "in the chunk's own code" case doesn't apply.
2. **Anchor references.** A doc or an `@prose` block can cite a chunk by its path and anchor (§3.5). An unresolved path or anchor is a warning. The reverse holds too: an `@prose` block linking to `prose/spec.md#5-checks` is checked against that doc's heading slugs, so renaming a heading breaks loudly.
   **Doc names are derived, never declared.** A doc answers to its path under `prose/` without the extension (`spec`, `feature/recommend`), plus a heading slug for a section (`spec#checks`). There is no frontmatter to keep in sync, so a rename breaks the reference instead of leaving a stale alias.
3. **Section references.** A `§5.2`-style reference resolves against the numbered headings of the doc it names; a missing section is a warning.
4. **Doc staleness.** As §5.2, per paragraph: a doc paragraph is possibly stale when a chunk it references (via 1 or 2) has code newer than the paragraph's own newest line. Editing the paragraph clears it.
5. **Duplication.** A `@prose` block that near-duplicates a paragraph in a `prose/` doc (compared by normalized text) is flagged: the rule belongs in one place, and the other links to it (§3.5).

### 5.4 `prose check`

A CLI, `prose check [root]`, runs every check over the project and prints one line per warning (`file:line  kind  message`), grouped by file, with a count at the end. It also lists misplaced prose blocks (§3.1).

- It exits `0` by default, so an agent can run it freely. `--strict` exits non-zero when there are warnings, for CI.
- It needs no Vite, no dev server and no config. It runs where the agent already runs commands.
- The agent runs it before finishing a change (§8), which is what keeps the prose honest when nobody is reading it that day.

## 6. The viewer: `prose serve`

`prose serve [root]` starts a small, read-only HTTP server and prints its URL. Every page is Markdown rendered to HTML on request: the project, a folder, a `prose/` doc, or a source file. There's no client app, no RPC and no state; the browser gets plain HTML with one stylesheet and a few lines of script.

It stands apart from the app's own dev server on purpose. It works in any repo (a library has no app to mount into), and it reads the same files the editor and GitHub read.

### 6.1 Pages

URLs mirror repo paths, so a relative Markdown link in the prose works the same in the viewer as on GitHub (§3.5):

- **`/`: the project.** The root `README.md`, then each `prose/*.md` doc and each top-level folder, with its first paragraph (§4).
- **`/src/`: a folder.** Its `README.md`, then its subfolders and files, each with its first paragraph. Undocumented files say so.
- **`/prose/plan.md`: a doc**, or any other `.md` file. Rendered as it is.
- **`/src/store.ts`: a source file, as one Markdown document.** The file prose first, then each chunk's prose in source order, with its code between them in a folded, highlighted block. A pending chunk shows as its prose with a *pending* mark. A file with no prose is its code, unfolded. A **Show code** toggle unfolds every block on the page. A block's anchor (§3.2) is its fragment: `/src/store.ts#addTodo`.

Every page has a breadcrumb to its ancestors and a link to open the file in the editor (`vscode://file/…`). The page reloads when a file it shows changes, through a file watcher and a server-sent event, keeping the scroll position.

The viewer doesn't show check results: those come from `prose check` (§5.4), where the agent reads them. Keeping the viewer to reading keeps it simple, and a page that is only prose loads fast.

### 6.2 No annotations

The viewer writes nothing. The 0.1.0 route could add and resolve `@note`s in source, and they weren't used: discussion happened in the chat over several turns, and the agent wrote the outcome back into the prose. A note parked in a comment waits until someone thinks to look; a question asked in the chat gets answered. So direction is given in the chat, and the result lives in `@prose` and `prose/` (§3.4, §8).

### 6.3 Server

- Binds to `127.0.0.1` by default; `--host` exposes it, which is safe because nothing is writable. `--port` picks the port (default `4400`, the next free one if taken).
- Serves only files in the tree (§3.4). A path that resolves outside the root, or to a file the tree doesn't hold, is a 404.
- Parses a file when its page is requested, with nothing cached across requests except the highlighter. A folder or project page reads only the first paragraphs of its children. At the target size (§2) that's fast enough without incremental work.
- Rendering uses the same parser (§3.1) and a Markdown renderer with GFM; code is highlighted server-side.

### 6.4 Build: strip HTML prose

Vite keeps HTML comments in built pages, so without this step `<!-- @prose -->` blocks would be visible to anyone viewing the page source. The package exports an optional Vite plugin, `prose()`, whose only job is this: in `vite build`, it removes `@prose` comments from `.html` output in a `transformIndexHtml` hook, together with the whitespace line each one leaves behind. Unmarked comments are left alone. In dev it does nothing.

Nothing else needs stripping. Minifiers drop `/** @prose */` from JS and CSS, since they keep only `@license`, `@preserve` and `/*!` comments. The Svelte compiler drops markup comments by default (`preserveComments: false`).

Two limits:

- **SvelteKit** never runs `transformIndexHtml` in `vite build` (it warns "not supported"), so a `@prose` in `app.html` would ship. Keep prose out of `app.html` on a SvelteKit host.
- **Sourcemaps** embed the original source, comments included, when `build.sourcemap` is on. Deploying the `.map` files publishes every `@prose` in them.

## 7. Tried and dropped

0.1.0 built more than was used. Each of these is out, with the reason, so it isn't rebuilt by default. `lessons.md` has the detail.

- **A dev route inside the app's Vite server, on Devframe** (typed RPC, synced state, a Svelte client with a rail, palette, badges and a health panel). Nobody opened it much: the prose was read in the editor and on GitHub. A plain Markdown viewer (§6) covers the reading that did happen.
- **The `@note` annotator** (block notes, line notes, write-back with hash guards). Discussion stayed in the chat (§6.2). In the two field repos, one note sat open for weeks and the other had none.
- **The *since* view and "code review without a pull request".** When an agent changes code quickly, the human didn't review changes block by block; they read the prose that says what the code means now.
- **Agent-written dev tools (`dev/*.tool.ts`) and the import-graph diagram.** Never built; nothing in use asked for them.

## 8. Agent contract

The package ships a snippet for the project's `CLAUDE.md` / `AGENTS.md`:

- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`.
- Every prose block, file, folder and `prose/` doc begins with a short first paragraph that is its summary for the human (§4): about three lines, one idea per sentence. It says what the node means, not what its code does; detail goes in the chunks below. When a change alters a node's role, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments (§3.1). Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a `prose/` doc or a tested file owns it, link to it (§3.5) and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change: into the `prose/` doc they change when they span files, into the `@prose` block when they concern one spot. Write `prose/` docs for a reader who wasn't in the chat, since they may be published as they are (§3.6): what the project does and why, linked by repo path, with no metadata block. Keep the project's promises doc (§3.4) short, and update its non-goals when something is ruled out.
- Keep `prose/plan.md` (or its equivalent) current: what's done in one line each, what's next in order. Work that belongs to one file can be a pending chunk there instead.
- Run `prose check` before finishing. Resolve unresolved symbols and broken references. Treat a possibly-stale warning as a prompt to reread the prose against the code, not as something to clear with a token edit.

## 9. Test cases

### 9.1 `examples/single`: the smallest case

[`examples/single/`](../examples/single/) is a counter on one static page: `index.html`, `style.css`, `main.js` and a `README.md`. Plain Vite is its only dev dependency; there are no runtime dependencies and no framework. It is written to the convention from the start:

- file prose in all three files;
- headed blocks (`# State`, `# Input`, …) in the CSS and JS;
- chunk prose that mentions `count`, `render` and `data-step`, for the symbol check;
- one pending chunk, `# Persistence` at the end of `main.js`, as a plan item.

It exercises the parser, every page kind in the viewer, and both chunk checks.

### 9.2 Real projects

Three separate repos use Prose the way any outside project would, through the released package, so packaging problems show up there and not in a linked copy:

- [amitkaps/base](https://github.com/amitkaps/base): a small static site on SvelteKit + Svelte 5, Vite+, prerendered. It has TS modules, `.svelte` files with all three parts and plain CSS, and it's the one host that needs the HTML strip (§6.4).
- [amitkaps/sitez](https://github.com/amitkaps/sitez): a zero-config static site generator with a short promises doc (`prose/idea.md`) and 89 `@prose` blocks. Its one open `@note` (`src/site.ts`) is folded into the prose when it adopts this version.
- [amitkaps/markz](https://github.com/amitkaps/markz): a Markdown parser of about 4,600 lines of TypeScript, with a tested grammar in `prose/` that `@prose` blocks should link to rather than restate (§3.5). Its documentation site (`docs/`) publishes `prose/` in place (§3.6).

Verify:

- [ ] `prose serve` on each repo: the project, folder, doc and file pages render; relative links between prose and code resolve; the page reloads on save.
- [ ] `prose check` on each repo finishes in a few seconds and its warnings are worth reading. Label a sample true or false and track the false-positive rate.
- [ ] `vite build` output on `amitkaps/base` is byte-identical with the plugin on and off, except that `@prose` comments are removed from `.html` files.
- [ ] `pnpm check` and `pnpm test` pass unchanged in each repo, with no Prose config.
- [ ] Unmarked comments (JSDoc, `//`, `svelte-ignore` and other pragmas) are not treated as prose.
- [ ] The staleness check flags a chunk after a code-only commit, and clears after a prose edit.

## 10. Open questions

- **Static export.** `prose build out/` writing the same pages as static HTML. A project that publishes `prose/` (§3.6) builds its own site today, rendered with its own Markdown (markz with markz); an export would suit one that doesn't care how its docs look. Only if a second project asks for it.
- **Check results in the viewer.** A quiet count per file, if reading and checking turn out to want the same page.
- **Nested chunks.** Should prose blocks for class members and nested functions become sub-chunks?
- **Summaries beyond first paragraphs.** Use LLM summaries, cached by a hash of the children, only if first paragraphs prove too thin.
- **Anchors beyond JS/TS.** CSS, HTML and YAML chunks have no declared name, so they fall back to a heading or position (§3.2). A CSS chunk's first selector, or an HTML chunk's first `id`, could serve.
- **Docs in subfolders of `prose/`.** A medium project will want `prose/feature/recommend.md` beside `prose/spec.md`. Derived names already handle it (path under `prose/`), but the tree walker reads only the top level today, and L3 needs a rule for nesting.
- **Coarser doc staleness.** Optional `covers: [src/tree.ts, …]` frontmatter, so a doc that describes a module without naming symbols goes stale when any covered file changes after it. Only if §5.3's citation-based checks leave gaps.
