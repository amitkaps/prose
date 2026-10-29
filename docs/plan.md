# Plan

The `@prose` convention and the read-only command work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). 0.11.1 is on npm as `@amitkaps/prose`, and what each release changed is in its [notes on GitHub](https://github.com/amitkaps/prose/releases). This plan says what's next, in order, and what works now.

## Next, in order

- [ ] **Count whether agents now find the code and the rules.** Before the outline, `prose rules` was read before the first prose edit in only 8 of 23 sessions that wrote prose, and the map grep in the agent rules never ran. Now `outline.md` is in every agent's context, and craftz's shared `AGENTS.md` says when to read the rules. Once a couple of weeks of sessions have run, count both again. The outline works if agents search less before their first edit, and open the right file sooner ([design](design.md#the-outline)).
  - **Ruled out.** A committed `outline.md`. Two open pull requests that each change a summary would both rewrite it and conflict. Writing it in `verify` keeps it current in every session that checks its work.
  - **Ruled out.** A skill, shipped in the package and linked by pnpm ([pnpm](https://pnpm.io/agent-skills)). It's pnpm's own route, not a standard. It needed an approval and `skills.dirs` in every repository, since CI fails without them, plus an ignored folder and an exception in `prose check`. All of that delivered a pointer to `prose rules`, with no evidence that a pointer gets followed.
  - **Ruled out.** A copy of the rules in each `AGENTS.md`, kept by `prose rules --write`. A rule's text belongs to the tool that checks it ([lessons](lessons.md#dont-repeat-yourself)), and a copy needs a check of its own to stay current.
- [ ] **`broken-anchor` from markz's ids.** It collects a page's ids from its rendered HTML. A Markdown page could take them from markz's `ids` instead, as the other tools read their docs. A source page still needs the HTML, since `uniqueIds` changes ids as it renders.

## Where it is

- **Reading.** `prose .` and `prose build` show a repository as documents, with a file tree, the docs in the bar and a table of contents ([reading](reading.md)). Its pages are the user docs for this repository and for markz.
- **Checks and advice.** `prose check` warns about form a machine can be sure of, and runs in CI. `prose style` gives advice an agent can take every time ([usage](usage.md#warnings)). Each code links to the [agent rule](usage.md#for-agents) it serves, and a test holds the codes, the rows and the rules to each other ([writing](writing.md#a-tools-rules)). A written id is kebab case and stated on one page.
- **Rules without a fetch.** `prose rules` prints the agent rules for the installed version, each with the codes that check it, then markz's, read with markz's reader. `prose rules <id>` prints one rule, or one code and its rule. Every repository's `AGENTS.md` says to run it before the first edit to a `@prose` comment or a `.md` file.
- **An outline in every session.** `prose outline` writes `outline.md`, every file with its summary, and `AGENTS.md` imports it. `verify` writes it, and git ignores it.
- **Commands stated once.** Each command opens its section of [usage](usage.md) with an id, and `prose help` prints them with markz's reader. A test holds the commands the CLI runs to the ones usage states.
- **One small package.** prose has no dependencies, bundles markz, and ships at about 250 KB ([development](development.md#what-ships)).
- **Used across the repositories.** markz, pagez, base and craftz each run `prose check` in CI, through craftz's rules. Its first version was a larger tool, cut back to the parts that got read ([lessons](lessons.md#build-only-what-gets-used)).

## Later

- **A pass by hand.** One page of each kind, in a browser and with VoiceOver: the tree, the switch, a code run, folded code, a phone's width, and the live dot when the server stops. base's `.svelte` files use all three parts. The checks so far are what a machine can do.
- **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).
- **The file tree on a large repository.** Every page carries the whole tree, so a site's size grows with the square of its file count. It's about 1 KB gzipped here. If it grows too large, the tree could become a shared file too, as long as its open folders still come back before the first paint.

## Open questions

- **The tones as a promise.** A project's own page, like craftz's dashboard, could use `--success` and the other tones instead of its own colours. That makes the names public, so renaming one would break someone's page. Either list them in [reading](reading.md#around-the-page) as tokens a page may use, or keep them prose's own. It waits for a page that needs them.
- **A project's own pages as elements.** A doc could hold a standalone page, like markz's Quality page or craftz's drift tables, as a Markz element that prose defines, so the page sits in prose's frame. It needs a place for the scripts, a way in for generated data, and the project's code running in the browser, each an exception to [design](design.md#what-it-isnt). An iframe in an `=html` block needs nothing from prose, so try that first. Revisit with a third standalone page, or a request from a repository that isn't ours.
