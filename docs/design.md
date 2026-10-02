# Design

Prose lets coding agents explain the code they write. It lets a human read the resulting repository as a document. This page says what it is, why it's built this way, and what it isn't.

## What it is

Prose is two things, and nothing else is required.

- **`@prose`**, a convention for writing human-oriented meaning into source code. A comment whose first token is `@prose` explains the code below it, in Markdown. It works in `.ts`, `.js`, `.css`, `.html`, `.svelte`, `.yaml` and `.toml` files, and in `.gitignore` ([writing.md](writing.md)).
- **`prose`**, a read-only renderer. It shows any repository in the browser as a Markdown-first document, with each source file's prose in order and its code between. `prose .` reads a repository locally, and `prose build` writes the same pages as a static site ([usage.md](usage.md), [reading.md](reading.md)).

The first paragraph of every file, folder, prose block and doc is its summary. Together, those summaries are the map of the project.

It is built for one person's repositories, up to about 500 files.

## Why

**The human keeps the mental model by reading prose, not code.** One person works with coding agents that change code faster than anyone can read it. The human needs a model of the whole design: what the project promises, how it fits together, and why. The agent writes the code and most of the prose. The human reads the prose and gives direction in the chat.

**The agent explains as it builds.** The human gives direction, and the agent changes the code. In the same change, the agent updates the `@prose` next to that code and any doc the change affects. The human reads the result and redirects. The explanation sits in the code it explains, so a diff that changes one without the other shows it.

**The browser is a reading surface.** The repository is the source of truth, and the human's editor and the agent's tools change it. The renderer edits nothing and keeps no state. It doesn't replace grep or the agent's own reading. It gives the human a better way to read.

**Short prose is what makes it work.** A short doc of what the project promises fits in the human's head. Decisions can then be argued from what the project promises, not from taste. A first paragraph of three plain lines is a map, but three packed sentences are a chore. So the [agent rules](usage.md#for-agents) limit both length and density. Long prose stops being read, and prose that isn't read stops being kept.

**One marker.** The convention has `@prose` and nothing else, and a Markdown heading is all the structure a comment needs. A `@todo`, `@decision` or `@note` marker would be one more thing to keep in sync. Decisions go into the prose they change.

**Standard files, not a toolchain.** A new file type or compiler breaks `tsc`, the language server, formatters, linters and every other standard tool. `@prose` is a comment, like JSDoc, so every tool keeps working.

## What it isn't

Most of these were built or planned once, and dropped. Each keeps a one-line reason here, so nobody rebuilds it by default. [lessons.md](lessons.md#what-use-taught) has the evidence.

- **Not an editor.** The human's editor and the agent change the repository. So prose has no editing, no notes in the source and no review of changes. Discussion happens in the chat, and the prose says what the code means now.
- **Not a checker.** No symbol or staleness checks, coverage reports or LLM summaries. The one real drift found in use was about meaning, which no mechanical check catches.
- **Not a site generator or a host.** Navigation stops at the bar's links to the docs. A site with its own navigation and design needs a static site generator ([writing.md](writing.md#folders-and-docs)). Deploying, and each host's config, belong to the project ([usage.md](usage.md#deploying-this-site)).
- **Not a new file format.** No `.ts.md` and no tangling. `@prose` stays a comment, so standard tools keep working.
- **Not part of the app.** No dev route in the app's server, no build plugin and no custom dev tools. The renderer reads any repository without the app running.
