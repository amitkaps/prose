# Writing `@prose`

A `@prose` comment explains the code around it, for a human, in Markdown. The first one in a file is that file's summary. Every other comment stays an ordinary comment.

## A prose comment

```ts
/** @prose
 * # Todo store
 *
 * Holds the list in memory and saves it to `localStorage` after every change.
 */
import { save, load } from "./persist";

/** @prose
 * # Adding
 *
 * Empty text is ignored, so the list never shows a blank row.
 */
export function addTodo(text: string) {
  /* … */
}
```

That is the whole convention:

- **The first `@prose` in a file is its summary.** Its first paragraph is what a folder's page shows beside the file's name.
- **Later ones explain what follows them.** Put one wherever a reader needs it. There's no fixed shape, and not every function needs one.
- **A comment that opens a part of the file starts with a heading.** The heading gives it a [link](#links) and a place in the page's contents. A short note on one declaration can go without.
- **A heading in a later comment shows one level down.** Write `#` for a part of the file, and the file's own title stays the page's only top-level heading. Write `##` only for a part inside the comment before it. `prose check` warns about a heading that skips a level.
- **`@prose` and the closing delimiter each sit on their own line.** Never write `/** @prose text */` on one line, and `prose check` warns about it. `@prose` may also sit on the line after `/**`, as JSDoc formatting writes a tag, but `/** @prose` is the house style. Formatters then re-indent the comment as they do JSDoc. A Markdown bullet that starts with `*` also can't be mistaken for the comment's gutter.

The renderer shows the whole file as one page, with each comment's prose in place and the code around it. A file is the smallest unit, because code shown on its own loses its imports and its neighbours.

## What to write

Prose is for what the code can't say. That's why the code exists, what it promises, what was decided and what was ruled out, and what a reader would likely get wrong. The first paragraph says what the file or section means, in about three lines. Anything longer goes below it, for the reader who wants it.

Prose isn't a retelling of the code. A paragraph that walks through a function line by line is already in the code. It will drift from the code, and it costs the reader attention for nothing. Prose doesn't replace ordinary comments either. `//` and JSDoc stay for the reader of one line, like why this check exists or what this edge case is. Prose is for the reader of the file.

Write it plainly. Told to be short, an agent compresses instead of cutting. It keeps every point and packs them into fewer sentences. The [agent rules](usage.md#for-agents) ask for the opposite, with one idea per sentence, about 25 words at most, and one term for each concept. They borrow these from ASD-STE100, a controlled English for technical manuals, but not its fixed dictionary. Rationale needs words like "because" and "unless", and a dictionary needs a checker.

## Folders and docs

A folder's `README.md` is its prose, and the root `README.md` is the project's. These are ordinary READMEs, which GitHub already renders. Leave `.github/` without one, because GitHub would show it in place of the root's README.

Writing that spans files, like what the project promises or the plan, goes in Markdown files. prose suggests no names or layout for them. A `docs/` folder at the root gets one extra. The bar on every page links its docs, in the order a `nav: [design.md, usage.md]` list in `docs/README.md`'s metadata gives ([src/nav.ts](../src/nav.ts)). `prose build` warns about a name in the list that isn't a doc there. Without that list, the bar links every doc in the folder.

The docs are plain Markdown linked by repo path, so a static site generator can publish them as they are. What gets published is that tool's concern.

## Links

A link is an ordinary relative Markdown link. It reads and clicks the same on GitHub, in the editor's preview, in the renderer, and on a site that publishes the docs.

```text
src/session.ts                  a file
src/session.ts#sessions         a prose comment in it, by its heading
docs/architecture.md            a doc
docs/architecture.md#sessions   a section of it, by its heading
```

A prose comment's link is its first heading's id, made the way GitHub makes one for a doc. A second `# Adding` in the same file becomes `#adding-1`. A comment without a heading has no link. In the renderer, the `#` in the margin beside the heading gives it. On GitHub, a link to a comment lands at the top of the file, since GitHub scrolls a source file only to a line. That's accepted, because nothing in a comment can change it.

**State a rule once, and link to it.** When a doc or a tested file owns a rule, like a grammar, a schema or a contract, a prose comment links to it. It keeps only how and why this code follows the rule. A rule restated in several places is tested in only one of them, and the other copies drift.

## A tool's rules

A tool whose users follow rules states them in its docs, like prose's [agent rules](usage.md#for-agents), markz's [rules](https://markz.amitkaps.com/docs/usage.md#for-agents) and craftz's [rules](https://craftz.amitkaps.com/docs/rules.md). Each rule is worded once, and a test holds the code to it. So a rule can't be stated without its check, and a check can't run without its rule.

- A rule says what to write. It's a list item that opens with its id as a span, like ``[`metadata-block`]{#metadata-block}:`` or `[**Name.**]{#id}`, under a heading for its group.
- A code says what a check found. It's a table row that opens with its id as a span, with when it's given, what to write instead, and a link to the rule it serves. Its table's heading gives its level, a warning or a note.
- A link to a rule or a code uses its id, like `usage.md#no-readme`, so `broken-anchor` checks it. In the renderer the link lands on it. On GitHub it lands at the top of the page, and the span shows as written.

The tool reads both with markz's [`rules`](https://markz.amitkaps.com/docs/reference.md#rules), so no repository keeps its own pattern. `<tool> rules` prints them, after the rules of what the tool builds on, and `<tool> rules <id>` prints one. `<tool> check` prints each finding in markz's line, like `prose: warning: docs/x.md:3:5: no-readme: …; write …`.

**Write an id for what others name.** A rule, a code or a claim that other places link to is stated once, as a span with an id ([written ids](usage.md#written-ids)). An id is written out, in lowercase kebab case, like `no-readme`, and can't hold a dot. A heading's id changes when its words do, but a written id survives a reword, and it marks which text is the claim. An id is stated on one page of a repository, since `<tool> rules <id>` finds it without its page, and `prose check` warns on one stated twice.

## In each language

This is reference, for when something surprises you. The rule is the same everywhere. A prose comment's first word is `@prose`, and the comment starts its own line, at any depth. So a class can read method by method. A comment that shares its line with code, like `call(/** @prose … */ x)`, is an ordinary comment.

| Language                                   | Prose comment                     |
| ------------------------------------------ | --------------------------------- |
| JS, TS, CSS                                | `/** @prose … */`                 |
| HTML, markup                               | `<!-- @prose … -->`               |
| YAML, TOML, `.gitignore`, `.gitattributes` | `# @prose …`, with one `#` a line |

- **The body is Markdown**, in [markz](https://github.com/amitkaps/markz)'s dialect. That's everyday GFM with a few cuts, listed in its [syntax](https://markz.amitkaps.com/docs/syntax.md). Two catch people. Emphasis is `_x_`, and `*x*` stays as written. Raw HTML stays as text too. A comment that uses a cut form shows it on the page as written.
- **JS, TS and CSS.** The body is everything after `@prose`, with each line's leading `*` stripped. A `*/` in the body would end the comment, so write `*\/`, and it shows as `*/`. TypeScript treats `@prose` as a JSDoc tag, so an editor's hover shows the prose as that tag's text.
- **YAML, TOML, `.gitignore` and `.gitattributes`.** These have no block comment. A prose comment is a run of `#` lines that starts with `# @prose`, with each line's `# ` stripped. It ends at the first line that isn't a comment, or at the next `# @prose`.
- **Not shell or Python.** Neither is used in the projects prose reads, and Python's docstrings and indentation would need rules nobody tests. A shell file shows as highlighted text, and a Python file as plain text.
- **HTML and Svelte.** Each part follows its own language. `<script>` follows JS or TS, the markup follows HTML, and `<style>` follows CSS. Prose from all three parts reads in source order. So an element's file can keep the why of a build helper in its template's `<script>`, and of a selector in its `<style>`.

**Why a marker.** Comments already have many owners, like JSDoc, Vite, Svelte, formatters and linters. Every comment without the marker stays theirs, including unmarked `/** */`, `//`, `/* */` and `<!-- -->`. So `/** @param x */`, `// TODO` and `<!-- svelte-ignore … -->` are never read as prose. Adding the marker is the explicit step that makes a comment prose.

**What ships.** A library's type declarations (`.d.ts`) keep the doc comment directly above each exported declaration, `@prose` included, and drop the rest. So a `@prose` on an export is that API's documentation in the package, and its first paragraph is what an editor shows on hover. Write it as what the API promises. Give every export a comment, even one line, and put a section's comment where it describes the declaration under it, or it ships as the wrong one's documentation.

Minifiers drop `/** @prose */` from JS and CSS, since they keep only `@license`, `@preserve` and `/*!` comments. The Svelte compiler drops markup comments. A hand-written `.html` file served as it is keeps its comments, so its `<!-- @prose -->` shows in the page source. Keep prose out of shipped `.html`, or strip it in the build. Sourcemaps with `sourcesContent` carry every comment too.
