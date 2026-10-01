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
git tag v0.3.0 && git push origin v0.3.0
```

The `release` workflow verifies the tag matches `package.json`, runs the checks and tests, builds, publishes `@amitkaps/prose` to npm and attaches `amitkaps-prose-<version>.tgz` to a GitHub Release. The site needs no step of its own: Cloudflare builds it from `main` ([usage](usage.md#deploying-this-site)).

### Publishing to npm

The workflow stages the version on npm with trusted publishing (OIDC, with provenance), so there is no token and no way for CI to release by itself: a maintainer approves each version, with 2FA, in the **Staged Packages** tab on npmjs.com or with `npm stage approve <id>`.

Set it up once, in the package's settings on npmjs.com: a trusted publisher for the repository `amitkaps/prose` and the workflow `release.yml`, with direct publishing (`npm publish`) and dist-tags left unchecked, so staging is all it can do. If npm won't take the setting before the package exists, publish the first version by hand, from a folder outside the repository (`npm` refuses to run inside it, since `devEngines` names pnpm), then set the publisher:

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/prose/amitkaps-prose-<version>.tgz --access public
```

The workflow skips a version that is already on the registry.
