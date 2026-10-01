# Lessons

What building `@amitkaps/prose` taught, for the next change: gotchas and bug classes, each with symptom, cause, fix and how to detect it. [design.md](design.md) says why it is the shape it is, [plan.md](plan.md) what's left.

0.1.0 was a larger tool (a Devframe route, a Svelte client, notes, mechanical checks) and its lessons about that code are gone from this file; `git log -- docs/lessons.md` has them. What stays are the findings from field use and the bug classes that carry to the parser and the renderer.

## Field use: what got used (2026-09-30)

0.1.0 was used on two more projects, sitez (a static site generator, 49 commits) and markz (a Markdown parser, about 4,600 lines). The agents on each wrote a report, and the human's own use matched them.

- **Build the smallest thing that gets read, and watch whether it is.** The `/__prose/` route, its annotator and the planned *since* view were most of 0.1.0's work. The human rarely opened the route: the `prose/` docs were read in the editor, and `@prose` blocks once in a while. When an agent changes code quickly, the reader wants Markdown where they already look. Detect it early by asking what the human actually opened last week, before building the next view.
- **Discussion happens in the chat, not in annotations.** A decision took several turns of conversation, and the agent then rewrote `spec.md` or `plan.md`. `@note` never became the channel: sitez has one note open for weeks (`src/site.ts`), markz has none, and markz's cross-file questions went into `prose/` docs instead. A channel the human has to go and look at loses to the one they're already in.
- **The short promises doc paid off most.** sitez's `prose/idea.md` let design questions be settled from what the project promises (no configuration, so a layer can't be switched off, only overridden), and its "Not in v1" list pushed features to other projects. It works because it's short enough to hold in mind.
- **`prose/` became the published docs, and publishing belongs to sitez.** markz's site renders its `prose/` docs in place as its pages, and sitez generalizes that: a `prose/` folder of Markdown is a site. It works because the docs link by repo path and were rewritten into neutral, current prose (markz #62) rather than left as a record of the conversation. So Prose doesn't publish; it keeps the same files readable locally ([convention](convention.md#writing-that-spans-the-code)).
- **The checks never ran.** markz's `AGENTS.md` says "nothing checks prose against code on its own", and the one real drift (a block naming origins that `AGENTS.md` places elsewhere) was about meaning, which no symbol or staleness check sees. Agents grep instead. What was kept is the reading: the convention and a renderer ([design](design.md#whats-out-and-why)).
- **First paragraphs are a map for finding, not a substitute for reading.** Grepping 89 `@prose` summaries finds the right file faster than reading code. Agents still read the whole file once there. Writing the prose also caught gaps: stating "plain-JS scripts are checked too" led to checking it, and then to a test.
- **The prose costs a second edit per change and drifts toward density.** 36 of sitez's 49 commits touch `prose/`. Blocks grew into long sentences carrying three qualifications each ("rewrite, don't append" is harder than it sounds). Hence the three-line limit on first paragraphs ([the agent rules](usage.md#for-agents)).
- **A rule stated in three places drifts in the untested ones.** markz explains its syntax in `syntax.md`, states it in the tested `grammar.md`, and restated it in `@prose`. One `@prose` block already disagreed with `AGENTS.md` about where origins live. Link to the owner and keep only the how and why ([convention](convention.md#references)).
- **Tuning changes rightly skip prose, and staleness can't tell.** markz's speed commits changed code without prose, which was correct, but a speed change that alters a cost the prose states would slip through the same way.

## The parser and scanner

Found by dogfooding on the package's own source and on real repositories. Real code has more variety than a curated fixture.

- **A `@prose` block inside a callback or object literal is silently dropped.** `register({ setup(ctx) { /** @prose */ } })` is at depth 2, not 0. Before 0.2.0 only depth 0 counted; now a block counts at any depth when it starts its own line ([convention](convention.md#prose-blocks)), but one that shares its line with code is still an ordinary comment.
- **A tokenizer that handles strings and comments but not regex literals is one construct from silent corruption.** `.replace(/\`/g, "")` read the backtick as a template-literal opener, which "closed" at the next backtick in the file and broke `{}` depth for everything after. No error, comments just stopped being found. `scanJsLike` now has `skipRegexLiteral` (the last-significant-token heuristic); `return /x/` is still misread as division, a documented limitation.
- **A scanner with no closing delimiter must let the marker define the boundary.** YAML/TOML `#` comments: collecting every contiguous `#` line and checking only the first for a marker merged two back-to-back `@prose` blocks. A block now runs from a marker line to the next marker line or the first non-`#` line. Ask "what happens when two blocks touch," not just "what happens at the end." Caught by writing that test case directly.
- **Don't reimplement scope analysis with regexes.** `declaredIdentifiers` grew one construct per bug report: imports (`marked`), then parameters (`html` in `headingId(html: string)`, whose nested parens and braces no flat regex can find), with destructuring and class members still pending. The fix was structural: parse with `oxc-parser` (the engine oxlint, oxfmt and tsdown already use) and walk the AST.
- **A tolerant parser matters when one path serves several languages.** `oxc-parser` on CSS returns an empty `program.body` plus `errors`, no throw (checked with a real snippet). `codeLang` per chunk gates the parse anyway, since a `.svelte` file's `<script>` and `<style>` share the comment-scanning path.
- **Property tests found a CRLF bug that no example had.** The parser kept the `\r` of a CRLF line inside comment text, and the `#`-style scanner's `endIndex` sat between `\r` and `\n`, so an edit at that offset in a CRLF YAML/TOML file would have split a line ending. Fixture variants (LF, CRLF, no final newline) cost one line each in the generator.

## The file as the leaf

- **A chunk shown alone doesn't make sense**, so the tree stops at files and blocks hang off the file node (`blocks`, each with its comment's byte `span`). The page lays the source out around those spans, dropping the comment text and rendering it as prose in its place, which shows the whole file with nothing repeated. Exact offsets beat line ranges here; the `.svelte` part-clipping had already shown that per-chunk code slices lose the tags between parts.

## Anchors and addresses

- **An address built from position isn't stable, whatever the spec calls it.** The spec promised `#addTodo`; the code produced `top-chunk-2`, which moves when a block is inserted above. Derive anchors from content ([convention](convention.md#anchors)).

## Rendering

- **A global `code { padding }` rule for inline spans also hit shiki's `<pre><code>`,** adding a stray space before every block's first token. Copying the text came out clean, since padding is box model, not content. Fix with a `pre code` reset.
- **Import shiki through `shiki/core`, not the main entry.** The main `codeToHtml` resolves `lang` by name at runtime, so a bundler keeps every grammar. Explicit language imports and `createHighlighterCore` keep the bundle to what's used.
- **`oxlint`'s type-aware mode (`tsgolint`) is the type check** for `.ts`, not a separate `tsc --noEmit`; it caught a real `no-floating-promises` at once.

## Working style

- **Read the installed `.d.ts` files, not a summarized doc fetch.** `WebFetch` ran pages through a smaller model that lost specifics (it dropped concrete examples and a caveat that changed the cost of adopting a library). Install into a scratch directory and grep `dist/*.d.ts`.
