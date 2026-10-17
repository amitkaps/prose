# Agents

How to work in this repository. It covers the standard and prose rules every repository shares, how this one applies them, then its commands and workflow.

## Standard

This repository follows the standard at [ship](https://ship.amitkaps.com), which sets how every repository builds, checks and deploys. Read [the standard](https://ship.amitkaps.com/docs/standard.md) before changing any of that.

- Change the toolchain, scripts, versions or deploys in ship first, then bring each repository in line. Don't change them in one repository alone.
- Open a pull request with `pnpm pr "<title>"`. It branches from `main`, commits, runs `pnpm run verify`, pushes and turns on auto-merge, and the pull request is squash-merged once CI passes. Nobody pushes to `main`. After a merge, `pnpm gone` deletes the merged branches.
- In a package, give it one label for the release notes, `pnpm pr "<title>" --label <label>`: `breaking`, `added`, `fixed`, `improved`, `docs`, or `internal` for tests, tooling, site and lessons. CI fails without one.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A held check on ship's page is a tool's limit, not a choice. Leave it until its reason goes away.

## Prose

Explanations go in `@prose` comments, written to the rules in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents). Read them before writing prose. They live there and aren't copied here, so every repository writes to the same rules.

After writing prose, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better. It always passes, so it's advice, not a check.

## This repository's prose

The rules live in [docs/usage.md](docs/usage.md#for-agents), the one copy every repository links to. Change them there. The renderer and the docs are the product, so a change that leaves prose stale is unfinished.

For this repository that means:

- `docs/` is where writing that spans files lives. Reference a section by file and heading, like `docs/reading.md#pages`, never by a number.
  - [design](docs/design.md) says what it is, why, and what it isn't.
  - [writing](docs/writing.md) has the `@prose` rules, and [usage](docs/usage.md) how to use prose.
  - [reading](docs/reading.md) says what each page shows.
  - [plan](docs/plan.md) has the order of the work, and [lessons](docs/lessons.md) what it taught.
  - [development](docs/development.md) covers build and release.
- Every folder has a `README.md`, except `.github/`. Its workflows carry their own prose, and [development](docs/development.md) covers them. `src/` and `tests/` say what lives there and how it's organised.
- Tests carry file prose too. It says what the file covers, in a line or two.

## Commands

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command
pnpm run prose         # read this repository with the command build wrote
```

`tests/build.test.ts` and `tests/server.test.ts` run against the committed `tests/fixtures/simple`, since `prose build` reads `HEAD`. Commit a change to the fixture before testing it.

## Workflow

Branch, commit, push, `gh pr create`, then `gh pr merge --auto --squash`. Run `pnpm run check` and `pnpm run test` first. Land stacked PRs one at a time, bottom-up, waiting for each to merge before branching the next.
