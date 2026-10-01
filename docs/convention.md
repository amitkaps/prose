# The convention

A comment whose first token is `@prose` is the maintained explanation of the code that follows it. Everything else stays an ordinary code comment. This page is the whole convention: the marker, how a file divides into blocks and chunks, where writing that spans the code goes, and how to link to it. The reasons are in [design.md](design.md).

## Prose blocks

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

## Blocks and chunks

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

## Anchors

Each block has an anchor, used as the fragment of its URL in the renderer (`src/store.ts#addTodo`) and in links from other prose. It's derived from content, so it names the same block after unrelated edits elsewhere in the file:

1. The file prose is `file`.
2. Otherwise, the slug of the block's heading, when it opens with one: `filtering` for the pending chunk above. The heading is what a reader sees, so it names the block before the code does.
3. Otherwise, the first name the chunk's code declares: `addTodo`, `toggleTodo`; for a block inside a class or function, the first member or declaration below it: `metadata`. (JS and TS.)
4. Otherwise, a positional fallback (`chunk-3`), the only kind that moves when blocks are inserted above it.

A repeated anchor within a file gets a `-2`, `-3` suffix in source order.

## What to write

Prose is for what the code can't say: why this exists, what it promises, what was decided and what was ruled out, what a reader would likely get wrong. The first three lines are the summary, what the file or block means. Anything longer goes below, for the reader who wants it.

It isn't a retelling of the code. A paragraph that says what a function does, line by line, is already in the code, will drift from it, and costs the reader attention for nothing. And it isn't a substitute for ordinary comments: `//` and JSDoc stay for the reader of one line (why this check, what this edge case is), where prose is for the reader of the file.

## Folders and project

A folder's `README.md` is its prose, and the root `README.md` is the project's. These are ordinary READMEs; GitHub already renders them.

## Writing that spans the code

Some writing has no natural home in one comment or one README: what the project promises, architecture that spans files, the order of the work, lessons learned building it. The convention suggests a root `docs/` folder of Markdown files for it:

```text
docs/
  idea.md
  plan.md
  lessons.md
```

- **Keep one short promises doc.** `idea.md`, `spec.md`, whatever the project calls it: what the project promises and what it leaves out ("not in v1"). In use it was the most valuable file: decisions could be argued from it, and its non-goals stopped scope creep. It pays off because it's short enough to hold in mind.
- **Decisions land in the prose.** A decision reached in the chat that spans files goes into the doc it changes, in the same change as the code ([the agent rules](usage.md#for-agents)). One that concerns a single spot goes into that spot's `@prose`.
- **`docs/` is a suggestion, not a mechanism.** The renderer treats it as an ordinary folder of Markdown ([spec](spec.md#pages)). Because it's plain Markdown linked by repo path, a static site generator can publish it as it is; what gets published, and how internal docs like `plan.md` stay off a site, is that tool's concern.

## References

A reference is an ordinary relative Markdown link, so it reads and clicks the same on GitHub, in the editor's preview, in the renderer, and on a site that publishes `docs/`:

```text
src/session.ts                     a file
src/session.ts#createSession       a block in it, by its anchor
docs/architecture.md               a doc
docs/architecture.md#sessions      a section of it, by heading slug
```

**State a rule once, and link to it.** When a doc or a tested file owns a rule (a grammar, a schema, a contract), a `@prose` block links to it and keeps only how and why this code does it. Restating the rule in several places means only one copy is tested, and the others drift.
