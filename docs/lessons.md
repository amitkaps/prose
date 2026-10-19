# Lessons

What building and using prose taught. The first half is what use taught about what to build and what to leave out. The second half is bug classes from the code, for the next change.

## What use taught

Besides this repository, prose has been used on markz, sitez, ship, pagez and base. The first lessons came from reports that sitez's and markz's agents wrote on 2026-09-30. Prose was a larger tool then, with a dev route inside the app, notes in the source and checks against the code. Later lessons came from running `prose check` and `prose style` across all of them.

### What gets read

- **Build the smallest thing that gets read, and watch whether it is.** The first version's `/__prose/` route, its annotator and a planned _since_ view were most of its work, and the human rarely opened them. They read the docs in the editor, and `@prose` blocks once in a while. A Vite plugin and planned dev tools went the same way. Before building the next view, ask what the human actually opened last week.
- **The renderer earned its place as user documentation.** Its published pages are the docs for this repository and for markz. The same files serve the human reading the design and a user learning the tool, with nothing written twice.
- **First paragraphs are a map for finding, not a substitute for reading.** Grepping 89 `@prose` summaries finds the right file faster than reading code. Agents still read the whole file once they find it. Writing prose also caught gaps. Stating "plain-JS scripts are checked too" led to checking it, and then to a test.

### Where decisions live

