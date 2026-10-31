# Agents

How to work in this repository. It covers craftz's and prose's rules, which every repository shares, how this one applies them, then its commands.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md). Before writing a command or a test, or changing the toolchain, scripts, versions, CI or deploys, run `pnpm craftz rules <part>` for the part you touch. Each part prints with `practice`, which holds for any change. Change those in craftz first, never in one repository alone.

The parts are `axes`, `toolchain`, `pnpm`, `other` (versions), `holds`, `scripts`, `cloudflare`, `github`, `agents`, `docs`, `releases`, `ci` and `repositories`. `pnpm craftz rules` prints all of them.

- Before starting a change, run `pnpm gone`. It switches to `main`, pulls, and deletes the branches that merged, so the change starts from what's live.
- Open a pull request with `pnpm pr "<title>"`, and add `--label <label>` in a package. It commits, runs `pnpm run verify`, pushes and turns on auto-merge, so don't run verify first. When verify fails, fix what it found and run `pnpm pr` again. Don't wait for the merge, and add `--wait` to a session's last change. Nobody pushes to `main`.
- `pnpm craftz status` says what's live. `pnpm <tool> help <command>` says what a command does, for the version installed.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs. To see a page you built, run `pnpm craftz shot <url> <file.png>` and read the PNG, rather than installing a browser tool.
- A lesson in `docs/lessons.md` is for what the next change would get wrong without it, so a change that went as planned adds none. Read its group first. When a lesson there says it already, add this case to it, and give the principle a check or a rule.

## Prose

Explanations go in `@prose` comments, and every Markdown file is prose too.

- Run `pnpm prose rules` once before your first edit to a `@prose` comment or a `.md` file, and again after the conversation is summarized. A code change counts only when it changes what the comment states, so a rename or a lint fix doesn't.
- After writing prose, run `pnpm prose style <files>` on those files, and take its advice where it reads better. It's advice and never fails. `prose check` runs in `verify` and does, like a folder with no `README.md`.
- `outline.md` is the repository as a tree, each file with its `@prose` summary. `pnpm pr` and `pnpm gone` write it. Before you search for code by what it does, read the part of it for the folder you expect it in.

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
pnpm run test:e2e      # the accessibility and keyboard checks, in Chromium (about two minutes)
pnpm run prose         # read this repository with the command build wrote
```

`tests/build.test.ts` and `tests/server.test.ts` run against the committed `tests/fixtures/simple`, since `prose build` reads `HEAD`. Commit a change to the fixture before testing it.
