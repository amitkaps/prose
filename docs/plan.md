# Plan

The `@prose` convention and the read-only command work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). 0.8.0 is on npm as `@amitkaps/prose`, and what each release changed is in its [notes on GitHub](https://github.com/amitkaps/prose/releases). This plan says what's next, in order, and what works now.

## Next, in order

- [ ] **A skill and an outline, so agents find the rules and the code.** Agents ran the commands they were made to run and skipped the ones they were only told about. In 30 sessions across the repositories, `pnpm run verify` or `pnpm pr` ran 818 times, and `prose style` ran in 16 of the 23 sessions that wrote prose. `prose rules` was read before the first prose edit in only 8 of those 23, and the map grep in [the agent rules](usage.md#for-agents) never ran. So the rules need a way in that fits the task, and the map needs to be in context already.
  - **A skill per tool.** pnpm links a package's `skills/<name>/SKILL.md` into each agent's folder, such as `.claude/skills`, once a repository approves it in `pnpm-workspace.yaml` ([pnpm](https://pnpm.io/agent-skills)). prose ships a thin skill whose description says when it applies, before writing a `@prose` comment or changing code one explains. Its body says to run `prose rules`, so the command stays the one source and the skill always matches the version installed. craftz and pagez ship one the same way, and craftz's reference workspace approves them.
  - **A generated `outline.md`.** `prose outline` writes `outline.md` at the root, the repository's tree with each file's first paragraph. That covers config, docs and source alike, and leaves out what `.gitattributes` marks `prose-unchecked`, like fixtures. `AGENTS.md` imports it, so it's loaded every session and again after a summary. It's about 4 to 6k tokens in each of these repositories. `pnpm run verify` writes it, and it's gitignored. It would be the first file prose writes.
  - **First in prose.** Both are tried here before craftz takes them into its rules. The outline is in, and `verify` writes it. The skill is next. An approved skill with no folder to link into fails `pnpm install`, so CI must still install, through a committed folder or `skills.dirs`. Then count again whether agents read the rules before their first prose edit.
  - **Ruled out.** A marked copy of the rules in every `AGENTS.md`, kept by `prose rules --write`. The skill reaches the same agents without a copy in every repository.
  - **Ruled out.** A committed `outline.md`. Two open pull requests that each change a summary would both rewrite it and conflict. Writing it in `verify` keeps it current in every session that checks its work.

## Where it is

- **Reading.** `prose .` and `prose build` show a repository as documents, with a file tree, the docs in the bar and a table of contents ([reading](reading.md)). Its pages are the user docs for this repository and for markz.
- **Checks and advice.** `prose check` warns about form a machine can be sure of, and runs in CI. `prose style` gives advice an agent can take every time ([usage](usage.md#warnings)). Each code links to the [agent rule](usage.md#for-agents) it serves, and a test holds the codes, the rows and the rules to each other ([writing](writing.md#a-tools-rules)). A written id is kebab case and stated on one page.
- **Rules without a fetch.** `prose rules` prints the agent rules for the installed version, each with the codes that check it, then markz's, read with markz's reader. `prose rules <id>` prints one rule, or one code and its rule. Every repository's `AGENTS.md` says to run it before writing prose, or changing code a `@prose` comment explains.
- **Commands stated once.** Each command opens its section of [usage](usage.md) with an id, and `prose help` prints them with markz's reader. A test holds the commands the CLI runs to the ones usage states.
- **One small package.** prose has no dependencies, bundles markz, and ships at about 250 KB ([development](development.md#what-ships)).
- **Used across the repositories.** markz, sitez, pagez, base and craftz each run `prose check` in CI, through craftz's rules. Its first version was a larger tool, cut back to the parts that got read ([lessons](lessons.md#what-use-taught)).

## Later

- **A pass by hand.** One page of each kind, in a browser and with VoiceOver: the tree, the switch, a code run, folded code, a phone's width, and the live dot when the server stops. base's `.svelte` files use all three parts. The checks so far are what a machine can do.
- **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).
- **The file tree on a large repository.** Every page carries the whole tree, so a site's size grows with the square of its file count. It's about 1 KB gzipped here. If it grows too large, the tree could become a shared file too, as long as its open folders still come back before the first paint.

- **`broken-anchor` from the tree.** It collects a page's ids from its rendered HTML. A Markdown page could take them from markz's `ids` instead. A source page still needs the HTML, since `uniqueIds` changes ids as it renders.

## Open questions

- **Comment links on GitHub.** `src/store.ts#adding` works in the renderer, but GitHub scrolls only to a line, like `#L42`. Either accept it, or let whatever publishes the docs map links to lines.
- **The tones as a promise.** A project's own page, like craftz's dashboard, could use `--success` and the other tones instead of its own colours. That makes the names public, so renaming one would break someone's page. Either list them in [reading](reading.md#around-the-page) as tokens a page may use, or keep them prose's own. It waits for a page that needs them.
- **A project's own pages as elements.** A doc could hold a standalone page, like markz's Quality page or craftz's drift tables, as a Markz element that prose defines, so the page sits in prose's frame. It needs a place for the scripts, a way in for generated data, and the project's code running in the browser, each an exception to [design](design.md#what-it-isnt). An iframe in an `=html` block needs nothing from prose, so try that first. Revisit with a third standalone page, or a request from a repository that isn't ours.
