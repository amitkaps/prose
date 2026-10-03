# Agents

How to work in this repository: the prose rules it ships, which it follows itself, then its commands and workflow.

## Prose

The same rules as [docs/usage.md](docs/usage.md#for-agents), the snippet we tell other projects to copy. If they change, change both. The renderer and the docs are the product, so a change that leaves prose stale is unfinished.

- Every source file opens with a `@prose` comment, its summary. Add more wherever the reader needs the why, like a design choice or an edge that's easy to get wrong. Trivial declarations, types, constants and mechanical helpers don't need one. A paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose comment, README and doc begins with a short first paragraph, its summary for the human, in about three lines. It says what the file or section means, not what its code does. Detail goes below it. When a change alters a file's role, rewrite that paragraph in the same change.
- Write plain sentences. Each one holds one idea, in about 25 words at most, in the active voice with a named subject. If a point doesn't fit, give it its own sentence or cut it. Don't join ideas with semicolons or colons, and keep parentheses for links and examples. Use one term for each concept, the one the docs already use.
- Prose goes in `@prose` comments, written in [markz's Markdown](https://markz.amitkaps.com/docs/syntax.md). Write `_emphasis_`, never `*emphasis*`, and no raw HTML. Ordinary comments stay for code-level notes.
- Prose says what the code can't. That's why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- A library ships the comment above each export in its types, as that export's documentation. So give every export a comment, and a one-line JSDoc is enough. Put a section's prose above the declaration it describes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted, and don't append. A change that only tunes code, with the same behaviour and the same stated costs, needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change. One that spans files goes into the doc it changes, and one about a single spot goes into the `@prose` there. Write docs for a reader who wasn't in the chat, since they may be published as they are. When something is ruled out, write down that it's out and why, so it isn't rebuilt.
- If the project keeps a plan, keep it current, with what's done in one line each and what's next in order.
- To find your way, `grep -rn -A4 "@prose" src` is the map, and `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet. Add an `--include` for each other language the project writes.

For this repository that means:

- `docs/` is where writing that spans files lives: [design](docs/design.md) (what it is, why, and what it isn't), [writing](docs/writing.md) (the `@prose` rules), [usage](docs/usage.md), [reading](docs/reading.md) (what each page shows), [plan](docs/plan.md) (the order of the work), [lessons](docs/lessons.md), [development](docs/development.md) (build and release). Reference a section by file and heading (`docs/reading.md#pages`), never by a number.
- Every folder has a `README.md`, except `.github/` (the workflows carry their own prose, and [development](docs/development.md) covers them). `src/` and `tests/` say what lives there and how it's organised.
- Tests carry file prose too: what the file covers, in a line or two.

## Commands

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command
node dist/cli.js .     # read this repository with prose
pnpm run preview       # build, then read it
```

`tests/build.test.ts` and `tests/server.test.ts` run against the committed `tests/fixtures/simple`, since `prose build` reads `HEAD`. Commit a change to the fixture before testing it.

## Workflow

`main` is protected: a pull request is required and the `ci` check must pass. Never commit or push to `main`. Branch, commit, push, `gh pr create`, then `gh pr merge --auto --squash`, or `--rebase` when a PR's commits should stay separate on `main`. Run `pnpm run check` and `pnpm run test` first. Land stacked PRs one at a time, bottom-up, waiting for each to merge before branching the next.
