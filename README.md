# prose

Prose lets coding agents explain the code they write, and lets humans read the resulting
repository as a document. It is two things:

- **`@prose`**, a convention for writing human-oriented meaning directly into source code.
- **`prose .`**, a read-only renderer that opens any repository in the browser as a
  Markdown-first document.

The design is in [docs/spec.md](docs/spec.md) and the order of the work in
[docs/plan.md](docs/plan.md). The renderer isn't released yet; from a checkout, `pnpm build`
then `node dist/cli.js <dir>`. 0.1.0, the last release of the earlier Vite plugin and its
`/__prose/` route, stays available on the
[releases page](https://github.com/amitkaps/prose/releases/tag/v0.1.0).

## The convention

A comment whose first token is `@prose` is a prose block: the maintained explanation of the code
that follows it. Everything else stays an ordinary code comment. `@prose` and the closing
delimiter each sit on their own line.

| Language                  | Prose block                 |
| ------------------------- | --------------------------- |
| JS, TS, Svelte `<script>` | `/** @prose … */`           |
| CSS, Svelte `<style>`     | `/** @prose … */`           |
| HTML, Svelte markup       | `<!-- @prose … -->`         |
| YAML, TOML                | `# @prose …`, at column 0   |

```ts
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
```

Writing that spans the code (what the project promises, the plan, lessons) goes in Markdown,
by convention in a root `docs/` folder, linked to the code by repo path.

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
git tag v0.1.0 && git push origin v0.1.0
```

The `release` workflow verifies the tag matches `package.json`, runs checks and tests, builds, and
attaches `amitkaps-prose-<version>.tgz` to a GitHub Release.
