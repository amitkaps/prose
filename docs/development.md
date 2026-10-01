# Development

How to work on Prose itself: build it, test it, and cut a release. The rules for changing it, including the prose rules it follows, are in [AGENTS.md](../AGENTS.md).

## Toolchain

`package.json` says what the repository needs: `devEngines` the Node and pnpm to develop with, `engines` the Node range the published command runs on. mise reads the Node version from `devEngines`, with its `idiomatic_version_file_enable_tools` setting on for `node`; there's no `mise.toml`. `packageManager` repeats the exact pnpm version for CI's `pnpm/action-setup`. Prose supports the current Node and the previous LTS (today 26 and 24): `engines` and `devEngines` say `>=24`, `@types/node` follows the older one, and CI runs the tests on both.

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
- `release.yml`: on a `v*` tag, checks the tag matches `package.json`, runs the checks and tests, builds, publishes to npm and attaches the `.tgz` to a Release.

## Release

Bump `version` in `package.json`, merge to `main`, then tag and push:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The `release` workflow verifies the tag matches `package.json`, runs the checks and tests, builds, publishes `@amitkaps/prose` to npm and attaches `amitkaps-prose-<version>.tgz` to a GitHub Release. Then publish the site:

```sh
node dist/cli.js publish && git push origin prose
```

### Publishing to npm

The workflow publishes with npm's trusted publishing (OIDC, with provenance), so there is no token. npm only lets you set a trusted publisher on a package that exists, so the first version is published by hand, from a folder outside the repository (`npm` refuses to run inside it, since `devEngines` names pnpm):

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/prose/amitkaps-prose-<version>.tgz --access public
```

Then, on npmjs.com, set the package's trusted publisher to the repository `amitkaps/prose` and the workflow `release.yml`. After that a tag is all a release needs; the workflow skips a version that is already on the registry.
