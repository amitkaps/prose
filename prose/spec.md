# Prose

Standard web source files, a light prose convention in their comments, and a dev route that shows the codebase as a navigable, annotatable document.

- The **app** is where the code executes.
- **`/__prose/`** is where prose and code are read, navigated, and given direction.

Repo: [amitkaps/prose](https://github.com/amitkaps/prose) · npm: `@amitkaps/prose` · web: [prose.amitkaps.com](https://prose.amitkaps.com)

## 1. Thesis

**The hypothesis.** After an agent makes a few dozen meaningful changes, can the human spend five minutes in `/__prose/` and recover **what changed, why, what's still uncertain, and where to step in**? The *since* view (§6.5) answers "what changed", the prose answers "why", open `@note`s (§6.2), whoever wrote them, answer "what's uncertain", and the map of summaries (§4) shows where to step in. Everything in this spec is judged against those four questions: a feature that makes the view more impressive without improving one of them doesn't go in.

The sweet spot is one human plus coding agents on a small but real app (§2 gives the size) — tiny projects don't need the ceremony, and very large ones have coordination problems this doesn't solve. It's most valuable exactly when the agent writes code faster than the human can read it.

**Humans and agents work in divided worlds.** The agent works in text and code at thousands of words a minute; the human reads at a few hundred and reasons spatially and structurally. What passes between them today is thin: walls of Markdown plans, specs, and diffs. (See Maggie Appleton, [Planning with Agents](https://maggieappleton.com/planning-agents).)

**Separate specs and plans drift — when they live outside the repo.** A spec in Notion or a wiki, disconnected from the commits that implement it, rots because nothing forces it to change in the same diff. Prose fixes this two ways, not one: prose that explains *a specific piece of code* lives directly in it (`@prose`, §3), so it changes in the same diff as that code or it's visibly stale (§5.2); prose that explains *across* the codebase — architecture rationale, a migration's history, engineering lessons — lives in `prose/` (§3.4), still in the same repo, same commits, same review. The failure mode isn't "a separate file"; it's a separate *system*.

**`prose/` is a first-class surface of the project**, beside the code, not an appendix to it:

| Folder   | Holds                                                    | Read by Prose                     |
| -------- | -------------------------------------------------------- | --------------------------------- |
| `src/`   | the executable implementation, with `@prose` in its comments | yes: chunks, files, folders (§3.1–§3.3) |
| `prose/` | project understanding: prose whose subject spans more than one file or folder | yes: L3 documents (§3.4), linked to the code (§3.5) |
| `docs/`  | published documentation, for users of the project        | no: out of scope (§2)             |

**The agent writes the code, and most of the prose.** The human doesn't need to read code line by line or write all the prose. The human needs to hold the **mental model of the whole architecture**, and to give direction at any level of it.

**So we need different dev tools, in two layers:**

| Layer   | Shows                                  | Tool                                                   |
| ------- | -------------------------------------- | ------------------------------------------------------ |
| Problem | the parameters of what's being solved  | problem-specific dev tools, written by the agent (§7)  |
| Code    | what was built and why, at every level | the Prose view: hierarchical prose + code (§4–§6)  |

**Plan items live next to the code they're about.** A prose block with no code under it yet is a plan item. Planning = writing prose at some level; building = the agent filling the code in; reviewing = reading the view and leaving notes. Work that belongs to one file is a pending chunk in that file, not a line in a separate list. Only what spans the codebase (phases, ordering) goes in a `prose/` doc such as `plan.md`.

**Two markers, on purpose.** The convention has `@prose` and `@note`, and nothing else. Plan state, sections and progress come from structure: a prose block with no code under it is a plan item, a heading is a section, filled code is done. A `@todo`, `@plan`, `@decision` or `@requirement` marker would be one more thing to keep in sync, and each would drift the way separate plans do. What's mechanically derivable from source stays derived; the same goes for summaries (§4), which aren't generated, and doc names (§5.3), which aren't declared.

**Standard files, not a toolchain.** Adopting a new file type or compiler is expensive even for one person, and breaks `tsc`, the language server, oxlint, oxfmt, vite, and every other standard workflow. Prose is a convention (like JSDoc) plus a Vite plugin that is dev-only apart from one step: stripping `@prose` comments from HTML output (§6.4). JS, CSS and Svelte build output is untouched.

**`@prose` isn't documentation — it's the map the agent keeps current while working.** The agent maintains the map while it builds the system; the human uses the map to maintain their mental model. The loop is: human gives direction → agent changes code → agent updates `@prose` in the same diff → the view reflects the new map → human reads it, in minutes, and redirects. First-paragraph summaries make the map scannable without an LLM pass (§4); the symbol and staleness checks (§5) are mechanical, not generated, so they can't hallucinate either.

**It's code review without a pull request.** A team reviews an agent's work in a PR: a diff, comments on lines, replies, resolved threads, an approval. One person working with agents in long, uncommitted sessions has no PR to hang that on, so Prose does the same review in the code and the plan together:

| PR review                          | Prose                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- |
| The diff against the base branch   | The *since* view against `HEAD` (§6.5): the uncommitted session is the PR |
| Line comments                      | Line notes (§6.2)                                                     |
| General review comments            | Block notes, on the `@prose` block they're about                      |
| A reply in the thread              | The agent changes the code or prose and deletes the note; the change is the answer |
| Resolve conversation               | The note is deleted, and shows as resolved in the *since* view        |
| "Outdated" comments                | None: a note moves with the code it sits beside                       |
| Submit review                      | Asking the agent to "handle notes" (§8)                               |
| Approve, "changes since last review" | **Mark reviewed**, the *since* view's baseline (§6.5)               |
| PR description                     | The `@prose` blocks, kept current rather than written once            |

Two things it does that a PR review can't. A pending chunk (§3.2) can be reviewed before any code exists, so the plan gets the same review as the code. And the review lives in the source, so the agent reads it without an API and it moves with the code.

**What the mechanical checks can't do.** The checks (§5) catch prose that names something that doesn't exist, or that wasn't touched when its code was. They can't catch prose that was rewritten in the same change and is simply wrong. That is what the human's reading is for, and why the view is built around reading, not around a score.

## 2. Scope of the prototype

| In                                                                      | Out                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `.ts`, `.js`, `.css`, `.html`, `.svelte`, `.yaml`/`.yml`, `.toml` with prose in comments | New file types, tangling, `.ts.md` |
| Folder `README.md` as folder prose; `prose/` for cross-cutting prose | A published documentation site |
| `/__prose/` dev route: navigation, woven view, import-graph diagram | Editing *code* in the view |
| Symbol and staleness checks, on chunks and on `prose/` docs (§5) | LLM-generated summaries (first paragraphs are used) |
| The `@note` annotator, in source | A separate remarks file; live channel to an agent session |
| Mounting agent-written dev tools | Anything in production builds |

Target: small apps, audience of one, for personal use. Up to about 500 source files. Past that, the design would need incremental re-parsing and patched pushes, which are out of scope.

The workflow it assumes is one person working in sessions with agents, often for a long time before committing. So nothing may depend on work having been committed: notes are added and resolved within a session, and the *since* view (§6.5) compares against the working tree, not only against commits.

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
- The marker is opt-in because comments already have many owners: JSDoc, Vite, Svelte, formatters, and linters. Adding a marker is also the explicit step of promoting a comment to prose (§9.2).
- In JS, TS and CSS, prose blocks inside function, class, or rule bodies (or any nested callback or object literal) are ignored in the prototype. Ignored, not silently dropped: each one is reported as a warning on its file, so a misplaced block shows up instead of vanishing.
- JS and TS comments, including a `.svelte` file's `<script>`, are found with `oxc-parser` (its comment list and the AST for depth), the same parser the symbol check uses. CSS, HTML, YAML and TOML use a small scanner of their own.
- TypeScript treats `@prose` as a JSDoc tag, so an editor hover shows the prose as that tag's text. It's readable, if slightly noisy.
- YAML and TOML have no block-comment delimiter, so a prose block there is a maximal run of `#`-prefixed lines starting with a marker line (`# @prose`/`# @note`), each line's own `# ` gutter stripped; two markers can sit back-to-back with no blank line between (a `@note` directly after its `@prose` block, same as the other styles). Only counts at column 0 — an indented `#` comment (nested inside a mapping/table) is an ordinary comment, the same "top level only" rule §3.1 gives braces. A generated lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, …) is excluded by filename regardless of extension — nothing to say prose about in a file nobody hand-edits.

In `.svelte` files, each part follows its own language's rule: `<script>` follows the JS/TS rule, the markup follows the HTML rule, and `<style>` follows the CSS rule. The chunks from all three parts are merged in source order. The file prose is the first prose block in any of the parts.

A `.md` file that isn't a `README.md` (for example, site content) is shown as a prose-only document node. It has no chunks.

JSON files (`package.json`, `tsconfig.json`, …) can't carry a comment, so they appear as **raw** nodes: highlighted text, no prose, no chunks, no checks, counted as neither documented nor undocumented. Generated lockfiles are excluded, and so is anything over 200 KB.

### 3.2 Blocks and chunks

Within a file:

1. The **first prose block** is the **file prose**.
2. Each later prose block, together with the code that follows it up to the next prose block, is a **chunk**.
3. A chunk whose code is empty (only whitespace before the next prose block or end of file) is **pending**. That is a plan item (§1).
4. Code between the file prose and the first chunk (typically imports) is the **preamble**. It is not shown on its own; it only supplies names the symbol check resolves (§5.1).
5. A prose block whose first line is a Markdown heading (`# Filtering`) is just a heading in the flow. There is no separate section level.

**The file is the smallest unit you navigate to.** A chunk read on its own, without the rest of its file, doesn't make sense: it loses the imports, the neighbouring definitions, the order things happen in. So chunks are not pages. On its file's page a chunk appears in place, its prose directly above its code, and the file reads top to bottom as it was written. If a file is too big to hold in your head, that is a `@note` asking for it to be split, not something the view cuts up for you.

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

**Anchors.** Each block has an anchor, used in its URL (§6.1), as a note's write target (§6.3), and in links from `prose/` docs (§5.3). An anchor must name the same block after unrelated edits elsewhere in the file, so it's derived from content, not position:

1. The file prose is `file`.
2. Otherwise, the first name the chunk's code declares: `addTodo`, `toggleTodo`. (JS and TS only, like §5.1.)
3. Otherwise, the slug of the block's heading: `filtering` for the pending chunk above.
4. Otherwise, a positional fallback (`chunk-3`), the only kind that moves when blocks are inserted above it.

A repeated anchor within a file gets a `-2`, `-3` suffix in source order. The chunks above are `src/store.ts#addTodo`, `#toggleTodo` and `#filtering`.

Because some anchors can still move, every write also carries the content hash of the block it targets, and the server refuses a write whose block has changed since the client last saw it (§6.3).

### 3.3 Folders and project

- A folder's `README.md` is its **folder prose** (L2).
- The root `README.md` is the **project prose** (L3).

These are ordinary READMEs; GitHub already renders them.

### 3.4 Cross-cutting prose: `prose/`

Not every piece of prose has a natural home in a comment or a README — architecture rationale that spans files, the history of a migration, engineering lessons learned building the thing. Forcing that into one function's comment distorts it as much as leaving it in a wiki does. `prose/` is where it goes instead:

```text
prose/
  architecture.md
  migration-2026-09.md
  lessons.md
```

- **No prescribed taxonomy, and no reserved name.** Prose doesn't require or expect specific filenames (no mandatory `spec.md`/`plan.md`, and no `remarks.md` either — the human↔agent feedback channel is `@note`, in source, §6.2). Every file in `prose/` is plain cross-cutting prose: a whole-document node, same as any other `.md` file that isn't a `README.md` (§3.1), just placed here because it explains something wider than one file.
- **The rule of thumb:** prose belongs next to what it explains — in the code via `@prose`, in a folder via `README.md`. `prose/` is for prose that explains *across* the codebase, not a substitute for either.
- **`prose/` docs are checked, not just displayed** (§5.3): they carry no marker, so what ties them to the code is the identifiers and anchors they cite.
- Surfaced at L3, alongside the project prose (§4) — not nested as an ordinary folder, since its contents are about the whole project, not about a `prose` subdirectory specifically. Only the root `prose/` is special: a `src/prose/` folder is an ordinary folder.

The tree includes the files git would track: tracked files plus untracked ones not ignored by `.gitignore`, so a brand-new file shows up before it's committed. Outside a git repository, the tree falls back to a fixed skip list (`node_modules`, `dist`, dot-folders).

### 3.5 References

A reference names a place in the project, and the syntax is an ordinary Markdown link, so it reads and clicks the same on GitHub:

```text
src/session.ts                     a file
src/session.ts#createSession       a block in it, by its anchor (§3.2)
prose/architecture.md              a prose/ doc
prose/architecture.md#sessions     a section of it, by heading slug
```

An inline code span that names an identifier (`` `createSession` ``) is a reference too, resolved by the symbol check (§5.1).

References are what turn `prose/` from a folder of Markdown into a connected model of the system. A doc about authentication links down to the code that implements it:

```text
prose/authentication.md
  → src/auth.ts#authenticate
  → src/session.ts#createSession
  → src/api/client.ts#request
```

and each of those blocks shows the doc as a backlink (§4). The view turns references into navigation, backlinks and, when one stops resolving, a warning (§5.3). `docs/` isn't a target: published documentation is out of scope (§2).

## 4. Hierarchy

| Level | Unit    | Prose from           | Structure from                          |
| ----- | ------- | -------------------- | --------------------------------------- |
| L3    | project | root `README.md` + `prose/*.md` | folder tree + import-graph diagram |
| L2    | folder  | folder `README.md`   | files and subfolders                    |
| L1    | file    | file prose block     | its chunks, in place, and its code      |

**L3 is a small set of documents, not one.** The project view shows the root `README.md` first, then every other `prose/*.md` file as its own named section — each summarized by its own first paragraph, same as any other node. There's no ranking beyond that (alphabetical by filename); `prose/` has no prescribed taxonomy to rank by (§3.4). Each doc section also lists **backlinks**: the chunks it cites (§5.3), and each chunk lists the docs that cite it. A doc section citing nothing is pure rationale, which is fine, but visible.

**Summaries are first paragraphs.** At any level, each child is shown as its name plus the first paragraph of its prose. No LLM is involved in the prototype: the agent keeps prose current (§8), and the view only selects from it. A child with no prose shows as *undocumented*.

The first paragraph isn't a display convention. It's how the agent keeps the human's mental map current: it says what the node *means* (its role, its intent, how it fits), not what its code does line by line, and the agent rewrites it whenever that changes (§8). If the first paragraphs are right, the map is right.

**The map is read in two directions.** Horizontally, across siblings at one level: a folder's files, each with its summary, read like a sequence (`Authentication → Sessions → Permissions → Logout`). Vertically, from intent down to implementation: project → folder → file → the chunk in place (`System → auth/ → session.ts → createSession`). The tree and its first paragraphs already give both; there is no separate narrative to write or keep current.

**The architecture diagram is derived, not written.** It is the import graph between the project's modules, read from `oxc-parser`'s module records (the parser is already a dependency, §3.1). Nodes are grouped by folder, and each node links to its L1 view. It can't hallucinate.

## 5. Checks

Both checks show as warnings in the view. Neither fails a build.

### 5.1 Symbol check

In a chunk's prose, an inline code span that looks like an identifier (`addTodo`, `store.subscribe`) is resolved against identifiers the project declares:

1. **In the chunk's own code:** it resolves, and hovering highlights it in the code.
2. **Elsewhere in the project:** it renders as a link to that chunk.
3. **Nowhere:** it is flagged as an **unresolved symbol**.

Keywords and literals (`true`, `null`, `undefined`) and spans that aren't identifier-shaped (`completed: false`) are skipped. In the prototype this applies to JS and TS; CSS selectors and HTML ids come later.

### 5.2 Staleness check

Using `git blame -w --porcelain` per file, a chunk is **possibly stale** when its newest code line is newer than its newest prose line. Uncommitted changes count as newest. `-w` ignores whitespace-only changes, and a `.git-blame-ignore-revs` file, if present, is passed along, so a reformat neither flags nor clears anything.

This is a heuristic signal, computed on demand, with nothing stored. Editing the prose (even to confirm it) clears it. Its limits:

- It fires when code changes and its prose doesn't. An agent following §8 updates both in the same change, so on agent work it mostly stays quiet. It says nothing about whether the updated prose is right (§1).
- Uncommitted lines all count as newest, so within an uncommitted session a chunk whose code and prose were both touched is never stale.
- Clearing it only takes a prose edit, so it's a prompt to reread, not a guarantee. The *since* view (§6.5) is the main answer to "what changed"; staleness is secondary.

### 5.3 Cross-cutting checks: `prose/` against `@prose`

The point of the project is that cross-cutting docs stay checkable against the code, the same way chunk prose is. A `prose/*.md` file carries no marker, so the link to the code is what it cites. Every check is mechanical, produces warnings only, and generates nothing.

1. **Symbol check on docs.** Inline code spans in a `prose/*.md` file resolve exactly as in §5.1, against the project-wide declaration table: linked to the declaring chunk, or flagged unresolved. Only the "in the chunk's own code" case doesn't apply.
2. **Anchor references.** A doc or an `@prose` block can cite a chunk by its stable path (the forms are in §3.5), `[store](src/store.ts#addTodo)` (§6.1). An unresolved path or anchor is a warning. The reverse holds too: an `@prose` block linking to `prose/spec.md#5-checks` is checked against that doc's heading slugs, so renaming a heading breaks loudly.
   **Doc names are derived, never declared.** A doc answers to its path under `prose/` without the extension (`spec`, `feature/recommend`), plus a heading slug for a section (`spec#checks`). There is no frontmatter to keep in sync, so a rename breaks the reference instead of leaving a stale alias. Doc names are their own namespace: a code identifier of the same name is never shadowed, and the doc is reached through the link form or `` `spec$` `` rather than a bare `` `spec` ``. The bare stem works only when it is unique among docs; an ambiguous one is a warning that asks for the longer path.
3. **Section references.** A `§5.2`-style reference resolves against the numbered headings of the doc it names; a missing section is a warning.
4. **Doc staleness.** As §5.2, per paragraph: a doc paragraph is possibly stale when a chunk it references (via 1 or 2) has code newer than the paragraph's own newest line. Editing the paragraph clears it.
5. **Duplication.** A doc paragraph that near-duplicates an `@prose` block (compared by normalized text) is flagged: per-piece explanation belongs next to the code, and `prose/` holds only what spans it (§3.4).

## 6. The dev route: `/__prose/`

A Vite plugin that mounts a dev-only route at `/__prose/` inside the app's own Vite dev server. It is built on [Devframe](https://devfra.me), which supplies typed RPC, state synced between the node process and the browser, and an MCP adapter. How it's wired, and why not the Vite DevTools hub, is in `src/plugin.ts`'s own prose. In `vite build` the plugin's only job is the HTML strip (§6.4).

**Trust boundary.** The RPC endpoint runs without authentication (`auth: false`), because the dev server listening only on loopback is the boundary for a single-developer tool. The route can write source files (§6.2), so the boundary has to hold:

- Writes are refused when the dev server listens on a non-loopback address (`vite --host`); the view stays read-only there. This is what covers native clients: Devframe lets a connection with no `Origin` header through.
- WebSocket connections from a browser page on a non-loopback origin are refused (Devframe's default). A page on another localhost port is let through: it runs on the same machine, which is inside the boundary.
- A write names a file by its path in the tree. A path that resolves outside the project root (through `..`, an absolute path or a symlink), or to a file the tree doesn't contain, is refused.
- Devframe's MCP route stays off until §10's MCP question is decided.

**One model, no separate views.** Everything the route shows is the same tree of prose and code, reached by moving through it (§6.1). There are no alternative views of it to build and keep in sync. Other ways to explore the code should come from using Prose on a larger app, not be designed ahead of it. Dev tools (§7) are a different thing: instruments for the app's own problem, not views of the prose.

The route's client is a small prebuilt Svelte 5 SPA (Devframe's `clientAssets`), served by Vite; it connects back over Devframe's RPC, so it can call into dev tools (§7) and read app modules through the same connection.

### 6.1 Navigation

- A left rail shows the tree: project → folders → files. Files are the leaves. Branches are collapsible (deep ones collapsed by default, the path to the open node always revealed), and a `/` palette jumps to any node by fuzzy name or path.
- The keyboard moves along both directions of the map (§4): ← and → step to the previous and next sibling, ↑ goes to the parent, and ↓ opens the first child (on a file page, the next block). It's navigation over the same pages, not a presentation mode.
- The breadcrumb links every ancestor. Every node has a copy-link affordance.
- The main pane shows the selected node at its level: its prose, then its children as first-paragraph summaries (§4). At L3 it also shows the diagram. At a file it shows the **whole file in source order**: each prose block rendered where it was written, the highlighted code between them, so nothing is left out. An undocumented file is just its code.
- Every node has a stable URL, and so does every chunk: `/__prose/src/store.ts#addTodo` opens the file and scrolls to that chunk (anchors, §3.2).
- Warnings (§5), pending chunks, and open notes share one badge system on nodes, rolled up to their ancestors, with a hover title saying what kind of thing each count is.
- At L3, above the folder list, a small health panel aggregates what the tree already carries: documentation coverage, warnings and stale chunks, pending share, the symbol-check split, and the files with the least prose per line of code. Nothing in it is generated.
- The view updates live when files change, through Devframe's synced state — no bespoke HMR-websocket wiring.

### 6.2 The annotator: `@note`

`@prose` is the maintained understanding of the code; `@note` is temporary: feedback, uncertainty, a question or a direction attached to it. `@prose` is durable, `@note` is conversation. When a note leads to a decision worth keeping, the agent folds it into the `@prose` block and deletes the note. A note annotates an issue at a spot in the code: a problem, a direction, a question, an answer. It's freeform, and there is one marker on purpose; what kind of note it is, and who it's for, is in its text.

Notes are mainly written from the view. Reading a file woven with its prose, and leaving a note next to the block in question, is easier there than in the editor's file view, and it keeps the human out of the code while still pointing at it. A note is also plain source, so the human can write one in the editor and the agent can leave one when it's unsure or needs a decision.

A note is about a specific spot, so it lives with the code (§1), not in a separate file with its own anchors. It uses the same delimiters and gutter convention as `@prose` (§3.1) and is found by adjacency rather than by an anchor. It can sit in one of two places.

A **block note** is written immediately after the `@prose` block it's about:

```js
/** @prose
 * A heading renderer that gives every heading a page-unique id...
 */
/** @note
 * Should this handle non-Latin scripts too?
 */
function headingId(html) { ... }
```

A **line note** is written directly above a line of code, at any depth, for an issue in code that has no `@prose` block of its own, or is too specific for one:

```js
function headingId(html) {
  /** @note
   * Two headings with the same text get the same id here.
   */
  const id = slugify(text);
  ...
}
```

Unlike `@prose`, `@note` is found at any depth: the top-level rule (§3.1) exists so prose blocks can split a file into chunks, and a note splits nothing. A note that directly follows a `@prose` block is a block note; any other is a line note on the code line below it.

**Where a line note may go.** A comment is legal in some places and not others: inside a template literal, a multi-line string, a `<pre>` or `<textarea>`, an attribute list, or a YAML block scalar it becomes content or breaks the syntax. So a line note isn't inserted above the exact line picked in the view, but above the start of the construct that contains it: the statement (JS/TS, from the `oxc-parser` AST), the element (HTML and markup), the rule or declaration (CSS), or the key (YAML/TOML). The view shows where the note will land before it's written.

- **No anchor, no orphaning.** A note's position *is* its meaning — it sits right after the block it's about, so there's nothing to resolve and nothing that can silently stop resolving. If the code it's attached to is deleted, the note goes with it; a note about deleted code has nothing left to say.
- **Resolving deletes it.** Nothing is kept once a note is addressed — if the outcome is worth remembering, it belongs in the `@prose` text itself (a decision made permanent), not in a second, disposable log sitting beside it. Notes are often added and resolved within one session, before anything is committed, so the trail of what was resolved comes from the *since* view (§6.5), not from git history.
- **Note text is escaped on write.** A note can contain anything, including the comment's own closing delimiter. The write path escapes `*/` in JS/TS/CSS and `-->` in HTML, and a note line that would read as a marker (`@prose`, `@note`) in YAML/TOML, so a note can never end its comment early or start a new block. Resolving a note removes exactly the bytes adding it inserted.
- **One open note per spot.** Adding a note to a block or line that already has one replaces it rather than stacking a second — "does this spot have outstanding feedback" stays a yes/no question. A block can hold its block note plus line notes in its code.
- **"What's open across the project" is a derived view**, not a maintained file: the tree walk that already computes `warningCount` (§5) can collect every `note` the same way, on demand.
- **Every `@prose` block and every code line can carry a note, the file prose's included, so an undocumented file can take notes too.** On the file page each block has its own add and resolve next to its prose, and each code line has an add in its gutter; a line note shows inline at its line. Folder and project prose (`README.md`) and other Markdown have no place for a note yet (§10).

There is no prose editor in the view: a block's own prose is edited by hand in the source, like the code around it. The one write affordance the dev route has is add or resolve a note.

### 6.3 API

The server exposes Devframe RPC functions, namespaced under the `prose` devframe id, for the client:

- `tree` (shared state): the full hierarchy, with summaries, warnings, and notes. Not a call: the server owns it and pushes the whole new tree to every client when a file changes (§6.1).
- `node` (`query`): one node's prose, code, warnings, and note, given its path. For agents and scripts: the dev route's own client doesn't call it, since the tree it already holds carries every node in full.
- `add-note` (`action`): insert or replace a `@note`. A block note is addressed by the block's path (`src/store.ts#addTodo`, or `src/store.ts#file` for the file prose) and its content hash; a line note by the file and line (`src/store.ts:42`) and a hash of that line's text.
- `resolve-note` (`action`): remove a `@note` entirely, addressed by the note itself: its file, its line, and a hash of its text. (Until line notes land, plan step 3, a block note is resolved by its block's path and hash, which covers the note's text.)

`query` functions are reads that can change over time; `action` functions are the writes. Both are typed end to end by Devframe's RPC layer — no hand-rolled request/response shapes. Every write re-reads and re-parses the target file fresh rather than trusting the client's in-memory tree — the file on disk is the only truth. If the addressed block's hash no longer matches (an agent or an editor changed it since the client's tree was pushed), the write is refused and the client shows the fresh block, so a note never lands on the wrong block or overwrites someone else's edit.

### 6.4 Build: strip HTML prose

Vite keeps HTML comments in built pages, so without this step `<!-- @prose -->` and `<!-- @note -->` blocks would be visible to anyone viewing the page source. In `vite build`, the plugin removes both from `.html` output in a `transformIndexHtml` hook, together with the whitespace line each one leaves behind. Unmarked comments are left alone.

Nothing else needs stripping. Minifiers drop `/** @prose */` from JS and CSS, since they keep only `@license`, `@preserve` and `/*!` comments. The Svelte compiler drops markup comments by default (`preserveComments: false`).

Two limits:

- **SvelteKit** never runs `transformIndexHtml` in `vite build` (it warns "not supported"), so a `@prose` in `app.html` would ship. Keep prose out of `app.html` on a SvelteKit host.
- **Sourcemaps** embed the original source, comments included, when `build.sourcemap` is on. Deploying the `.map` files publishes every `@prose` and `@note` in them.

### 6.5 The *since* view

The five-minute test (§1) starts with "what changed". The tree is a snapshot, so Prose needs a temporal device: a way to see the tree against a baseline. What follows is a first design. Its final shape (a toggle, a filter to step through, something else) is decided after seeing a first version in use.

The baselines:

- **Since `HEAD`** (the default): everything in the working tree that differs from the last commit. In a long uncommitted session, that's the session's work.
- **Since another commit**: a ref typed into the toggle, for reviewing across commits.
- **Since last reviewed**: the tree as it was when the human last pressed **Mark reviewed**, kept in the browser's own storage as a content hash per block and the set of open notes. Nothing is written to the project. Opening a page doesn't move this baseline, since looking isn't reviewing; only the explicit action does, like "changes since your last review" in a PR. The view shows when the baseline was set.

In the since view, blocks whose prose or code changed are marked, new pending chunks are listed, and notes that were open at the baseline and are gone now appear as **resolved**. That list is the trail of resolved notes (§6.2), and it works before anything is committed. Badges roll up to folders the same way warnings do.

## 7. Dev tools

Problem-specific tools are written by the agent as ordinary modules in `dev/*.tool.ts`:

```ts
export default {
  title: "Todo state",
  mount(el: HTMLElement) {
    /* render a live view of the store; may import from src/ */
    return () => {
      /* optional cleanup */
    };
  },
};
```

- The dev route finds them with `import.meta.glob` and lists them under **Tools** in the rail.
- They can import app modules directly, so they see real state.
- A tool can be linked from any prose, e.g. `[state inspector](tool:todo-state)`.
- They are never imported by the app, so they are never in the build.

## 8. Agent contract

The plugin ships a snippet for the project's `CLAUDE.md` / `AGENTS.md`:

- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`.
- Every prose block, file, folder and `prose/` doc begins with a short first paragraph that is its summary for the human (§4). It says what the node means, not what its code does. When a change alters a node's role, intent or place in the design, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments (§3.1). Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append.
- Fill pending chunks as plan items. Work that belongs to one file goes in as a pending chunk there, not in a list elsewhere.
- When unsure, or when a decision is the human's, leave a `@note` after the relevant `@prose` block instead of guessing.
- When asked to "handle notes": find every `@note` (`grep -rn "@note"`), address the ones you can act on, and delete them — folding anything worth remembering into the `@prose` block each sat next to. Leave the ones waiting on the human, including your own questions.
- Resolve unresolved-symbol warnings before finishing. Treat a possibly-stale warning as a prompt to reread the prose against the code, not as something to clear with a token edit.

## 9. Prototype test cases

### 9.1 `examples/single`: the smallest case

[`examples/single/`](../examples/single/) is a counter on one static page: `index.html`, `style.css`, `main.js` and a `README.md`. Plain Vite is its only dev dependency; there are no runtime dependencies and no framework. It is written to the convention from the start:

- file prose in all three files;
- headed blocks (`# State`, `# Input`, …) in the CSS and JS;
- chunk prose that mentions `count`, `render` and `data-step`, for the symbol check;
- one pending chunk, `# Persistence` at the end of `main.js`, as a plan item.

Build it first. It exercises the parser, navigation, both checks and the annotator without SvelteKit in the way.

### 9.2 `examples/base`: a real app

[`examples/base/`](../examples/base/) is a copy of [amitkaps/base](https://github.com/amitkaps/base), a small static site: SvelteKit 3 + Svelte 5, Vite+ (`vp`), `marked` + Zod for Markdown content, prerendered, with the Cloudflare adapter. Its CI workflow, deploy script and custom-domain route are removed. `pnpm check`, `pnpm test` and `pnpm build` pass as copied.

It's a good test because it's real but small:

- It has TS modules, `.svelte` files with all three parts, and plain CSS.
- Its folders (`src/lib`, `src/routes`, `src/content`) give three L2 nodes.
- Its explanatory prose is currently in `//` comments, JSDoc, and one HTML comment, alongside `svelte-ignore`-style pragmas. **Converting it is the real test**: deciding which comments to promote to `@prose`, and whether the woven view is then worth more than the comments were.
- It runs on Vite+, not plain Vite, so it tests that the plugin is an ordinary Vite plugin.
- The dev route has to live alongside SvelteKit's own routing.

Steps:

1. Add the Prose plugin to `vite.config.ts`. Note that base passes an empty plugin list when `VITEST` is set.
2. Promote the explanatory comments to `@prose` blocks, and add file prose and folder `README.md`s. Leave code-level comments as they are. Note which comments were hard to classify; that's input for the convention.
3. Add one pending chunk: a new feature, written only as prose.
4. Add `dev/docs.tool.ts`, which shows every content page's parsed frontmatter and heading ids. This is a problem-layer tool for the content model.
5. Add the §8 snippet to `examples/base/AGENTS.md`.

Verify:

- [ ] `vite build` output is byte-identical with the plugin on and off, except that `@prose` comments are removed from `.html` files. The built HTML contains no `@prose`, and unmarked comments are still there.
- [ ] `pnpm check` (Oxfmt, Oxlint, tsc, svelte-check) and `pnpm test` pass unchanged, with no Prose config.
- [ ] `/__prose/` is served in `vp dev` alongside SvelteKit, and SvelteKit routes still work.
- [ ] Unmarked comments (JSDoc, `//`, `svelte-ignore` and other pragmas) are not treated as prose.
- [ ] `/__prose/` shows L3 → L1 navigation, with first-paragraph summaries at each level, and a file page that reads the whole file in order with each block's prose in place.
- [ ] The import-graph diagram matches the actual imports.
- [ ] The symbol check resolves, links, and flags as §5.1 describes, including a deliberately wrong symbol.
- [ ] The staleness check flags a chunk after a code-only commit, and clears after a prose edit.
- [ ] A note added in the view that asks for a new feature leads the agent, after "handle notes", to add it as a pending chunk (or fill it), and delete the note.
- [ ] Adding, replacing, and resolving a note via `/__prose/` writes back cleanly (Oxfmt leaves the file unchanged otherwise) and round-trips byte-identical when resolved, for any note text (property tests, `src/notes.test.ts`).
- [ ] A note write aimed at a block that changed since the view loaded is refused, not applied elsewhere.
- [ ] Deleting a chunk that has a note deletes the note with it — nothing orphaned to track.
- [ ] A line note added on a line inside a function, a template literal, a multi-line string and an HTML attribute list lands above the enclosing statement or element in each case, and the file still parses and formats unchanged otherwise.
- [ ] The dev tool mounts and shows live store state.
- [ ] Editing a source file updates the open view without a reload.

## 10. Open questions

- **Nested chunks.** Should prose blocks for class members and nested functions become sub-chunks?
- **Summaries beyond first paragraphs.** Use LLM summaries, cached by a hash of the children, only if first paragraphs prove too thin.
- **Anchors beyond JS/TS.** CSS, HTML and YAML chunks have no declared name, so they fall back to a heading or position (§3.2). A CSS chunk's first selector, or an HTML chunk's first `id`, could serve.
- **Live agent channel.** Send a note to a running session directly instead of it waiting to be found by a grep or a "handle notes" request. Devframe ships an MCP adapter (`prose mcp`, once there's a standalone CLI) that could expose tree/node/notes to an agent directly — not wired up in the prototype, which still reaches the agent only through the source files it already reads (§6.2, §8).
- **Notes in Markdown.** Folders, the project, and `prose/*.md` docs can't take a note today, since their prose is Markdown. An HTML comment, `<!-- @note … -->`, after the paragraph or heading it's about would follow the same adjacency rule; GitHub doesn't render it.
- **Problem-layer tools as plan items.** Could a pending chunk reference a dev tool that shows the options being decided between?
- **Docs in subfolders of `prose/`.** A medium project will want `prose/feature/recommend.md` beside `prose/spec.md`. Derived names already handle it (path under `prose/`), but the tree walker reads only the top level today, and L3 needs a rule for nesting: show `prose/` subfolders as groups, or flatten to path-named sections. Also open: whether a folder's docs should instead sit next to the code as its `README.md` (§3.3), with `prose/` kept for what spans folders.
- **Coarser doc staleness.** Optional `covers: [src/tree.ts, …]` frontmatter, so a doc that describes a module without naming symbols goes stale when any covered file changes after it. Only if §5.3's citation-based checks leave gaps.
