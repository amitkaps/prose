# Plan

Where the project is and what comes next, in order. Finished work is summed up in a few lines. The detail lives in the code's `@prose`, the tests, the release notes and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only command work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.7.1, on npm as `@amitkaps/prose` and as a GitHub release tarball. Each release's notes are on GitHub, generated from its pull requests ([development](development.md#release)).

- **Reading.** `prose .` and `prose build` show a repository as documents, with a file tree, the docs in the bar and a table of contents ([reading](reading.md)). Its pages are the user docs for this repository and for markz.
- **Checks and advice.** `prose check` warns about form a machine can be sure of, and runs in CI. `prose style` gives advice an agent can take every time ([usage](usage.md#warnings)). `prose rules` prints the rules they read for. A check for one term per concept, from a glossary, is ruled out. Telling a synonym from a different concept is meaning, and a wrong note teaches agents to ignore the rest ([lessons](lessons.md#checks-and-advice)). The agent rule already says to use the docs' term, and no drift in terms has been seen.
- **One small package.** prose has no dependencies, bundles markz, and ships at about 200 KB ([development](development.md#what-ships)).
- **Used beyond this repository.** It has been tried on markz, sitez, ship, pagez and base. Its first version was a larger tool, cut back to the parts that got read ([lessons](lessons.md#what-use-taught)).

## Next, in order

- [ ] **The warning codes held to the docs.** Each code `check` and `style` print is a rule, and its row in [usage](usage.md#warnings) is its written id, as ship's `rules.test.ts` holds its rules ([lessons](lessons.md#where-decisions-live)). It's the third instance of the pattern, after ship and markz.
  - Each row opens with its code as a span, like ``[`no-readme`]{#no-readme}``. A test holds the rows to the codes the source emits, both ways, so a code can't ship without a row, and a row can't outlive its code. `broken-anchor` says an id, not a heading, since a span's id passes too. Done ([tests/codes.test.ts](../tests/codes.test.ts)).
  - `prose rules` prints [the agent rules](usage.md#for-agents), and `prose rules <code>` prints one code's row, both from usage.md bundled into `dist/`. The summary names the command, and a warning carries no link of its own. A markz code prints markz's text and links its rule, from the list markz exports. Done ([src/rules.ts](../src/rules.ts)).
  - Each agent rule has a two-word id, under one of four groups, and each row names the rule its code serves. `prose rules` prints every rule with the codes that check it, and `prose rules <code>` its rule after its row. A test holds every code to a rule, except the two about a build. Most rules are about meaning and have no code, so it doesn't hold the other way. The rules carry ids now that projects run `prose rules` and stop copying them. It found that blank lines around an element line, the markz 0.5.0 warning, had no rule. Done ([src/rules.ts](../src/rules.ts)).
  - A code names what's wrong, or the form it rejects, never a whole construct. So five of prose's codes were renamed, like `joining-colon`, and three of markz's in its 0.6.0, like `colon-directive`. A test can't judge a name, so word count isn't held. Done.
  - Release 0.8.0, with markz 0.6.0 bundled. It's breaking, since `prose check` warns where it didn't, and codes were renamed. Done.
  - Then ship moves its versions of prose and markz, and each repository's `AGENTS.md` says to run `pnpm prose rules` before writing prose, in place of the link to the site. The wording changes in ship first, and the site stays for humans. No repository had blank lines to add. Done.
  - Watch whether agents run it. If they skip it, `prose rules --write` could keep a marked block of the rules in `AGENTS.md`, which agents load every session. That's a copy in every repository, so `prose check` would then warn when the block is stale.
  - ship writes its rule ids as spans, like ``[`toolchain-lint`]{#toolchain-lint}``, since an id can't hold a dot. A link to a ship rule lands on it, and `broken-anchor` checks it. The rename dropped every rule from ship's survey, which picked them by a dotted prefix, and no test noticed, so one now holds the survey to every rule. Done.
  - Write down what the three instances share, as [rules a test reads](writing.md#rules-a-test-reads). Done.
- [ ] **Use it on base, sitez and markz.**
  - Install the latest release, and remove `prose()` from their Vite configs. Replace the snippet in their `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - Move `prose/` to `docs/` in sitez and markz, with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website, so that moves to `site/` first, with its root scripts, workspace, package name and CI paths.
  - In markz, make `@prose` link to `grammar.md` instead of restating its rules ([writing](writing.md#links)).
  - Check each one in a browser, installed as any outside project would. Every kind of page renders, links between prose and code resolve, and the page reloads on save. Unmarked comments, like JSDoc, `//` and `svelte-ignore`, don't show as prose. Look at typography, folded code and a phone's width. base is SvelteKit, with `.svelte` files that use all three parts.

## Later

- [ ] **A pass with VoiceOver.** One page of each kind, the tree, the switch, a code run, and the live dot when the server stops. The checks so far are what a machine can do.

- [ ] **Pictures of the page.** Once the layout is stable, a screenshot of a rendered file in the README, and a labelled image of the page in [reading](reading.md#around-the-page).

- [ ] **The file tree on a large repository.** Every page carries the whole tree, so a site's size grows with the square of its file count. It's about 1 KB gzipped here. If it grows too large, the tree could become a shared file too, as long as its open folders still come back before the first paint.

## Open questions

- **The rules as a skill.** A Markdown skill file in the package, built from the same block in usage.md, would reach agent tools that load skills from installed packages. It's an emerging channel, in addition to `prose rules`, not instead of it. Wait until the tools settle on where they look.

- **A reader for rules.** prose's codes test, markz's syntax harness and ship's rules each read [rules a test reads](writing.md#rules-a-test-reads) with their own regex. A function that returns each rule's id, text and heading could live in markz. Wait for a fourth reader, or for the three to drift.

- **Comment links on GitHub.** `src/store.ts#adding` works in the renderer, but GitHub scrolls only to a line, like `#L42`. Either accept it, or let whatever publishes the docs map links to lines.
- **A map command.** `prose outline` could print every first paragraph, if the grep in [the agent rules](usage.md#for-agents) proves too noisy for agents.
- **The tones as a promise.** A project's own page, like ship's dashboard, could use `--success` and the other tones instead of its own colours. That makes the names public, so renaming one would break someone's page. Either list them in [reading](reading.md#around-the-page) as tokens a page may use, or keep them prose's own. It waits for a page that needs them.
- **A project's own pages as elements.** A doc could hold a standalone page as a Markz element, such as markz's Quality page as `{@markz-quality}`, or ship's drift tables. markz already writes the tag. prose would add the script that defines it, written any way a custom element can be, and never run the project's build. The page would then sit in prose's frame, and couldn't drift from its bar. It waits, because two working pages don't pay for what it adds.
  - A place for the scripts. prose has no folders or options of its own, only the docs it links in the bar.
  - A way in for data. An element needs data the project's code generates, and prose reads only what is committed.
  - The project's code in the browser. `prose .` would run each repository's scripts, including a repository someone else wrote.
  - Exceptions to [design](design.md#what-it-isnt). prose would become a little of a site generator, and a little part of the app.
  - An iframe is the way to try first, and it needs nothing from prose. markz refuses `{@iframe}`, but an `=html` block passes `<iframe src="/quality.html">` through. The page keeps its own look, and its scripts run in their own document. It has a fixed height, follows the system's theme rather than prose's switch, and needs `target="_top"` on its links. `prose .` may not serve a page the project generates.
  - Revisit it with a third standalone page, or a request from a repository that isn't ours. An element format such as sitez's elementz isn't needed, since a custom element is the browser's own standard.
