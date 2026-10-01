# Agents

How to work in this repository: the prose rules it ships, which it follows itself, then its commands and workflow. `CLAUDE.md` imports this file.

## Prose

The same rules as [docs/usage.md](docs/usage.md#for-agents), the snippet we tell other projects to copy. If they change, change both. The renderer and the docs are the product, so a change that leaves prose stale is unfinished.

- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose block, file, folder and doc begins with a short first paragraph that is its summary for the human: about three lines, one idea per sentence. It says what the node means, not what its code does; detail goes in the chunks below. When a change alters a node's role, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments, in markz's Markdown. Ordinary comments stay for code-level notes.
- Prose says what the code can't: why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change: into the doc they change when they span files, into the `@prose` block when they concern one spot. Write docs for a reader who wasn't in the chat, since they may be published as they are. Keep the promises doc short, and update its non-goals when something is ruled out.
- Keep the plan current: what's done in one line each, what's next in order. Work that belongs to one file can be a pending chunk there instead.
- To find your way: `grep -rn -A4 "@prose" src` is the map; `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet.

For this repository that means:

- `docs/` is where writing that spans files lives: [design](docs/design.md) (why, and what's out), [convention](docs/convention.md) (the `@prose` rules), [usage](docs/usage.md), [spec](docs/spec.md) (what each page shows), [plan](docs/plan.md) (the order of the work), [lessons](docs/lessons.md), [development](docs/development.md) (build and release). Reference a section by file and heading (`docs/spec.md#pages`), never by a number.
- Every folder has a `README.md`, except `.github/` (the workflows carry their own prose, and [development](docs/development.md) covers them). `src/` and `tests/` say what lives there and how it's organised.
- Tests carry file prose too: what the file covers, in a line or two.
- A first paragraph is for the human reading a folder listing. If it's more than three lines, or says what the code does instead of what the file means, rewrite it.
- Cite a rule once, where it's first needed, and link to it. Don't repeat the same link in every block.

## Commands

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command
node dist/cli.js .     # read this repository with prose
```

`tests/build.test.ts` and `tests/server.test.ts` run against the committed `tests/fixtures/simple`, since `prose build` reads `HEAD`. Commit a change to the fixture before testing it.

## Workflow

`main` is protected: a pull request is required and the `ci` check must pass. Never commit or push to `main`. Branch, commit, push, `gh pr create`, then `gh pr merge --auto --squash`. Run `pnpm run check` and `pnpm run test` first. Land stacked PRs one at a time, bottom-up, waiting for each to merge before branching the next.
