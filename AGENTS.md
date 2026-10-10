# Agents

How to work in this repository: the standard and prose rules every repository shares, how this one applies them, then its commands and workflow.

## Standard

This repository follows the standard at [ship](https://ship.amitkaps.com), which sets how every repository builds, checks and deploys. Read [ship's docs/standard.md](https://github.com/amitkaps/ship/blob/main/docs/standard.md) before changing any of that.

- Change the toolchain, scripts, versions or deploys in ship first, then bring each repository in line. Don't change them in one repository alone.
- Work on a branch and open a pull request. CI runs `pnpm run verify`, which must pass, and the pull request is squash-merged. Nobody pushes to `main`.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A held check on ship's page is a tool's limit, not a choice. Leave it until its reason goes away.

## Prose

Explanations go in `@prose` comments, written to the rules in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents). Read them before writing prose. They live there and aren't copied here, so every repository writes to the same rules.

## This repository's prose

The rules live in [docs/usage.md](docs/usage.md#for-agents), the one copy every repository links to. Change them there. The renderer and the docs are the product, so a change that leaves prose stale is unfinished.

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
pnpm run prose         # read this repository with prose
pnpm run preview       # build, then read it
```

`tests/build.test.ts` and `tests/server.test.ts` run against the committed `tests/fixtures/simple`, since `prose build` reads `HEAD`. Commit a change to the fixture before testing it.

## Workflow

Branch, commit, push, `gh pr create`, then `gh pr merge --auto --squash`. Run `pnpm run check` and `pnpm run test` first. Land stacked PRs one at a time, bottom-up, waiting for each to merge before branching the next.
