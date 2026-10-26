# Agents

How to work in this repository. It covers craftz's and prose's rules, which every repository shares, how this one applies them, then its commands.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md). Run `pnpm craftz rules` before changing the toolchain, scripts, versions, CI or deploys, and change them in craftz first, never in one repository alone.

- Open a pull request with `pnpm pr "<title>"`, and add `--label <label>` in a package. It commits, runs `pnpm run verify`, pushes and turns on auto-merge. Don't wait for the merge, and add `--wait` to a session's last change. Nobody pushes to `main`.
- `pnpm craftz status` says what's live. `pnpm <tool> help <command>` says what a command does, for the version installed.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.

## Prose

Explanations go in `@prose` comments, and every Markdown file is prose too.

- Run `pnpm prose rules` before your first edit to a `@prose` comment or a `.md` file, and again after the conversation is summarized. Changing code a `@prose` comment explains counts as an edit.
- After writing, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better.

## Outline

Every file in this repository with its summary, which `pnpm run verify` writes. Run `pnpm prose outline` when it's missing.

@outline.md

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

The map of every file and its summary is `outline.md`, which `pnpm run verify` writes and git ignores, so run `pnpm prose outline` when there's none. Claude Code reads it here.

@outline.md

## Commands

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command
pnpm run prose         # read this repository with the command build wrote
```

`tests/build.test.ts` and `tests/server.test.ts` run against the committed `tests/fixtures/simple`, since `prose build` reads `HEAD`. Commit a change to the fixture before testing it.
