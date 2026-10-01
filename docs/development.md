# Development

How to work on Prose itself: build it, test it, and cut a release. The rules for changing it, including the prose rules it follows, are in [AGENTS.md](../AGENTS.md).

## Build and test

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command (vp pack)
node dist/cli.js .     # read this repository with prose
```

The build and server tests run against the committed [`tests/fixtures/simple`](../tests/fixtures/simple/), since `prose build` reads `HEAD`: commit a change to the fixture before testing it.

## Release

Bump `version` in `package.json`, merge to `main`, then tag and push:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The `release` workflow verifies the tag matches `package.json`, runs the checks and tests, builds, and attaches `amitkaps-prose-<version>.tgz` to a GitHub Release. Then publish the site:

```sh
node dist/cli.js publish && git push origin prose
```