- **Discussion happens in the chat, not in annotations.** A decision takes several turns of conversation, and the agent then rewrites a doc or the plan. `@note` never became the channel. sitez had one note open for weeks, and markz had none. A channel the human has to go and look at loses to the one they're already in. So the human keeps the mental model from the chat and the docs it changes, more than from the renderer.
- **The short promises doc paid off most.** sitez's `prose/idea.md` settled design questions from what the project promises. For example, sitez has no configuration, so a layer can't be switched off, only overridden. Its "Not in v1" list pushed features to other projects. It works because it's short enough to hold in mind.
- **A rule stated in three places drifts in the untested ones.** markz explains its syntax in `syntax.md`, states it in the tested `grammar.md`, and restated it in `@prose`. One `@prose` block already disagreed with `AGENTS.md` about where origins live. Link to the owner, and keep only the how and why ([writing](writing.md#links)).
- **A rule in a doc can drive the code.** ship's `standard.md` opens each checked rule with an id, and `scripts/rules.ts` holds its check under the same id. A test holds the two to the same ids, so a rule can't be stated without a check, or checked without being stated. markz's `grammar.md` gives each construct an id, and its tests read the page as data, with markz itself. In both, the human argues about the doc, and the agent changes the code to match. prose's warning codes became the third, and all three now write an id the same way ([writing](writing.md#rules-a-test-reads)). Then ship's ids moved from dots to kebab case. Its survey still picked rules by the dotted prefix, so every check went quiet, and every repository passed. The test held the doc to the rules, but not the rules to what runs them, so it now holds that too.
- **Linking each code to its rule found the missing rules.** Once every code had to name the agent rule it serves, five kinds of check had no rule to name. They were blank lines around an element line, a marker on its own line, a heading's level, a summary's title, and a link's target. Each became part of a rule. The link runs from code to rule only, since most rules are about meaning, and have no code.

### Keeping prose true

- **The checks never ran.** markz's `AGENTS.md` says "nothing checks prose against code on its own", and its agents grep instead. The one real drift was that block about origins. It was about meaning, which no symbol or staleness check sees. So prose kept the reading, the convention and a renderer, and dropped the checks ([design](design.md#what-it-isnt)). Checks came back later only for form a machine can be sure of, in `prose check`, which runs in CI where nobody has to remember it.
- **The prose costs a second edit per change and drifts toward density.** 36 of sitez's 49 commits touch `prose/`. Blocks grew into long sentences carrying three qualifications each, since "rewrite, don't append" is harder than it sounds. The three-line limit on first paragraphs came from this. It wasn't enough, because the docs kept packing points into long sentences. So the rules later asked for plain sentences too ([the agent rules](usage.md#for-agents)).
- **Tuning changes rightly skip prose, and staleness can't tell.** markz's speed commits changed code without prose, which was correct. But a speed change that alters a cost the prose states would slip through the same way.

### Checks and advice

- **Run a check on real repositories before it lands.** Each of `prose check`'s new warnings was run on markz, sitez, ship and pagez first. The first run asked `.vscode/`, which holds only JSON, for a README, and a resolver bug flagged exports that had comments. Both were fixed before the check shipped, so every warning left was real.
- **Fixtures swamp the counts.** 183 of pagez's 191 warnings were test pages and build snapshots, each in its own folder. `.gitattributes` leaves them out, as `prose-unchecked` or `linguist-generated`. A way to leave text out is also a way to hide it, so both commands say how many files were left out, and the agent rules forbid it to quiet a warning ([usage](usage.md#for-agents)).
- **Advice that's wrong teaches agents to ignore it.** `prose style` first flagged every colon and semicolon that might join two ideas. On five repositories most of the colons it flagged opened a list or an explanation, and read fine. A wrong suggestion has an agent rewrite a good sentence, and learn to pass over the rest. So it now flags only what a rewrite would improve, and colons fell from 316 suggestions to 49 ([usage](usage.md#style)).
- **Print what agents work out anyway.** Agents piped `prose check` and `prose style` into Python scripts, to count the findings by code before fixing them. So both commands now end with that count, most first ([usage](usage.md#warnings)).
- **A code names the form it rejects, not the construct.** markz's `directive`, `footnote` and `jsx` read as if markz had no directives or footnotes, though it keeps another form of each. So they became `colon-directive`, `caret-footnote` and `jsx-component`. What made a name cost was ambiguity, not its number of words, so no test counts them.
- **Name an attribute for what it does.** `-prose` left a file out of the checks, but it read as "this file has no prose". `prose-unchecked` says what it does, as `linguist-vendored` does ([usage](usage.md#warnings)).

### Publishing

- **Publishing belongs to a site generator.** markz's site renders its `prose/` docs in place as its pages, and sitez generalizes that, so a folder of Markdown is a site. It works because the docs link by repo path. They were also rewritten into neutral, current prose (markz #62), not left as a record of the conversation. So prose doesn't publish. It keeps the same files readable locally ([writing](writing.md#folders-and-docs)).
- **A command to publish wasn't needed either.** `prose publish` committed a built site to a branch. The one site that could have used it deploys from `main` with a Cloudflare Worker instead ([development](development.md#the-site)).
- **Each host keeps its own files.** The build has no `CNAME`, `.nojekyll` or other host config. Each host changes its files, credentials and rules on its own schedule, so a project keeps its host's config in its own repository.
- **Clearing the output can race Finder.** sitez's build failed twice with `ENOTEMPTY` while clearing `.prose`, which had a `.DS_Store` in it. Finder writes one into a folder that's open, and it landed after the folder was emptied but before it was removed. `rmSync`'s `maxRetries` retries on `ENOTEMPTY`, so the build clears with it.

## What the code taught

These were found by dogfooding on prose's own source and on real repositories. Real code has more variety than a curated fixture.

### The parser and scanner

- **A `@prose` block inside a callback or object literal is silently dropped.** In `register({ setup(ctx) { /** @prose */ } })` the block is at depth 2, not 0. At first only depth 0 counted. Now a comment counts at any depth when it starts its own line, in every language ([writing](writing.md#in-each-language)). One that shares its line with code is still an ordinary comment. That one rule replaced a statement walk for JS and a brace counter for CSS.
- **A tokenizer that handles strings and comments but not regex literals is one construct from silent corruption.** In ``.replace(/`/g, "")``, the backtick read as a template-literal opener. It "closed" at the next backtick in the file and broke `{}` depth for everything after. There was no error, and comments just stopped being found. A `skipRegexLiteral` that guessed from the last token fixed that case, but still misread `return /x/`. oxc's comment list replaced the hand tokenizer. Later a lexer came back, because oxc's native binary was too heavy for a comment list ([development](development.md#what-ships)). It counts no braces, so a misread can't spread. It reads `${…}` in a template as code. A test checks it against oxc on every JS and TS file in the repository. Before it landed, it matched oxc on all 19,282 JS and TS files in `node_modules`.
- **A scanner with no closing delimiter must let the marker define the boundary.** YAML and TOML use `#` comments. The scanner collected every contiguous `#` line and checked only the first for a marker, so it merged two back-to-back `@prose` blocks. A block now runs from a marker line to the next marker line or the first non-`#` line. Ask "what happens when two blocks touch", not just "what happens at the end". Writing that test case directly caught it.
- **Don't reimplement scope analysis with regexes.** `declaredIdentifiers` grew one construct per bug report. Imports came first (`marked`), then parameters (`html` in `headingId(html: string)`). No flat regex can find a parameter inside nested parens and braces, and destructuring and class members were still pending. The fix was structural. It parsed with `oxc-parser`, the engine oxlint, oxfmt and tsdown already use, and walked the AST. The names later went, with the anchors they made, and then oxc went too.
- **Property tests found a CRLF bug that no example had.** The parser kept the `\r` of a CRLF line inside comment text. The `#`-style scanner's `endIndex` sat between `\r` and `\n`. So an edit at that offset in a CRLF YAML or TOML file would have split a line ending. Each fixture variant, like CRLF or no final newline, costs one line in the generator.

### The file as the leaf

- **A chunk shown alone doesn't make sense.** So the tree stops at files, and a file node carries its prose comments, each with its byte span. The page lays the source out around those spans. It drops the comment text and renders it as prose in its place, which shows the whole file with nothing repeated. Exact offsets beat line ranges here. The `.svelte` part-clipping had already shown that per-chunk code slices lose the tags between parts. Once the page worked this way, the parser's own chunks, sections and preamble had no reader left, and they went.

### Anchors and addresses

- **An address built from position isn't stable, whatever the spec calls it.** The spec promised `#addTodo`, but the code produced `top-chunk-2`, which moves when a block is inserted above. Derive anchors from content ([writing](writing.md#links)).
- **The heading is the anchor the reader already sees.** Anchors were once a heading's slug, then the first name the code declared, then `chunk-N`. That took an AST walk and its own tests, for links nobody wrote. A comment's link is now its heading's id, as markz makes it, the same rule GitHub uses for docs.

### Rendering

- **A global `code { padding }` rule for inline spans also hit the highlighter's `<pre><code>`.** It added a stray space before every block's first token. Copied text came out clean, since padding is box model, not content. A `pre code` reset fixes it.
- **Measure a replacement against what it replaces.** Small tokenizers replaced shiki, which was about 18 MB installed and most of what a page cost. A script compared their colours with shiki's, character by character, on this repository's files. It started near 95% and pointed straight at the misses, like arrow functions, CSS units and shell arguments. It reached 99.3% before shiki went, and cases from it stay in `tests/highlight.test.ts`. The highlighter is now about 50 times faster, and a page about a third smaller, since a token carries a class instead of an inline style.
- **An audit that reuses a tab carries its state.** axe failed a tree link on a different number of pages each run. The rail keeps its scroll in `sessionStorage`, so each page opened where the one before had left it, sometimes with a link half under the contents. The audit now clears it, so each page is checked as it first loads.
- **`oxlint`'s type-aware mode (`tsgolint`) is the type check** for `.ts`, not a separate `tsc --noEmit`. It caught a real `no-floating-promises` at once.

### Working style

- **Read the installed `.d.ts` files, not a summarized doc fetch.** `WebFetch` ran pages through a smaller model that lost specifics. It dropped concrete examples and a caveat that changed the cost of adopting a library. Install into a scratch directory and grep `dist/*.d.ts`.
