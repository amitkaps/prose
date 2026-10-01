# prose

Coding agents change code faster than a person can read it, so the model of the design drifts. Prose keeps it readable: the agent writes the explanation next to the code it explains, and a read-only renderer shows the repository as a document. This repository is read that way at [prose.amitkaps.com](https://prose.amitkaps.com).

## Where to go

- [Design](docs/design.md): why it is built this way, and what it leaves out.
- [Usage](docs/usage.md): set it up on a project, deploy its site, and the snippet to give your agents.
- [Writing](docs/writing.md): how to write `@prose`, in every language.
- [Reading](docs/reading.md): what each page of the renderer shows.

Where it is and what is next: the [plan](docs/plan.md). What building it taught: [lessons](docs/lessons.md). The rest is in [docs/](docs/README.md); building and releasing it is in [development](docs/development.md).

## Two things

- **`@prose`**, a convention for writing human-oriented meaning directly into source code. A comment whose first token is `@prose` is the maintained explanation of the code below it, and is written in [markz](https://markz.amitkaps.com)'s Markdown. Everything else stays an ordinary code comment.
- **`prose`**, a read-only renderer that opens any repository in the browser as a Markdown-first document, locally or as a static site. It shows each file as one document: the prose in order, with the code between it.

```ts
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
let count = 0;
```

## Install and run

The current Node and the previous LTS (today, 26 and 24):

```sh
npm install -g @amitkaps/prose
prose .            # read this repository in the browser
prose build        # the same pages as static files, from the last commit
```

Or without installing: `npx @amitkaps/prose .`.
