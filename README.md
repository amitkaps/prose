# prose

Prose lets coding agents explain the code they write, and lets humans read the resulting
repository as a document. It is two things:

- **`@prose`**, a convention for writing human-oriented meaning directly into source code.
- **`prose`**, a read-only renderer that opens any repository in the browser as a
  Markdown-first document, locally or as a static site.

This repository, read with it: [prose.amitkaps.com](https://prose.amitkaps.com).

## What it looks like

A comment whose first token is `@prose` is the maintained explanation of the code below it.
Everything else stays an ordinary code comment.

```ts
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
let count = 0;
```

`prose .` shows each file as one document: the prose in order, with the code between it.

## Install and run

Node 26 or later:

```sh
npm install -g https://github.com/amitkaps/prose/releases/download/v0.2.0/amitkaps-prose-0.2.0.tgz
prose .            # read this repository in the browser
prose build        # the same pages as static files, from the last commit
prose publish      # commit that site to the `prose` branch
```

## Docs

- [Using prose](docs/usage.md): install, reading, building and publishing, and the snippet to
  give your agents.
- [The convention](docs/convention.md): `@prose` in every language, blocks and chunks, anchors,
  `docs/` and links.
- [Design](docs/design.md): why it's built this way, and what it leaves out.
- [The renderer](docs/spec.md): what every page shows and what `build` and `publish` write.
- [Plan](docs/plan.md) and [lessons](docs/lessons.md): the order of the work, and what building it
  taught.

## Develop

```sh
pnpm install
pnpm run check && pnpm run test
pnpm run build        # the library and the command (vp pack)
node dist/cli.js .    # read this repository with prose
```

## Release

Bump `version` in `package.json`, merge to `main`, then tag and push:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The `release` workflow verifies the tag matches `package.json`, runs checks and tests, builds, and
attaches `amitkaps-prose-<version>.tgz` to a GitHub Release. Then publish the site:
`node dist/cli.js publish && git push origin prose`.
