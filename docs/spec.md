# Prose

Standard web source files, a light prose convention in their comments, and a dev route that shows the codebase as a navigable, annotatable document.

- The **app** is where the code executes.
- **`/__prose/`** is where prose and code are read, navigated, and given direction.

Repo: [amitkaps/prose](https://github.com/amitkaps/prose) · npm: `@amitkaps/prose` · web: [prose.amitkaps.com](https://prose.amitkaps.com)

## 1. Thesis

**Humans and agents work in divided worlds.** The agent works in text and code at thousands of words a minute; the human reads at a few hundred and reasons spatially and structurally. What passes between them today is thin: walls of Markdown plans, specs, and diffs. (See Maggie Appleton, [Planning with Agents](https://maggieappleton.com/planning-agents).)

**Separate specs and plans drift.** A `spec.md` that sits beside the code has to be kept in sync by hand, and the code can't be reasoned about from it. The intent must live *with* the code, change in the same diff, and be checked where possible.

**The agent writes the code, and most of the prose.** The human doesn't need to read code line by line or write all the prose. The human needs to hold the **mental model of the whole architecture**, and to give direction at any level of it.

**So we need different dev tools, in two layers:**

| Layer   | Shows                                  | Tool                                                   |
| ------- | -------------------------------------- | ------------------------------------------------------ |
| Problem | the parameters of what's being solved  | problem-specific dev tools, written by the agent (§7)  |
| Code    | what was built and why, at every level | the Prose view: hierarchical prose + code (§4–§6)  |

**Plan and code are one document.** A prose block with no code under it yet is a plan item. Planning = writing prose at some level; building = the agent filling the code in; reviewing = reading the view and leaving remarks. There is no separate plan file to drift.

**Standard files, not a toolchain.** Adopting a new file type or compiler is expensive even for one person, and breaks `tsc`, the language server, oxlint, oxfmt, vite, and every other standard workflow. Prose is a convention (like JSDoc) plus a Vite plugin that is dev-only apart from one step: stripping `@prose` comments from HTML output (§6.5). JS, CSS and Svelte build output is untouched.

## 2. Scope of the prototype

| In                                                                      | Out                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `.ts`, `.js`, `.css`, `.html`, `.svelte` with prose in comments         | New file types, tangling, `.ts.md`                   |
| Folder `README.md` as folder prose                                      | A published documentation site                       |
| `/__prose/` dev route: navigation, woven view, import-graph diagram | Editing *code* in the view                           |
| Symbol check and staleness check                                        | LLM-generated summaries (first paragraphs are used) |
| Prose editor and `.prose/remarks.md`                                 | Live channel from the view to an agent session       |
| Mounting agent-written dev tools                                        | Anything in production builds                        |

Target: small apps, audience of one.

## 3. The convention

### 3.1 Prose blocks

A **prose block** is a comment whose first token is the **`@prose`** marker. The same rule applies in every language:

| Language      | Prose block                         |
| ------------- | ----------------------------------- |
| JS, TS, CSS   | `/** @prose … */` at top level      |
| HTML, markup  | `<!-- @prose … -->`                 |

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
- **Every other comment is a code comment**, including unmarked `/** */` JSDoc, `//`, `/* */`, and unmarked `<!-- -->`. So API docs like `/** @param x */`, `// TODO`, and tool pragmas like `<!-- svelte-ignore … -->` are never read as prose.
- The marker is opt-in because comments already have many owners: JSDoc, Vite, Svelte, formatters, and linters. Adding a marker is also the explicit step of promoting a comment to prose (§9.2).
- In JS, TS and CSS, prose blocks inside function, class, or rule bodies are ignored in the prototype.
- TypeScript treats `@prose` as a JSDoc tag, so an editor hover shows the prose as that tag's text. It's readable, if slightly noisy.

In `.svelte` files, each part follows its own language's rule: `<script>` follows the JS/TS rule, the markup follows the HTML rule, and `<style>` follows the CSS rule. The chunks from all three parts are merged in source order. The file prose is the first prose block in any of the parts.

A `.md` file that isn't a `README.md` (for example, site content) is shown as a prose-only document node. It has no chunks.

### 3.2 Chunks

Within a file:

1. The **first prose block** is the **file prose** (L1).
2. Code before any later prose block (typically imports) is the **preamble**. It is shown collapsed.
3. Each later prose block, together with the code that follows it up to the next prose block, is a **chunk** (L0).
4. A prose block whose first line is a Markdown heading (`# Filtering`) also starts a **section**. The section holds the chunks that follow it until the next heading block. The heading block itself is still a chunk.
5. A chunk whose code is empty (only whitespace before the next prose block or end of file) is **pending**. That is a plan item (§1).

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

The last block is a pending chunk: the section exists as a plan, with no code yet.

### 3.3 Folders and project

- A folder's `README.md` is its **folder prose** (L2).
- The root `README.md` is the **project prose** (L3).

These are ordinary READMEs; GitHub already renders them.

## 4. Hierarchy

| Level | Unit    | Prose from           | Structure from                          |
| ----- | ------- | -------------------- | --------------------------------------- |
| L3    | project | root `README.md`     | folder tree + import-graph diagram      |
| L2    | folder  | folder `README.md`   | files and subfolders                    |
| L1    | file    | file prose block     | sections and chunks                     |
| L0    | chunk   | its prose block      | its code                                |

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

## 6. The dev route: `/__prose/`

A Vite plugin, built on [Devframe](https://devfra.me) (`devframe` + `@vitejs/devtools-kit`) rather than bespoke server plumbing: Devframe supplies typed RPC (`query`/`action`/`event`), state that stays synced between the node process and the browser, and an MCP adapter for agent access. `prose()` mounts a devframe (`id: "prose"`) into `@vitejs/devtools`, the official Vite DevTools hub, which is why `vite.config.ts` needs both `@vitejs/devtools` and `@amitkaps/prose` in its plugin list — `prose()` brings both in for the app, so one entry is enough. In `vite dev` this serves one route, at `/__prose/` (Devframe's default mount path for a hosted devframe, `/__<id>/`). In `vite build` its only job is the HTML strip (§6.5).

The route's client is a small prebuilt SPA (Devframe's `clientAssets`), served by Vite; it connects back over Devframe's RPC, so it can call into dev tools (§7) and read app modules through the same connection.

### 6.1 Navigation

- A left rail shows the tree: project → folders → files → sections → chunks.
- The main pane shows the selected node at its level: its prose, then its children as first-paragraph summaries (§4). At L3 it also shows the diagram; at L0 it shows the code, syntax-highlighted.
- Every node has a stable URL (`/__prose/src/store.ts#addTodo`), so levels can be linked to.
- Warnings (§5), pending chunks, and open remarks show as badges on nodes and roll up to their ancestors.
- The view updates live when files change, through Devframe's synced state — no bespoke HMR-websocket wiring.

### 6.2 Prose editor

Any prose (chunk, section, file, folder, project) can be edited in place in a plain Markdown editor with a preview.

On save:

1. The server writes the text back into the source comment. It keeps the `@prose` marker, re-adds the ` * ` prefixes, and keeps the original indentation. For READMEs it writes the file.
2. It appends a remark of kind `prose-edit` to `remarks.md` (§6.3). That tells the agent the change is a direction, so it reconciles the code.

Adding a new pending chunk or section (a new prose block after a given chunk) goes through the same path.

### 6.3 Remarks

Remarks are questions or directions to the agent, attached to any node. They live in `.prose/remarks.md`, which is committed:

```markdown
## src/store.ts#addTodo

- [ ] 2026-09-23 · Should duplicate text be rejected?
  - agent: Yes, now rejected case-insensitively. See `addTodo`.
- [x] 2026-09-22 · prose-edit · Reconcile code with updated prose.
```

- **Anchors** are `path`, `path#section-slug`, or `path#symbol`. `symbol` is the first identifier declared in the chunk; a pending chunk uses its section slug plus `-chunk-N`. Anchors avoid line numbers so they survive edits.
- `- [ ]` is open and `- [x]` is resolved. Replies are nested bullets.
- A remark whose anchor no longer resolves is shown as **orphaned** at the nearest surviving ancestor.
- In the prototype, remarks reach the agent only through this file (§8).

### 6.4 API

The server exposes Devframe RPC functions, namespaced under the `prose` devframe id, for the client:

- `tree` (`query`): the full hierarchy, with summaries and badges.
- `node` (`query`): one node's prose, code, and warnings, given its path.
- `save-prose` (`action`): save a prose edit.
- `add-remark` and `resolve-remark` (`action`): add a remark, or resolve one.

`query` functions are reads that can change over time; `action` functions are the writes. Both are typed end to end by Devframe's RPC layer — no hand-rolled request/response shapes.

### 6.5 Build: strip HTML prose

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
- When asked to "handle remarks": work through the open items in `.prose/remarks.md`, reply as nested bullets, and tick them off. `prose-edit` remarks mean the prose is the direction; change the code to match it.
- Resolve unresolved-symbol and possibly-stale warnings before finishing. The plugin also exposes them as a CLI (`prose check`) for the agent.

## 9. Prototype test cases

### 9.1 `examples/single`: the smallest case

[`examples/single/`](../examples/single/) is a counter on one static page: `index.html`, `style.css`, `main.js` and a `README.md`. Plain Vite is its only dev dependency; there are no runtime dependencies and no framework. It is written to the convention from the start:

- file prose in all three files;
- sections (`# State`, `# Input`, …) in the CSS and JS;
- chunk prose that mentions `count`, `render` and `data-step`, for the symbol check;
- one pending chunk, `# Persistence` at the end of `main.js`, as a plan item.

Build it first. It exercises the parser, navigation, both checks and the editor without SvelteKit in the way.

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
- [ ] `/__prose/` shows L3 → L0 navigation, with first-paragraph summaries at each level.
- [ ] The import-graph diagram matches the actual imports.
- [ ] The symbol check resolves, links, and flags as §5.1 describes, including a deliberately wrong symbol.
- [ ] The staleness check flags a chunk after a code-only commit, and clears after a prose edit.
- [ ] A pending chunk added in the view appears in the source, and the agent fills it after "handle remarks."
- [ ] A prose edit writes back cleanly (Prettier leaves the file unchanged) and creates a `prose-edit` remark.
- [ ] A remark survives the agent rewriting its chunk. Deleting the chunk makes the remark orphaned, not lost.
- [ ] The dev tool mounts and shows live store state.
- [ ] Editing a source file updates the open view without a reload.

## 10. Open questions

- **Nested chunks.** Should prose blocks for class members and nested functions become sub-chunks?
- **Summaries beyond first paragraphs.** Use LLM summaries, cached by a hash of the children, only if first paragraphs prove too thin.
- **Live agent channel.** Send remarks to a running session instead of going through `remarks.md`. Devframe ships an MCP adapter (`prose mcp`, once there's a standalone CLI) that could expose remarks/tree/node to an agent directly — not wired up in the prototype, which still reaches the agent only through `remarks.md` (§6.3, §8).
- **Problem-layer tools as plan items.** Could a pending chunk reference a dev tool that shows the options being decided between?
