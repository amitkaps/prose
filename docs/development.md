# Development

How to work on Prose itself: build it, test it, and cut a release. The rules for changing it, including the prose rules it follows, are in [AGENTS.md](../AGENTS.md).

## Toolchain

[`mise.toml`](../mise.toml) names the Node and pnpm to work with; `packageManager` in `package.json` names the same pnpm for CI and for Corepack. They move together, so a pnpm bump changes both. Prose supports the current Node and the previous LTS (today 26 and 24): `engines` says `>=24`, `@types/node` follows the older one, and CI runs the tests on both.

## Build and test

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command (vp pack)
node dist/cli.js .     # read this repository with prose
```

The build and server tests run against the committed [`tests/fixtures/simple`](../tests/fixtures/simple/), since `prose build` reads `HEAD`: commit a change to the fixture before testing it.

## Workflows

Two, in [`.github/workflows/`](../.github/workflows/); each file says what it does in its own prose.

- `ci.yml`: format, lint and types, the tests and the build, on every pull request and push to `main`. Branch protection requires the `ci` check by that name.
- `release.yml`: on a `v*` tag, checks the tag matches `package.json`, runs the checks and tests, builds, and attaches the `.tgz` to a Release.

## Release

Bump `version` in `package.json`, merge to `main`, then tag and push:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The `release` workflow verifies the tag matches `package.json`, runs the checks and tests, builds, and attaches `amitkaps-prose-<version>.tgz` to a GitHub Release. Then publish the site:

```sh
node dist/cli.js publish && git push origin prose
```
