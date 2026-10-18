# Design

Prose lets coding agents explain the code they write. It lets a human read the resulting repository as a document. Agents read the same prose as they work.

## What it is

Prose is two things, and nothing else is required.

- **`@prose`**, a convention for writing human-oriented meaning into source code. A comment whose first token is `@prose` explains the code below it, in Markdown. It works in the languages [writing.md](writing.md#in-each-language) lists.
- **`prose`**, a read-only command. `prose .` shows any repository in the browser as a Markdown-first document, with each source file's prose in order and its code between. `prose build` writes the same pages as a static site ([usage.md](usage.md), [reading.md](reading.md)). `prose check` warns about form a machine can be sure of, and `prose style` gives advice on sentences.

It is built for one person's repositories, up to about 500 files. Every page carries the whole file tree, so a site grows with the square of its file count.

## Why

**Agents change code faster than anyone can read it.** One person works with coding agents. The human needs a model of the whole design: what the project promises, how it fits together, and why. Decisions happen in the chat. In the same change, the agent updates the code, the `@prose` next to it and any doc the change affects. The human keeps the model from the chat and the docs, and the agent keeps it from the same docs and prose. The explanation sits in the code it explains, so a diff that changes one without the other shows it.

**Short prose is what makes it work.** A short doc of what the project promises fits in the human's head. Decisions can then be argued from what the project promises, not from taste. The first paragraph of every file, folder, prose block and doc is its summary, and together those summaries are the map of the project. A first paragraph of three plain lines is a map, but three packed sentences are a chore. So the [agent rules](usage.md#for-agents) limit both length and density. Long prose stops being read, and prose that isn't read stops being kept.

**The browser is a reading surface.** The repository is the source of truth, and the human's editor and the agent's tools change it. The renderer edits nothing and keeps no state. It doesn't replace grep or the agent's own reading. Its pages serve the human reading the design and a user learning the tool, with nothing written twice.

**One marker.** The convention has `@prose` and nothing else, and a Markdown heading is all the structure a comment needs. A `@todo`, `@decision` or `@note` marker would be one more thing to keep in sync. Decisions go into the prose they change.

**Standard files, not a toolchain.** A new file type or compiler breaks `tsc`, the language server, formatters, linters and every other standard tool. `@prose` is a comment, like JSDoc, so every tool keeps working.

**The trade-offs are accepted.** Prose can go stale silently, since nothing checks that it's true. It holds only as long as agents keep the rules. It serves one reader, not a team. The items below follow from these costs.

## What it isn't

Prose leaves some jobs to other tools. Each item names one, says why in a line, and links to what use taught about it.

- **Not an editor.** The human's editor and the agent change the repository. So prose has no editing, no notes in the source and no review of changes. Discussion happens in the chat, and the prose says what the code means now ([lessons](lessons.md#where-decisions-live)).
- **Not a checker of meaning.** The one real drift found in use was about meaning, which no mechanical check catches. So there are no staleness checks, coverage percentages or LLM summaries ([lessons](lessons.md#keeping-prose-true), [usage](usage.md#warnings)).
- **Not a site generator or a host.** Navigation stops at the bar's links to the docs. A site with its own navigation and design needs a static site generator ([writing.md](writing.md#folders-and-docs)). Deploying, and each host's config, belong to the project ([lessons](lessons.md#publishing), [usage.md](usage.md#build)).
- **Not a new file format.** No `.ts.md` and no tangling. `@prose` stays a comment, so standard tools keep working.
- **Not part of the app.** No dev route in the app's server, no build plugin and no custom dev tools. The renderer reads any repository without the app running ([lessons](lessons.md#what-gets-read)).
