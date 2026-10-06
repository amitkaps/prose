# Development

How to work on prose itself: build it, test it, release it and deploy its site. The rules for changing it, including the prose rules it follows, are in [AGENTS.md](../AGENTS.md).

## Toolchain

`package.json` says what the repository needs. `devEngines` names the Node and pnpm to develop with, and `engines` names the Node range the published command runs on. mise reads the Node version from `devEngines`, with its `idiomatic_version_file_enable_tools` setting on for `node`, so there's no `mise.toml`. `packageManager` repeats the exact pnpm version for CI's `pnpm/action-setup`.

prose installs as one package, with no dependencies. markz is a dev dependency, so the build bundles it into `dist/`. Anything else it needs is written here, or bundled the same way.

prose supports the current Node and the previous LTS, which today are 26 and 24. So `engines` and `devEngines` say `>=24`, `@types/node` follows the older one, and CI runs the tests on both.

## Build and test

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command (vp pack)
node dist/cli.js .     # read this repository with prose
pnpm run preview       # build, then read it
pnpm run axe           # the accessibility audit, in Chrome
pnpm run keyboard      # the keyboard check, in Chrome
```

The build and server tests run against the committed [`tests/fixtures/simple`](../tests/fixtures/simple/), because `prose build` reads `HEAD`. Commit a change to the fixture before testing it.

## Workflows

There are two, in [`.github/workflows/`](../.github/workflows/), and each file's own prose says what it does.

- **`ci.yml`** runs the format, lint and type checks, the tests and the build, then checks the package with publint. It runs on every pull request and every push to `main`. Branch protection requires the check by its name, `ci`.
- **`release.yml`** runs on a `v*` tag. It checks that the tag matches `package.json`, runs the checks and tests, and builds. Then it stages the version on npm and attaches `amitkaps-prose-<version>.tgz` to a GitHub Release.

## What ships

The package is one bundle with no dependencies, about 180 KB unpacked. It's readable code without its prose, the same choice the page's own files follow.

- **Bundled.** markz is inside `dist/`, so installing prose fetches one package. A fix in markz reaches prose's users with prose's next release.
- **Not minified.** A bundler that takes prose in minifies it for its own app, and anyone reading `node_modules` can follow the code.
- **No comments, but a license.** The build strips comments from the code, but keeps license comments and annotations like `@__PURE__` ([vite.config.ts](../vite.config.ts)). A `/*!` banner names the license, so it stays with the code if another build bundles prose.
- **Types with their documentation.** `dist/index.d.ts` keeps the comment above each export, `@prose` included, so an editor shows it on hover. Nothing strips it. Each export's comment is written for that use ([writing](writing.md#in-each-language)).
- **No sourcemaps.** They would carry every source file whole, prose included, at twice the size of the code. The source is on GitHub.

CI runs [publint](https://publint.dev) on the packed tarball, fetched for the step, not installed. It checks `exports`, `files` and the types. arethetypeswrong was ruled out, because it tests old Node resolution that an ESM package for Node 24 and up doesn't support.

## Release

Run `pnpm run axe` and `pnpm run keyboard` first, and fix what they find. The audit runs axe on every page of this site, in both colour schemes, at a desktop and a phone width ([tests/axe.ts](../tests/axe.ts)). The keyboard check reads a page of each kind with Tab, Enter, Space and Esc ([tests/keyboard.ts](../tests/keyboard.ts)). Both need Chrome on the machine, so they aren't in CI yet. Running them in the release workflow could come later.

Bump `version` in `package.json` and merge to `main`. Then tag the release and push the tag.

```sh
git tag v0.3.0 && git push origin v0.3.0
```

The `release` workflow does the rest. The site needs no step of its own, because Cloudflare builds it from `main` ([the site](#the-site)).

### Publishing to npm

The workflow stages each version on npm with trusted publishing, which uses OIDC and adds provenance. There's no token, and CI can't release on its own. A maintainer approves each version with 2FA, in the **Staged Packages** tab on npmjs.com or with `npm stage approve <id>`.

Set this up once, in the package's settings on npmjs.com. Add a trusted publisher for the repository `amitkaps/prose` and the workflow `release.yml`. Leave direct publishing (`npm publish`) and dist-tags unchecked, so staging is all it can do.

npm may not take that setting before the package exists. If so, publish the first version by hand, then set the publisher. Run it from a folder outside the repository, because `npm` refuses to run in one whose `devEngines` names pnpm.

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/prose/amitkaps-prose-<version>.tgz --access public
```

The workflow skips a version that's already on the registry.

## The site

[prose.amitkaps.com](https://prose.amitkaps.com) is this repository read with prose, on a Cloudflare Worker with static assets. It builds from `main`, so its configuration is a file in the repository, [wrangler.toml](../wrangler.toml). Every merge deploys it.

In Cloudflare, create a Worker named `prose` from the repository, with these settings.

- **Production branch:** `main`
- **Build command:** `pnpm install && pnpm run build && node dist/cli.js build`
- **Deploy command:** `pnpm dlx wrangler deploy`

Then set the domain on the Worker, in the dashboard. `wrangler.toml` sets up the two things [usage](usage.md#build) asks of a host. It points the Worker at `.prose`, serves `404.html` for a missing address, and serves `/src/store.ts` from `src/store.ts.html`. The deploy command uses `pnpm dlx`, not `npx`, because `npx` refuses to run in a repository whose `devEngines` names pnpm.
