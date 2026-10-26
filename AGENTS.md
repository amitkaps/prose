# Agents

How to work in this repository. It covers craftz's and prose's rules, which every repository shares, how this one applies them, then its commands and workflow.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md), which set how every repository builds, checks, deploys and releases. Run `pnpm craftz rules` before changing any of that. It prints the rules for the version this repository installs, and `pnpm craftz rules <id>` prints one.

- Change the toolchain, scripts, versions or deploys in craftz first, then bring each repository in line. Don't change them in one repository alone.
- Open a pull request with `pnpm pr "<title>"`. It branches from `main`, or adds to the branch's open pull request when given its title, then commits, runs `pnpm run verify`, pushes and turns on auto-merge, and the pull request is squash-merged once CI passes. Don't wait for the merge: start the next change, and its `pnpm pr` waits only if the last hasn't merged. Add `--wait` to the last change of a session, to end on `main`. `pnpm pr` first deletes the local branches that merged, and `pnpm gone` does that alone. Nobody pushes to `main`.
- To see what's live, run `pnpm craftz status`: CI, pull requests, the release and the site. `--notes` adds the release's notes, and `--log` the build's log. Use it rather than reading GitHub, npm or Cloudflare another way.
- In a package, give it one label for the release notes, `pnpm pr "<title>" --label <label>`: `breaking`, `added`, `fixed`, `improved`, `docs`, or `internal` for tests, tooling, site and lessons. CI fails without one.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- `pnpm <tool> help` lists a tool's commands, and `pnpm <tool> help <command>` says what one does, for the version installed.
- A held check is a tool's limit, not a choice. The rules give its reason, so leave it until the reason goes away.

## Prose

Explanations go in `@prose` comments. Run `pnpm prose rules` before writing prose, or changing code a `@prose` comment explains. It prints the rules for the version this repository uses, each with the codes that check it, and `pnpm prose rules <code>` says what one warning asks for. The rules live in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents) and aren't copied here, so every repository writes to the same rules.

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

## Workflow

Branch, commit, push, `gh pr create`, then `gh pr merge --auto --squash`. Run `pnpm run check` and `pnpm run test` first. Land stacked PRs one at a time, bottom-up, waiting for each to merge before branching the next.
