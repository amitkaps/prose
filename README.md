# prose

Prose lets coding agents explain the code they write, and lets humans read the resulting
repository as a document. It is two things:

- **`@prose`**, a convention for writing human-oriented meaning directly into source code.
- **`prose`**, a read-only renderer that opens any repository in the browser as a
  Markdown-first document, locally or as a static site.

This repository, read with it: [prose.amitkaps.com](https://prose.amitkaps.com). The design is
in [docs/spec.md](docs/spec.md) and the order of the work in [docs/plan.md](docs/plan.md).

## Install

Node 26 or later. Install the release tarball, into a project or globally:

```sh
pnpm add -D https://github.com/amitkaps/prose/releases/download/v0.2.0/amitkaps-prose-0.2.0.tgz
npm install -g https://github.com/amitkaps/prose/releases/download/v0.2.0/amitkaps-prose-0.2.0.tgz
```

## Read a repository

```sh
prose .                 # serve it at http://127.0.0.1:1234/ and open the browser
prose build             # the same pages as static files, from the last commit, in .prose/site
prose publish --domain docs.example.com   # commit that site to the `prose` branch
git push origin prose   # publishing never pushes; this does
```

Folders show their `README.md` and a summary of each child. Markdown renders as it is. A source
file reads as one document: its prose blocks in order, with the code between them. Every other
file is shown as text, or as its type and size. `prose .` reloads a page when its file changes.

`prose build` renders `HEAD`, not the working tree, so nothing untracked, ignored or uncommitted
reaches the site. Add `.prose/` to `.gitignore`. For GitHub Pages, set the repository's Pages
source to the `prose` branch; with `--domain`, add a DNS CNAME record for that domain pointing at
`<user>.github.io`. Later publishes keep the domain.

## The convention

A comment whose first token is `@prose` is a prose block: the maintained explanation of the code
that follows it. Everything else stays an ordinary code comment. `@prose` and the closing
delimiter each sit on their own line.

| Language                  | Prose block                                 |
| ------------------------- | ------------------------------------------- |
| JS, TS, CSS, Svelte       | `/** @prose … */` on its own line           |
| HTML, Svelte markup       | `<!-- @prose … -->`                         |
| YAML, TOML                | `# @prose …`, one `#` per line, at column 0 |

```ts
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
```

Writing that spans the code (what the project promises, the plan, lessons) goes in Markdown,
by convention in a root `docs/` folder, linked to the code by repo path.

## For agents

Copy this into the project's `CLAUDE.md` or `AGENTS.md` (spec §5):

```markdown
- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`.
- Every prose block, file, folder and doc begins with a short first paragraph that is its summary for the human: about three lines, one idea per sentence. It says what the node means, not what its code does; detail goes in the chunks below. When a change alters a node's role, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments, in markz's Markdown. Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change: into the doc they change when they span files, into the `@prose` block when they concern one spot. Write docs for a reader who wasn't in the chat, since they may be published as they are. Keep the promises doc short, and update its non-goals when something is ruled out.
- Keep the plan current: what's done in one line each, what's next in order. Work that belongs to one file can be a pending chunk there instead.
- To find your way: `grep -rn -A4 "@prose" src` is the map; `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet.
```

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
