# Lessons

What building and using prose taught. The first half is what use taught about what to build and what to leave out. The second half is bug classes from the code, for the next change.

## What use taught

Besides this repository, prose has been used on two projects. sitez is a static site generator with 49 commits, and markz is a Markdown parser of about 4,600 lines. Their agents each wrote a report on 2026-09-30, and the human's own use matched them. Prose was larger then, with a dev route inside the app, notes in the source and mechanical checks. Most of these lessons are about which of those parts got used.

### What gets read

- **Build the smallest thing that gets read, and watch whether it is.** The `/__prose/` route, its annotator and the planned *since* view were most of the work then. The human rarely opened the route. They read the `prose/` docs in the editor, and `@prose` blocks once in a while. When an agent changes code quickly, the reader wants Markdown where they already look. Before building the next view, ask what the human actually opened last week.
- **Tools inside the app went the same way.** A Vite plugin stripped `@prose` from built HTML, but only hand-written `.html` needs that ([writing](writing.md#in-each-language)). Agent-written dev tools and an import-graph diagram were planned but never built, because nothing asked for them.
- **The renderer earned its place as user documentation.** Its published pages are the docs for this repository and for markz. The same files serve the human reading the design and a user learning the tool, with nothing written twice.
- **First paragraphs are a map for finding, not a substitute for reading.** Grepping 89 `@prose` summaries finds the right file faster than reading code. Agents still read the whole file once they find it. Writing prose also caught gaps. Stating "plain-JS scripts are checked too" led to checking it, and then to a test.

### Where decisions live

- **Discussion happens in the chat, not in annotations.** A decision took several turns of conversation, and the agent then rewrote `spec.md` or `plan.md`. `@note` never became the channel. sitez had one note open for weeks (`src/site.ts`), and markz had none. markz's cross-file questions went into `prose/` docs instead. A channel the human has to go and look at loses to the one they're already in.
- **The short promises doc paid off most.** sitez's `prose/idea.md` settled design questions from what the project promises. For example, sitez has no configuration, so a layer can't be switched off, only overridden. Its "Not in v1" list pushed features to other projects. It works because it's short enough to hold in mind.
- **A rule stated in three places drifts in the untested ones.** markz explains its syntax in `syntax.md`, states it in the tested `grammar.md`, and restated it in `@prose`. One `@prose` block already disagreed with `AGENTS.md` about where origins live. Link to the owner, and keep only the how and why ([writing](writing.md#links)).

### Keeping prose true

- **The checks never ran.** markz's `AGENTS.md` says "nothing checks prose against code on its own", and its agents grep instead. The one real drift was that block about origins. It was about meaning, which no symbol or staleness check sees. So prose kept the reading, the convention and a renderer, and dropped the checks ([design](design.md#what-it-isnt)).
- **The prose costs a second edit per change and drifts toward density.** 36 of sitez's 49 commits touch `prose/`. Blocks grew into long sentences carrying three qualifications each, since "rewrite, don't append" is harder than it sounds. The three-line limit on first paragraphs came from this. It wasn't enough, because the docs kept packing points into long sentences. So the rules later asked for plain sentences too ([the agent rules](usage.md#for-agents)).
- **Tuning changes rightly skip prose, and staleness can't tell.** markz's speed commits changed code without prose, which was correct. But a speed change that alters a cost the prose states would slip through the same way.

### Publishing

- **Publishing belongs to a site generator.** markz's site renders its `prose/` docs in place as its pages, and sitez generalizes that, so a folder of Markdown is a site. It works because the docs link by repo path. They were also rewritten into neutral, current prose (markz #62), not left as a record of the conversation. So prose doesn't publish. It keeps the same files readable locally ([writing](writing.md#folders-and-docs)).
- **A command to publish wasn't needed either.** `prose publish` committed a built site to a branch. The one site that could have used it deploys from `main` with a Cloudflare Worker instead ([usage](usage.md#deploying-this-site)).
- **Each host keeps its own files.** The build has no `CNAME`, `.nojekyll` or other host config. Each host changes its files, credentials and rules on its own schedule, so a project keeps its host's config in its own repository.

## What the code taught

These were found by dogfooding on prose's own source and on real repositories. Real code has more variety than a curated fixture.

### The parser and scanner

- **A `@prose` block inside a callback or object literal is silently dropped.** In `register({ setup(ctx) { /** @prose */ } })` the block is at depth 2, not 0. At first only depth 0 counted. Now a block counts at any depth when it starts its own line ([writing](writing.md#in-each-language)). One that shares its line with code is still an ordinary comment.
- **A tokenizer that handles strings and comments but not regex literals is one construct from silent corruption.** In `.replace(/\`/g, "")`, the backtick read as a template-literal opener. It "closed" at the next backtick in the file and broke `{}` depth for everything after. There was no error, and comments just stopped being found. `scanJsLike` now has `skipRegexLiteral`, which guesses from the last significant token. It still misreads `return /x/` as division, a documented limitation.
- **A scanner with no closing delimiter must let the marker define the boundary.** YAML and TOML use `#` comments. The scanner collected every contiguous `#` line and checked only the first for a marker, so it merged two back-to-back `@prose` blocks. A block now runs from a marker line to the next marker line or the first non-`#` line. Ask "what happens when two blocks touch", not just "what happens at the end". Writing that test case directly caught it.
- **Don't reimplement scope analysis with regexes.** `declaredIdentifiers` grew one construct per bug report. Imports came first (`marked`), then parameters (`html` in `headingId(html: string)`). No flat regex can find a parameter inside nested parens and braces, and destructuring and class members were still pending. The fix was structural. It parses with `oxc-parser`, the engine oxlint, oxfmt and tsdown already use, and walks the AST.
- **A tolerant parser matters when one path serves several languages.** On CSS, `oxc-parser` returns an empty `program.body` and `errors`, and doesn't throw. A real snippet confirmed it. `codeLang` per chunk gates the parse anyway, since a `.svelte` file's `<script>` and `<style>` share the comment-scanning path.
- **Property tests found a CRLF bug that no example had.** The parser kept the `\r` of a CRLF line inside comment text. The `#`-style scanner's `endIndex` sat between `\r` and `\n`. So an edit at that offset in a CRLF YAML or TOML file would have split a line ending. Fixture variants (LF, CRLF, no final newline) cost one line each in the generator.

### The file as the leaf

- **A chunk shown alone doesn't make sense.** So the tree stops at files, and blocks hang off the file node (`blocks`, each with its comment's byte `span`). The page lays the source out around those spans. It drops the comment text and renders it as prose in its place, which shows the whole file with nothing repeated. Exact offsets beat line ranges here. The `.svelte` part-clipping had already shown that per-chunk code slices lose the tags between parts.

### Anchors and addresses

- **An address built from position isn't stable, whatever the spec calls it.** The spec promised `#addTodo`, but the code produced `top-chunk-2`, which moves when a block is inserted above. Derive anchors from content ([writing](writing.md#links)).

### Rendering

- **A global `code { padding }` rule for inline spans also hit shiki's `<pre><code>`.** It added a stray space before every block's first token. Copied text came out clean, since padding is box model, not content. A `pre code` reset fixes it.
- **Import shiki through `shiki/core`, not the main entry.** The main `codeToHtml` resolves `lang` by name at runtime, so a bundler keeps every grammar. Explicit language imports and `createHighlighterCore` keep the bundle to what's used.
- **`oxlint`'s type-aware mode (`tsgolint`) is the type check** for `.ts`, not a separate `tsc --noEmit`. It caught a real `no-floating-promises` at once.

### Working style

- **Read the installed `.d.ts` files, not a summarized doc fetch.** `WebFetch` ran pages through a smaller model that lost specifics. It dropped concrete examples and a caveat that changed the cost of adopting a library. Install into a scratch directory and grep `dist/*.d.ts`.
