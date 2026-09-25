# Prose

Standard web source files, a light prose convention in their comments, and a dev route that shows the codebase as a navigable, annotatable document.

- The **app** is where the code executes.
- **`/__prose/`** is where prose and code are read, navigated, and given direction.

Repo: [amitkaps/prose](https://github.com/amitkaps/prose) · npm: `@amitkaps/prose` · web: [prose.amitkaps.com](https://prose.amitkaps.com)

## 1. Thesis

**Humans and agents work in divided worlds.** The agent works in text and code at thousands of words a minute; the human reads at a few hundred and reasons spatially and structurally. What passes between them today is thin: walls of Markdown plans, specs, and diffs. (See Maggie Appleton, [Planning with Agents](https://maggieappleton.com/planning-agents).)

**Separate specs and plans drift — when they live outside the repo.** A spec in Notion or a wiki, disconnected from the commits that implement it, rots because nothing forces it to change in the same diff. Prose fixes this two ways, not one: prose that explains *a specific piece of code* lives directly in it (`@prose`, §3), so it changes in the same diff as that code or it's visibly stale (§5.2); prose that explains *across* the codebase — architecture rationale, a migration's history, engineering lessons — lives in `prose/` (§3.4), still in the same repo, same commits, same review. The failure mode isn't "a separate file"; it's a separate *system*.

**The agent writes the code, and most of the prose.** The human doesn't need to read code line by line or write all the prose. The human needs to hold the **mental model of the whole architecture**, and to give direction at any level of it.

**So we need different dev tools, in two layers:**

| Layer   | Shows                                  | Tool                                                   |
| ------- | -------------------------------------- | ------------------------------------------------------ |
| Problem | the parameters of what's being solved  | problem-specific dev tools, written by the agent (§7)  |
| Code    | what was built and why, at every level | the Prose view: hierarchical prose + code (§4–§6)  |

**Plan and code are one document.** A prose block with no code under it yet is a plan item. Planning = writing prose at some level; building = the agent filling the code in; reviewing = reading the view and leaving remarks. There is no separate plan file to drift.

**Standard files, not a toolchain.** Adopting a new file type or compiler is expensive even for one person, and breaks `tsc`, the language server, oxlint, oxfmt, vite, and every other standard workflow. Prose is a convention (like JSDoc) plus a Vite plugin that is dev-only apart from one step: stripping `@prose` comments from HTML output (§6.4). JS, CSS and Svelte build output is untouched.

**`@prose` isn't documentation — it's the map the agent keeps current while working.** The loop is: human gives direction → agent changes code → agent updates `@prose` in the same diff → the view reflects the new map → human reads it, in minutes, and redirects. First-paragraph summaries make the map scannable without an LLM pass (§4); the symbol and staleness checks (§5) are mechanical, not generated, so they can't hallucinate either.

**The test of whether this is working:** after an agent makes a few dozen meaningful changes, can the human spend five minutes in `/__prose/` and recover what changed, why, what's still uncertain, and where to step in? The sweet spot is one human plus coding agents on a real, nontrivial app — tiny projects don't need the ceremony, and very large ones have coordination problems this doesn't solve. It's most valuable exactly when the agent writes code faster than the human can read it.

## 2. Scope of the prototype

| In                                                                      | Out                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `.ts`, `.js`, `.css`, `.html`, `.svelte`, `.yaml`/`.yml`, `.toml` with prose in comments | New file types, tangling, `.ts.md` |
| Folder `README.md` as folder prose; `prose/` for cross-cutting prose | A published documentation site |
| `/__prose/` dev route: navigation, woven view, import-graph diagram | Editing *code* in the view |
| Symbol and staleness checks, on chunks and on `prose/` docs (§5) | LLM-generated summaries (first paragraphs are used) |
| The `@note` annotator, in source | A separate remarks file; live channel to an agent session |
| Mounting agent-written dev tools | Anything in production builds |

Target: small apps, audience of one.

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
- In JS, TS and CSS, prose blocks inside function, class, or rule bodies are ignored in the prototype.
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
- Surfaced at L3, alongside the project prose (§4) — not nested as an ordinary folder, since its contents are about the whole project, not about a `prose` subdirectory specifically.

## 4. Hierarchy

| Level | Unit    | Prose from           | Structure from                          |
| ----- | ------- | -------------------- | --------------------------------------- |
| L3    | project | root `README.md` + `prose/*.md` | folder tree + import-graph diagram |
| L2    | folder  | folder `README.md`   | files and subfolders                    |
| L1    | file    | file prose block     | its chunks, in place, and its code      |

**L3 is a small set of documents, not one.** The project view shows the root `README.md` first, then every other `prose/*.md` file as its own named section — each summarized by its own first paragraph, same as any other node. There's no ranking beyond that (alphabetical by filename); `prose/` has no prescribed taxonomy to rank by (§3.4). Each doc section also lists **backlinks**: the chunks it cites (§5.3), and each chunk lists the docs that cite it. A doc section citing nothing is pure rationale, which is fine, but visible.

**Summaries are first paragraphs.** At any level, each child is shown as its name plus the first paragraph of its prose. No LLM is involved in the prototype: the agent keeps prose current (§8), and the view only selects from it. A child with no prose shows as *undocumented*.

**The architecture diagram is derived, not written.** It is the import graph between the project's modules, parsed with `es-module-lexer`. Nodes are grouped by folder, and each node links to its L1 view. It can't hallucinate.

## 5. Checks

Both checks show as warnings in the view. Neither fails a build.

### 5.1 Symbol check

In a chunk's prose, an inline code span that looks like an identifier (`addTodo`, `store.subscribe`) is resolved against identifiers the project declares:

1. **In the chunk's own code:** it resolves, and hovering highlights it in the code.
2. **Elsewhere in the project:** it renders as a link to that chunk.
3. **Nowhere:** it is flagged as an **unresolved symbol**.

Keywords and literals (`true`, `null`, `undefined`) and spans that aren't identifier-shaped (`completed: false`) are skipped. In the prototype this applies to JS and TS; CSS selectors and HTML ids come later.

### 5.2 Staleness check

Using `git blame --porcelain` per file, a chunk is **possibly stale** when its newest code line is newer than its newest prose line. Uncommitted changes count as newest.

This is a heuristic signal, computed on demand, with nothing stored. Editing the prose (even to confirm it) clears it.

### 5.3 Cross-cutting checks: `prose/` against `@prose`

The point of the project is that cross-cutting docs stay checkable against the code, the same way chunk prose is. A `prose/*.md` file carries no marker, so the link to the code is what it cites. Every check is mechanical, produces warnings only, and generates nothing.

1. **Symbol check on docs.** Inline code spans in a `prose/*.md` file resolve exactly as in §5.1, against the project-wide declaration table: linked to the declaring chunk, or flagged unresolved. Only the "in the chunk's own code" case doesn't apply.
2. **Anchor references.** A doc or an `@prose` block can cite a chunk by its stable path, `[store](src/store.ts#addTodo)` (§6.1). An unresolved path or anchor is a warning. The reverse holds too: an `@prose` block linking to `prose/spec.md#5-checks` is checked against that doc's heading slugs, so renaming a heading breaks loudly.
   **Doc names are derived, never declared.** A doc answers to its path under `prose/` without the extension (`spec`, `feature/recommend`), plus a heading slug for a section (`spec#checks`). There is no frontmatter to keep in sync, so a rename breaks the reference instead of leaving a stale alias. Doc names are their own namespace: a code identifier of the same name is never shadowed, and the doc is reached through the link form or `` `spec$` `` rather than a bare `` `spec` ``. The bare stem works only when it is unique among docs; an ambiguous one is a warning that asks for the longer path.
3. **Section references.** A `§5.2`-style reference resolves against the numbered headings of the doc it names; a missing section is a warning.
4. **Doc staleness.** As §5.2, per paragraph: a doc paragraph is possibly stale when a chunk it references (via 1 or 2) has code newer than the paragraph's own newest line. Editing the paragraph clears it.
5. **Duplication.** A doc paragraph that near-duplicates an `@prose` block (compared by normalized text) is flagged: per-piece explanation belongs next to the code, and `prose/` holds only what spans it (§3.4).

## 6. The dev route: `/__prose/`

A Vite plugin, built on [Devframe](https://devfra.me) (`devframe` + `@devframes/vite`) rather than bespoke server plumbing: Devframe supplies typed RPC (`query`/`action`/`event`), state that stays synced between the node process and the browser, and an MCP adapter for agent access. `prose()` returns two plain Vite plugins from `@devframes/vite/single` — `devframeVitePlugin` (serves the built client SPA) and `devframeViteBridge` (mounts the RPC/WebSocket backend on the same origin) — both mounted directly into the consuming app's own Vite dev server, at `/__prose/` (Devframe's default mount path for a hosted devframe, `/__<id>/`). Neither depends on `@vitejs/devtools`, the official Vite DevTools hub: its dock/terminal/command surface and default trust handshake are more than one developer on one machine needs (§2). Mounting inside it via `@vitejs/devtools-kit`'s `createPluginFromDevframe` is the alternative if Prose ever needs to dock beside other tooling. `devframeViteBridge`'s RPC endpoint gates behind an OTP by default; `prose()` passes `auth: false`, since the dev server's own loopback binding is already the trust boundary for a local, single-developer tool. In `vite build` the plugin's only job is the HTML strip (§6.4).

The route's client is a small prebuilt Svelte 5 SPA (Devframe's `clientAssets`), served by Vite; it connects back over Devframe's RPC, so it can call into dev tools (§7) and read app modules through the same connection.

### 6.1 Navigation

- A left rail shows the tree: project → folders → files. Files are the leaves. Branches are collapsible (deep ones collapsed by default, the path to the open node always revealed), and a `/` palette jumps to any node by fuzzy name or path.
- The breadcrumb links every ancestor. Every node has a copy-link affordance.
- The main pane shows the selected node at its level: its prose, then its children as first-paragraph summaries (§4). At L3 it also shows the diagram. At a file it shows the **whole file in source order**: each prose block rendered where it was written, the highlighted code between them, so nothing is left out. An undocumented file is just its code.
- Every node has a stable URL, and so does every chunk: `/__prose/src/store.ts#addTodo` opens the file and scrolls to that chunk.
- Warnings (§5), pending chunks, and open notes share one badge system on nodes, rolled up to their ancestors, with a hover title saying what kind of thing each count is.
- At L3, above the folder list, a small health panel aggregates what the tree already carries: documentation coverage, warnings and stale chunks, pending share, the symbol-check split, and the files with the least prose per line of code. Nothing in it is generated.
- The view updates live when files change, through Devframe's synced state — no bespoke HMR-websocket wiring.

### 6.2 The annotator: `@note`

A remark is prose about a specific spot, so it lives with the code (§1), not in a separate file with its own anchors. It is a second comment marker, `@note`, written immediately after the `@prose` block it's about — same delimiters, same gutter convention (§3.1), found by adjacency rather than by an anchor:

```js
/** @prose
 * A heading renderer that gives every heading a page-unique id...
 */
/** @note
 * Should this handle non-Latin scripts too?
 */
function headingId(html) { ... }
```

- **No anchor, no orphaning.** A note's position *is* its meaning — it sits right after the block it's about, so there's nothing to resolve and nothing that can silently stop resolving. If the code it's attached to is deleted, the note goes with it; a note about deleted code has nothing left to say.
- **Resolving deletes it.** Nothing is kept once a note is addressed — if the outcome is worth remembering, it belongs in the `@prose` text itself (a decision made permanent), not in a second, disposable log sitting beside it.
- **One open note per block.** Adding a note when one already exists replaces it rather than stacking a second — "does this block have outstanding feedback" stays a yes/no question.
- **"What's open across the project" is a derived view**, not a maintained file: the tree walk that already computes `warningCount` (§5) can collect every `note` the same way, on demand.
- **Every `@prose` block can carry a note, the file prose's included.** On the file page each block has its own add and resolve, next to the prose it is about. A file with no `@prose` block has nowhere to attach one, and folder and project prose (`README.md`) have no comment markers, so notes stop there for now (§10).

There is no prose editor in the view: a block's own prose is edited by hand in the source, like the code around it. The one write affordance the dev route has is add or resolve a note.

### 6.3 API

The server exposes Devframe RPC functions, namespaced under the `prose` devframe id, for the client:

- `tree` (`query`): the full hierarchy, with summaries, warnings, and notes.
- `node` (`query`): one node's prose, code, warnings, and note, given its path. For agents and scripts: the dev route's own client doesn't call it, since the tree it already holds carries every node in full.
- `add-note` (`action`): insert or replace the `@note` on a block, addressed by its path (`src/store.ts#addTodo`, or `src/store.ts#file` for the file prose).
- `resolve-note` (`action`): remove a block's `@note` entirely.

`query` functions are reads that can change over time; `action` functions are the writes. Both are typed end to end by Devframe's RPC layer — no hand-rolled request/response shapes. Every write re-reads and re-parses the target file fresh rather than trusting the client's in-memory tree — the file on disk is the only truth.

### 6.4 Build: strip HTML prose

Vite keeps HTML comments in built pages, so without this step `<!-- @prose -->` blocks would be visible to anyone viewing the page source. In `vite build`, the plugin removes them from `.html` output in a `transformIndexHtml` hook, together with the whitespace line each one leaves behind. Unmarked comments are left alone.

Nothing else needs stripping. Minifiers drop `/** @prose */` from JS and CSS, since they keep only `@license`, `@preserve` and `/*!` comments. The Svelte compiler drops markup comments by default (`preserveComments: false`).

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

- Every file has file prose, and every exported declaration is in a chunk with prose. Folders have a `README.md`.
- Prose goes in `@prose` comments (§3.1). Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append.
- Fill pending chunks as plan items.
- When asked to "handle notes": find every `@note` (`grep -rn "@note"`), address it, and delete it — folding anything worth remembering into the `@prose` block it sat next to.
- Resolve unresolved-symbol and possibly-stale warnings before finishing. The plugin also exposes them as a CLI (`prose check`) for the agent.

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
- [ ] A pending chunk added in the view appears in the source, and the agent fills it after "handle notes."
- [ ] Adding, replacing, and resolving a note via `/__prose/` writes back cleanly (Oxfmt leaves the file unchanged otherwise) and round-trips byte-identical when resolved.
- [ ] Deleting a chunk that has a note deletes the note with it — nothing orphaned to track.
- [ ] The dev tool mounts and shows live store state.
- [ ] Editing a source file updates the open view without a reload.

## 10. Open questions

- **Nested chunks.** Should prose blocks for class members and nested functions become sub-chunks?
- **Summaries beyond first paragraphs.** Use LLM summaries, cached by a hash of the children, only if first paragraphs prove too thin.
- **Live agent channel.** Send a note to a running session directly instead of it waiting to be found by a grep or a "handle notes" request. Devframe ships an MCP adapter (`prose mcp`, once there's a standalone CLI) that could expose tree/node/notes to an agent directly — not wired up in the prototype, which still reaches the agent only through the source files it already reads (§6.2, §8).
- **Notes without a `@prose` block.** An undocumented file, a folder or the project can't take a note, since there is no comment to sit after. Options: a `@note` marker usable on its own at the top of a file, or a comment convention inside `README.md`.
- **Problem-layer tools as plan items.** Could a pending chunk reference a dev tool that shows the options being decided between?
- **Docs in subfolders of `prose/`.** A medium project will want `prose/feature/recommend.md` beside `prose/spec.md`. Derived names already handle it (path under `prose/`), but the tree walker reads only the top level today, and L3 needs a rule for nesting: show `prose/` subfolders as groups, or flatten to path-named sections. Also open: whether a folder's docs should instead sit next to the code as its `README.md` (§3.3), with `prose/` kept for what spans folders.
- **Coarser doc staleness.** Optional `covers: [src/tree.ts, …]` frontmatter, so a doc that describes a module without naming symbols goes stale when any covered file changes after it. Only if §5.3's citation-based checks leave gaps.
- **Plan as pending chunks.** Track remaining work as pending `@prose` chunks in source (a block with no code yet, §3.2) rather than checkboxes in `prose/plan.md`, so "plan and code are one document" holds for this project too.
