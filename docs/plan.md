# Plan

The `@prose` convention and the read-only command work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). 0.8.0 is on npm as `@amitkaps/prose`, and what each release changed is in its [notes on GitHub](https://github.com/amitkaps/prose/releases). This plan says what's next, in order, and what works now.

## Next, in order

- [ ] **Watch whether agents run `prose rules`.** If they skip it, `prose rules --write` could keep a marked block of the rules in `AGENTS.md`, which agents load every session. That's a copy in every repository, so `prose check` would then warn when the block is stale.
  - **2026-10-23, craftz.** An agent deleted code under `@prose` comments without reading the rules, since `AGENTS.md` said to run them only before writing prose. It now names changing code too. Rules read early were also lost when the session was summarized, while `AGENTS.md` is loaded again. That's the case `--write` is for, but one miss doesn't pay for a copy in every repository, so watch the wider pointer first.
- [ ] **Rules read from markz's `ids`.** `agentRules` and `codeRules` read usage.md's tree in place of two regexes. `ids` gives each id and its label, and `headings` the group it's under. A rule's text is the source from its span's end to its item's end, so links and code survive printing. Rules and codes are told apart by the heading they're under, so the docs need no new form. `prose rules` prints byte for byte what it does now, held by a snapshot taken before the switch.
  - **No shared reader.** craftz's and pagez's tests and markz's harness move to `ids` the same way, each in its own pull request, which its own plan tracks. The few lines that slice a rule's text are navigation over markz's API, not a convention that can drift, so a shared reader would only be a layer over markz.
  - **Headings stay anchors.** markz's construct headings and mid-sentence codes are a spec's anchors, and its harness reads them with `ids` too.
- [ ] **Two warnings for written ids.** `prose check` warns on a written span id that isn't kebab case, and on one that two pages of a repository state. Rules and codes share one namespace, since `prose rules <id>` finds an id without its page. All four repositories pass both today. They're prose's, since only `prose check` reads a whole repository.
- [ ] **A tool's rules, worded once.** [Rules a test reads](writing.md#rules-a-test-reads) becomes the convention for any tool whose users follow rules. Each rule is worded once in a doc, with an id. Each code links to the rule it serves, a test holds the code to the doc, and `<tool> rules` prints them for the installed version. craftz and prose have every part. pagez has all but the command, and markz's rules reach agents through `prose rules`, since writing Markdown is writing prose. The section also gains the agent rule for ids. A claim used in several places is stated once with an id, and the others link to it, so a removed or renamed claim breaks a link that `broken-anchor` catches.

## Where it is

- **Reading.** `prose .` and `prose build` show a repository as documents, with a file tree, the docs in the bar and a table of contents ([reading](reading.md)). Its pages are the user docs for this repository and for markz.
- **Checks and advice.** `prose check` warns about form a machine can be sure of, and runs in CI. `prose style` gives advice an agent can take every time ([usage](usage.md#warnings)). Each code names the [agent rule](usage.md#for-agents) it serves, and a test holds the codes, the rows and the rules to each other ([writing](writing.md#rules-a-test-reads)).
- **Rules without a fetch.** `prose rules` prints the agent rules for the installed version, each with the codes that check it, and `prose rules <code>` one code and its rule. Every repository's `AGENTS.md` says to run it before writing prose, or changing code a `@prose` comment explains.
- **One small package.** prose has no dependencies, bundles markz, and ships at about 250 KB ([development](development.md#what-ships)).
- **Used across the repositories.** markz, sitez, pagez, base and craftz each run `prose check` in CI, through craftz's rules. Its first version was a larger tool, cut back to the parts that got read ([lessons](lessons.md#what-use-taught)).

## Later

- **A pass by hand.** One page of each kind, in a browser and with VoiceOver: the tree, the switch, a code run, folded code, a phone's width, and the live dot when the server stops. base's `.svelte` files use all three parts. The checks so far are what a machine can do.
- **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).
- **The file tree on a large repository.** Every page carries the whole tree, so a site's size grows with the square of its file count. It's about 1 KB gzipped here. If it grows too large, the tree could become a shared file too, as long as its open folders still come back before the first paint.

- **`pagez rules`, and one printer.** pagez has the rules, the ids and the test, but an agent writing a site has to fetch `pages.md`. The command waits for an agent to miss a pagez rule, as `--write` waits for a miss. A third rules command is when one printer earns sharing: grouped by heading, each rule with its codes, one by id, and links resolved against the site. craftz's reference would then point to it only where pagez is installed.

- **`broken-anchor` from the tree.** It collects a page's ids from its rendered HTML. A Markdown page could take them from markz's `ids` instead. A source page still needs the HTML, since `uniqueIds` changes ids as it renders.

## Open questions

- **The rules as a skill.** A Markdown skill file in the package, built from the same block in usage.md, would reach agent tools that load skills from installed packages. It's an emerging channel, in addition to `prose rules`, not instead of it. Wait until the tools settle on where they look.
- **Comment links on GitHub.** `src/store.ts#adding` works in the renderer, but GitHub scrolls only to a line, like `#L42`. Either accept it, or let whatever publishes the docs map links to lines.
- **A map command.** `prose outline` could print every first paragraph, if the grep in [the agent rules](usage.md#for-agents) proves too noisy for agents.
- **The tones as a promise.** A project's own page, like craftz's dashboard, could use `--success` and the other tones instead of its own colours. That makes the names public, so renaming one would break someone's page. Either list them in [reading](reading.md#around-the-page) as tokens a page may use, or keep them prose's own. It waits for a page that needs them.
- **A project's own pages as elements.** A doc could hold a standalone page, like markz's Quality page or craftz's drift tables, as a Markz element that prose defines, so the page sits in prose's frame. It needs a place for the scripts, a way in for generated data, and the project's code running in the browser, each an exception to [design](design.md#what-it-isnt). An iframe in an `=html` block needs nothing from prose, so try that first. Revisit with a third standalone page, or a request from a repository that isn't ours.
