# Design

Prose lets coding agents explain the code they write, and lets humans read the resulting repository as a document. This page is why it's built the way it is, and what it leaves out.

It is two things:

- **`@prose`**, a convention for writing human-oriented meaning directly into source code ([writing.md](writing.md)).
- **`prose`**, a read-only renderer that opens any repository in the browser as a Markdown-first document ([usage.md](usage.md), [reading.md](reading.md)).

Nothing else is required.

## Why

**The human keeps the mental model by reading prose, not code.** One person works with coding agents that change code faster than it can be read. What the human needs is the model of the whole design: what the project promises, how it's put together, and why. The agent writes the code and most of the prose. The human reads the prose and gives direction in the chat.

**The agent explains as it builds.** The loop is: the human gives direction → the agent changes code → the agent updates the `@prose` next to it, and any doc the change affects, in the same change → the human reads the result and redirects. The explanation is in the code it explains, so it changes in the same diff or visibly doesn't.

**The browser is a reading surface.** The source of truth is the repository, changed by the human's editor and the agent's tools. The renderer edits nothing, keeps no state and doesn't replace grep or the agent's own reading. It gives the human a better way to read.

**Short prose is what makes it work.** A promises doc short enough to hold in mind lets decisions be argued from what the project promises rather than from taste. A first paragraph of three lines is a map; one of three packed sentences is a chore. The convention limits length ([the agent rules](usage.md#for-agents)) because long prose stops being read, and prose that isn't read stops being kept.

**One marker.** The convention has `@prose` and nothing else. Plan state, sections and progress come from structure: a prose block with no code under it is a plan item, a heading is a section, filled code is done. A `@todo`, `@decision` or `@note` marker would be one more thing to keep in sync; decisions go into the prose they change.

**Standard files, not a toolchain.** Adopting a new file type or compiler breaks `tsc`, the language server, formatters, linters and every other standard workflow. `@prose` is a comment, like JSDoc, so every tool keeps working.

**How it got this small.** 0.1.0 was much more: a dev route inside the app's Vite server, notes written back into source, mechanical checks, a planned review view. Used on real projects, most of it went unused, and what was read was the `docs/` and the `@prose` blocks. [lessons.md](lessons.md) has the evidence.

## Scope

| In                                                                                  | Out                                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `@prose` in `.ts`, `.js`, `.css`, `.html`, `.svelte`, `.yaml`/`.yml`, `.toml`, `.sh`, `.py`, `.gitignore`      | New file types, tangling, `.ts.md`                       |
| Rendering any repository read-only: Markdown, source with its prose, other text     | Editing anything, notes, review state                    |
| Local reading, and the same pages as a static site (`prose build`) | Hosting and deploys; a docs site with its own navigation |
| First paragraphs as summaries                                                       | Checks, coverage reports, LLM summaries                  |

Target: one person's repositories, up to about 500 files.

## What's out, and why

0.1.0 built all of this. Each is out with its reason, so it isn't rebuilt by default; [lessons.md](lessons.md) has the detail.

- **Editing, from the browser or anywhere else.** The repository is the source of truth, changed by the editor and the agent.
- **A dev route inside the app's Vite server, on Devframe** (typed RPC, synced state, a Svelte client). It needed the app running and was rarely opened; a standalone renderer on any repo replaces it.
- **`@note` annotations in source.** Discussion happened in the chat over several turns, and the agent wrote the outcome into the prose. In two repos, one note sat open for weeks and the other had none.
- **Checks** (unresolved symbols, git-blame staleness, reference and duplication checks) **and a `prose check` CLI.** They never ran in the field repos. The one real drift found was about meaning, which no mechanical check catches; the agent updates prose and code together, so staleness rarely fires; a site generator can check links when it publishes.
- **A *since* view for reviewing changes.** The human didn't review block by block; they read the prose that says what the code means now.
- **Agent-written dev tools and an import-graph diagram.** Never built; nothing asked for them.
- **The Vite plugin that stripped `@prose` from built HTML.** Only hand-written `.html` needs it ([writing.md](writing.md#prose-blocks)).
- **A docs site, hosting and deploys.** `prose build` writes the reader as it is, into `.prose`; deploying it is not prose's job ([usage.md](usage.md#deploying-this-site)), and there is no `prose publish`: the one site that could have used a command to commit it to a branch deploys without one. Pinning `docs/` above the file tree, in the order `docs/README.md` lists, is as far as navigation goes; a site with its own navigation, pages beyond the repository's and design is a static site generator's job ([writing.md](writing.md#writing-that-spans-the-code)), and where the files are hosted is the host's.
- **A host's own files, and a deploy command per host.** The build is plain pages, with no `CNAME`, no `.nojekyll`, no host config. Each host's files, credentials and rules change on its own schedule, so prose writes none of them; a project keeps its host's config in its own repository, as this one does ([usage.md](usage.md#deploying-this-site)).
- **The view in the URL (`?view=prose`).** The **Prose & Code / Prose only** switch is the reader's own setting, kept in their browser. A link that carried it either passed the sharer's setting to whoever opened it, or, with the switch left out of the address, made the address and the page disagree; both were confusing when sharing.
