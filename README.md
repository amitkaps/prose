# Prose

Coding agents change code faster than a person can read it, so the human's model of the design drifts. Prose keeps that model readable. The agent writes the explanation next to the code it explains, and a read-only renderer shows the repository as a document. This repository is read that way at [prose.amitkaps.com](https://prose.amitkaps.com).

## Where to go

- [Design](docs/design.md): what it is, why it's built this way, and what it isn't.
- [Usage](docs/usage.md): set it up on a project, deploy its site, and the snippet to give your agents.
- [Writing](docs/writing.md): how to write `@prose`, and what to put in it.
- [Reading](docs/reading.md): what each page of the renderer shows.

The [plan](docs/plan.md) has where it is and what's next, and [lessons](docs/lessons.md) has what building it taught. The rest is in [docs/](docs/README.md), and building and releasing prose itself is in [development](docs/development.md).

## Two things

- **`@prose`**, a convention for writing human-oriented meaning into source code. A comment whose first word is `@prose` explains the code around it, in [markz](https://markz.amitkaps.com)'s Markdown. Every other comment stays an ordinary comment.
- **`prose`**, a read-only renderer that opens any repository in the browser as a Markdown-first document, locally or as a static site. Each file reads as one document, with its prose in order and the code between.

```ts
/** @prose
 * # State
 *
 * One count for the whole page, so every button changes the same number.
 */
let count = 0;
```

## Install and run

It runs on the current Node and the previous LTS, which today are 26 and 24.

```sh
npm install -g @amitkaps/prose
prose .            # read this repository in the browser
prose build        # the same pages as static files, from the last commit
```

Or without installing: `npx @amitkaps/prose .`.
