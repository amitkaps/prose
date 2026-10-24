# Prose

Keep your mental model while agents write the code. Prose puts the why beside the code. The agent writes the explanation next to the code it explains, and reads it again as it works. A read-only command shows the repository as a document.

[prose.amitkaps.com](https://prose.amitkaps.com) is this repository, read with prose. Open [src/parser.ts](https://prose.amitkaps.com/src/parser.ts) to see a source file as one document, with its prose in order and the code between.

## Where to go

- [Design](docs/design.md): what it is, why it's built this way, and what it isn't.
- [Usage](docs/usage.md): set it up on a project, deploy its site, and the snippet to give your agents.
- [Writing](docs/writing.md): how to write `@prose`, and what to put in it.
- [Reading](docs/reading.md): what each page of the renderer shows.

The [plan](docs/plan.md) has where it is and what's next, and [lessons](docs/lessons.md) has what building it taught. The rest is in [docs/](docs/README.md), and building and releasing prose itself is in [development](docs/development.md).

## Two things

- **`@prose`**, a convention for writing human-oriented meaning into source code. A comment whose first word is `@prose` explains the code around it, in [markz](https://markz.amitkaps.com)'s Markdown. Every other comment stays an ordinary comment.
- **`prose`**, a read-only command. It opens any repository in the browser as a Markdown-first document, locally or as a static site. Each file reads as one document, with its prose in order and the code between. `prose check` warns about form a machine can be sure of, and `prose style` gives advice on sentences.

```ts
/** @prose
 * # State
 *
 * One count for the whole page, so every button changes the same number.
 */
let count = 0;
```

## Install and run

prose needs Node 26 or newer, the Node it's built and tested on.

```sh
npm install -g @amitkaps/prose
prose .            # read this repository in the browser
prose build        # the same pages as static files, from the last commit
prose check        # what the text gets wrong, by file and line
prose style        # advice on how the text reads
prose rules        # the rules to write prose by, for an agent
```

Or without installing: `npx @amitkaps/prose .`.

`prose check` fails when it finds anything, so it can run in CI. `prose style` is for the writer of a file, right after writing it, and always passes ([usage](docs/usage.md#style)). `prose rules` prints the rules from the docs of the version installed ([usage](docs/usage.md#for-agents)). `prose help` lists every command ([usage](docs/usage.md#help)).
