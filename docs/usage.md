# Using prose

Install it, read a repository with it, write `@prose` as you build, and publish the result. For why it works this way, see [design.md](design.md); for the exact rules of the comment, [convention.md](convention.md).

## Install

Node 26 or later. Install the release tarball, into a project or globally:

```sh
pnpm add -D https://github.com/amitkaps/prose/releases/download/v0.2.0/amitkaps-prose-0.2.0.tgz
npm install -g https://github.com/amitkaps/prose/releases/download/v0.2.0/amitkaps-prose-0.2.0.tgz
```

## Read a repository

```sh
prose .                 # serve it at http://127.0.0.1:1234/ and open the browser
prose . --no-open        # serve without opening the browser
prose . --port 4000     # another port (the default, 1234, falls through to the next free one)
```

It works on any repository, with no config and no `@prose` required: a repository without it still reads as its Markdown and its code.

- **A folder** shows its `README.md`, then each child with a one-paragraph summary. A source file with no prose says *undocumented*, so you see what's left to explain.
- **A Markdown file** renders as it is.
- **A source file** reads as one document: its prose blocks in order, with the code between them. The **Prose & Code / Prose only** switch sets whether the code starts open.
- **Every other file** is shown as text, or as its type and size.

The file tree is on the right, and the page reloads when its file changes. Relative links between prose and code work as they do on GitHub. Every page's behaviour is in [spec.md](spec.md).

## Write prose

Put a `@prose` comment above the code it explains. `@prose` and the closing delimiter each sit on their own line:

```ts
/** @prose
 * # Adding and toggling
 *
 * `addTodo` appends a todo with `completed: false`. Empty text is ignored.
 */
export function addTodo(text: string) {
  /* … */
}
```

Start each block with a short summary paragraph; the renderer uses a file's first one as its summary in the folder listing. Writing that spans files (what the project promises, the plan, lessons) goes in Markdown under `docs/`. The languages, the block rules, anchors and links are in [convention.md](convention.md).

## Build

```sh
prose build             # the same pages as static files, in .prose/site
prose build --out site  # somewhere else
```

`prose build` renders `HEAD`, not the working tree, so nothing untracked, ignored or uncommitted reaches the site; it warns when there are uncommitted changes. Add `.prose/` to `.gitignore`. The pages and URLs are described in [spec.md](spec.md#prose-build).

## Publish

```sh
prose publish --domain docs.example.com   # commit the site to the `prose` branch
git push origin prose                     # publishing never pushes; this does
```

`prose publish` commits the build to an orphan `prose` branch without checking it out, so your working tree, index and `HEAD` stay as they were. A publish that changes no page makes no commit.

For GitHub Pages, set the repository's Pages source to the `prose` branch. With `--domain`, add a DNS CNAME record for that domain pointing at `<user>.github.io`; later publishes keep the domain (`--no-domain` drops it). `--branch` changes the branch.

This repository is published that way: [prose.amitkaps.com](https://prose.amitkaps.com) is this repository read with prose.

## For agents

Copy this into the project's `CLAUDE.md` or `AGENTS.md`:

```markdown
- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose block, file, folder and doc begins with a short first paragraph that is its summary for the human: about three lines, one idea per sentence. It says what the node means, not what its code does; detail goes in the chunks below. When a change alters a node's role, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments, in markz's Markdown. Ordinary comments stay for code-level notes.
- Prose says what the code can't: why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change: into the doc they change when they span files, into the `@prose` block when they concern one spot. Write docs for a reader who wasn't in the chat, since they may be published as they are. Keep the promises doc short, and update its non-goals when something is ruled out.
- Keep the plan current: what's done in one line each, what's next in order. Work that belongs to one file can be a pending chunk there instead.
- To find your way: `grep -rn -A4 "@prose" src` is the map; `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet.
```
