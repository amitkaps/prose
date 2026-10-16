# Development

How to work on prose itself: build it, test it, release it and deploy its site. What every repository shares, like the toolchain, CI, the Worker's settings and releases, is in [ship's standard](https://ship.amitkaps.com/docs/standard.md), and isn't repeated here. The rules for changing it are in [AGENTS.md](../AGENTS.md).

## Build and test

```sh
pnpm install
pnpm run check         # format, lint and types
pnpm run test
pnpm run build         # the library and the command (vp pack)
pnpm run prose         # read this repository with the command build wrote
pnpm run axe           # the accessibility audit, in Chrome
pnpm run keyboard      # the keyboard check, in Chrome
```

The build and server tests run against the committed [`tests/fixtures/simple`](../tests/fixtures/simple/), because `prose build` reads `HEAD`. Commit a change to the fixture before testing it.

## What ships

The package is one bundle with no dependencies, about 200 KB unpacked. It's readable code without its prose, the same choice the page's own files follow.

- **Bundled.** markz is inside `dist/`, so installing prose fetches one package. A fix in markz reaches prose's users with prose's next release.
- **Not minified.** A bundler that takes prose in minifies it for its own app, and anyone reading `node_modules` can follow the code.
- **No comments, but a license.** The build strips comments from the code, but keeps license comments and annotations like `@__PURE__` ([vite.config.ts](../vite.config.ts)). A `/*!` banner names the license, so it stays with the code if another build bundles prose.
- **Types with their documentation.** `dist/index.d.ts` keeps the comment above each export, `@prose` included, so an editor shows it on hover. Nothing strips it. Each export's comment is written for that use ([writing](writing.md#in-each-language)).
- **No sourcemaps.** They would carry every source file whole, prose included, at twice the size of the code. The source is on GitHub.

`vp pack` runs [publint](https://publint.dev) on the package, and fails the build on a problem. It checks `exports`, `files` and the types. arethetypeswrong was ruled out, because it tests old Node resolution that an ESM package for Node 26 doesn't support.

## Release

Run `pnpm run axe` and `pnpm run keyboard` first, and fix what they find. The audit runs axe on every page of this site, in both colour schemes, at a desktop and a phone width ([tests/axe.ts](../tests/axe.ts)). The keyboard check reads a page of each kind with Tab, Enter, Space and Esc ([tests/keyboard.ts](../tests/keyboard.ts)). Both need Chrome on the machine, so they aren't in CI yet. Running them in the release workflow could come later.

prose releases the way every package does, as [ship's standard](https://ship.amitkaps.com/docs/standard.md#releases) sets out. From ship, open the pull request that bumps `version`. Its description goes above the release's generated notes.

```sh
pnpm release prose 0.5.0 --notes "What changed for users …"
```

Merging it is the release, and the `release` workflow does the rest. The notes are generated from the pull requests' labels (`.github/release.yml`), so there's no changelog file to keep. The site needs no step of its own, because Cloudflare builds it from `main` ([the site](#the-site)).

## The site

[prose.amitkaps.com](https://prose.amitkaps.com) is this repository read with prose, on a Cloudflare Worker with static assets. It builds from `main`, so its configuration is a file in the repository, [cloudflare.config.ts](../cloudflare.config.ts). Every merge deploys it.

The `prose` Worker has the build settings every Worker has, in [ship's standard](https://ship.amitkaps.com/docs/standard.md#cloudflare). `verify` reads the repository into `.prose` and ends with `vp build`, which hands the folder to Cloudflare, as [ship's standard](https://ship.amitkaps.com/docs/standard.md#a-prose-site) has it. `ship` runs `cf deploy --prebuilt` on that.

`cloudflare.config.ts` names the domain, `prose.amitkaps.com`, which needs the `amitkaps.com` zone on the same Cloudflare account. It also sets up the two things [usage](usage.md#build) asks of a host. It serves `404.html` for a missing address, and serves `/src/store.ts` from `src/store.ts.html`.
