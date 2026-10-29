# Lessons

What building and using prose taught, for whoever changes it next. Each lesson says what went wrong and what to do about it. What the code does now is in its `@prose`, and the story is in the pull request.

The first groups follow the principles in [craftz's Practice](https://craftz.amitkaps.com/docs/rules.md#practice), in its order, and each says what holds its principle here. prose's own groups come after them, then [Tools](#tools). A lesson that repeats one in its group means the principle needs a check.

## Write the spec first

The rule is [Write the spec first](https://craftz.amitkaps.com/docs/rules.md#write-the-spec-first). Each code names the agent rule it serves, and a test holds the codes, the rows and the rules to each other.

- **Linking each code to its rule found the missing rules.** Once every code had to name the agent rule it serves, five kinds of check had none to name. Each became part of a rule. The link runs from code to rule only, since most rules are about meaning and have no code.
- **An address built from position moved.** The spec promised `#addTodo`, and the code made `top-chunk-2`, which moved when a block was added above it. A comment's link is its heading's id, as markz makes it ([writing](writing.md#links)).

## Measure before changing

The rule is [Measure before changing](https://craftz.amitkaps.com/docs/rules.md#measure-before-changing). A check is added only once a sample shows what it would catch.

- **Prose's share of the lines sorts nothing.** Across six repositories it ran from 0.19 to 0.32 lines per line of code, with good files and bad at both ends. Length shows where to read, so it isn't a check.
- **A sample found no drift, which shows the habit, not the help.** 22 checkable claims in 40 random sections across four repositories all held. Agents are told to keep prose current, so this shows they do, not that it helps them. One section said its code should already be gone, which is how the dead code was found.

## Don't repeat yourself

The rule is [Don't repeat yourself](https://craftz.amitkaps.com/docs/rules.md#dont-repeat-yourself). `broken-link` and `id-twice` hold the links and ids, and each command prints what agents would otherwise count from its output.

- **A rule stated in more than one place drifted in the copies.** A markz `@prose` block disagreed with its `AGENTS.md` about where origins live. craftz's command summary was repeated in four places, and two had missed a line. `markz-markdown` copied markz's rules into prose's. Link to the one owner, and keep only the how and why ([writing](writing.md#links)). A rule's text belongs to the tool that checks it ([writing](writing.md#a-tools-rules)).
- **A check sees one file, so drift across files passes.** Each copy of craftz's command summary read well alone. Write a summary that names each part and links the file that explains it.
- **Print what agents work out anyway.** Agents piped `prose check` and `prose style` into scripts to count findings by code. Both commands now end with that count, most first ([usage](usage.md#warnings)).

## Parse, don't match text

The rule is [Parse, don't match text](https://craftz.amitkaps.com/docs/rules.md#parse-dont-match-text). The lexer counts no braces, and a test holds it to oxc's comments.

- **A tokenizer one construct short corrupted everything after it.** In ``.replace(/`/g, "")``, the backtick read as a template's start, and every comment after it was lost with no error. A guess from the last token still misread `return /x/`. The lexer now reads `${…}` as code and counts no braces, so a misread can't spread, and it matched oxc on all 19,282 JS and TS files in `node_modules` before it landed.
- **Scope analysis by regex grew one construct per bug.** Imports came first, then parameters, and destructuring and class members were still to come. No flat regex finds a parameter inside nested parentheses. Walk a parsed tree, or drop the feature, which is what happened here.
- **A `@prose` block inside a callback was dropped.** Only a block at depth 0 counted, so one in `register({ setup(ctx) { … } })` was lost. A comment now counts at any depth when it starts its own line, in every language ([writing](writing.md#in-each-language)).
- **A scanner with no closing delimiter merged two blocks.** It collected every contiguous `#` line, so two `@prose` blocks back to back became one. A block now ends at the next marker line. Ask what happens when two blocks touch, not only what happens at the end.

## Build only what gets used

The rule is [Build only what gets used](https://craftz.amitkaps.com/docs/rules.md#build-only-what-gets-used). Agents reach prose through `AGENTS.md`, not a channel of its own.

- **Most of the first version went unread.** A `/__prose/` route in the app, an annotator, a planned _since_ view, a Vite plugin and dev tools were most of the work, and the human rarely opened them. `@note` never became the channel either, since a decision takes turns in the chat. The docs, read in the editor and published as the user docs, were what got read. Before building a view, ask what the human opened last week.
- **Weigh the machinery against what it delivers.** A skill linked by pnpm needed an approval and a setting in every repository, an ignored folder and an exception in `prose check`, all to deliver a pointer to `prose rules`. CI failed without the setting, which only a clean install showed. It was taken out before it shipped. Improve what every agent already reads, `AGENTS.md`, before adding a channel.
- **A command nobody needed went.** `prose publish` committed a built site to a branch, and the one site that could use it deploys from `main` with a Worker ([development](development.md#the-site)). A site generator publishes a folder of docs, and each host keeps its config in its own repository ([writing](writing.md#folders-and-docs)).

## Try it on the real thing

The rule is [Try it on the real thing](https://craftz.amitkaps.com/docs/rules.md#try-it-on-the-real-thing). A new warning runs on the other repositories before it lands.

- **A check that passed its fixtures failed on real repositories.** The first run asked `.vscode/`, which holds only JSON, for a README, and a resolver bug flagged exports that had comments. Run each new warning on markz, pagez, base and craftz first, so every warning left is real.
- **A summarized page lost what mattered.** A web fetch ran a library's docs through a smaller model, which dropped its examples and a caveat that changed what adopting it cost. Install into a scratch folder and read its `.d.ts` files.

## Have a way to verify

The rule is [Have a way to verify](https://craftz.amitkaps.com/docs/rules.md#have-a-way-to-verify). The lexer is tested against oxc on every JS and TS file here, and cases from the highlighter's comparison with shiki stay in `tests/highlight.test.ts`.

- **Measure a replacement against what it replaces.** Small tokenizers replaced shiki, about 18 MB installed and most of what a page cost. A script compared their colours with shiki's, character by character, on this repository's files. It started near 95% and pointed straight at the misses, and shiki went only at 99.3%. The highlighter is now about 50 times faster, and a page about a third smaller.
- **A generator found what no example had.** Property tests found that the parser kept a CRLF line's `\r` inside a comment's text, so an edit at its end would have split a line ending. Each fixture variant, like CRLF or no final newline, costs one line in the generator.
- **The one real drift was about meaning.** A `@prose` block about origins disagreed with `AGENTS.md`, and no symbol or staleness check would see it. So prose checks only form a machine can be sure of ([design](design.md#what-it-isnt)).
- **An audit that reuses a tab carries its state.** axe failed a tree link on a different number of pages each run, since the rail kept its scroll in `sessionStorage`. The audit clears it, so each page is checked as it first loads.

## Silence is the failure

The rule is [Silence is the failure](https://craftz.amitkaps.com/docs/rules.md#silence-is-the-failure). `prose check` runs in CI, and both commands say how many files `.gitattributes` left out.

- **Advice that's wrong teaches agents to ignore it.** `prose style` first flagged every colon that might join two ideas, and most opened a list and read fine. A wrong suggestion has an agent rewrite a good sentence, and pass over the rest. Flag only what a rewrite would improve, which took colons from 316 suggestions to 49 ([usage](usage.md#style)).
- **A way to leave text out is a way to hide it.** 183 of pagez's 191 warnings were test pages and snapshots, which `.gitattributes` now leaves out. So both commands count what they left out, and the agent rules forbid it to quiet a warning ([usage](usage.md#for-agents)).
- **A rule held to its doc still went quiet.** The repository that kept the rules before craftz held its doc to its checks by id. When its ids moved from dots to kebab case, its survey still picked rules by the dotted prefix, so every check stopped running and every repository passed. Hold the doc to the rules, and the rules to what runs them.

## Keeping prose true

- **Prose drifts toward density.** Blocks grew into long sentences carrying three qualifications each, since rewriting is harder than appending. A three-line summary wasn't enough, so the rules ask for plain sentences too ([usage](usage.md#for-agents)).
- **Old blocks get edited around, not rewritten.** base's content loading kept wording from before the rules through four changes, retelling the code, until its length stood out.
- **A change that tunes code rightly skips prose, and nothing can tell it from one that should have.** A speed change that alters a cost the prose states slips through the same way.

## Names and anchors

- **A code names the form it rejects, not the construct.** markz's `directive`, `footnote` and `jsx` read as if markz had none, though it keeps another form of each. So they became `colon-directive`, `caret-footnote` and `jsx-component`. What made a name cost was ambiguity, not its length.
- **Name an attribute for what it does.** `-prose` left a file out of the checks, but read as "this file has no prose". `prose-unchecked` says what it does, as `linguist-vendored` does ([usage](usage.md#warnings)).
- **A command's id can take a heading's place.** Opening each section of usage with its command, as `build` and `style`, kept every link to those headings landing on the command.

## Rendering

- **A chunk shown alone didn't make sense.** The page lays out the whole file around its comments' byte spans, and renders each comment as prose in its place. Exact offsets keep the tags between a `.svelte` file's parts, which per-chunk slices lost.
- **A global `code { padding }` also hit `<pre><code>`.** It added a stray space before every block's first token. A `pre code` reset fixes it.

{#tools}

## Tools

What each tool does that its docs don't say.

- **oxlint's type-aware mode is the type check.** `tsgolint` checks `.ts` in place of a separate `tsc --noEmit`, and caught a real `no-floating-promises` at once.
- **Finder writes into a folder that's being cleared.** A build failed with `ENOTEMPTY`, since a `.DS_Store` landed after `.prose` was emptied and before it was removed. Clear with `rmSync`'s `maxRetries`.
