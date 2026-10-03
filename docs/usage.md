# Using prose

Install it, read a repository with it, write `@prose` as you build, and publish the pages as a site. Why it works this way is in [design.md](design.md), and the rules for the comment are in [writing.md](writing.md).

## Install

It runs on the current Node and the previous LTS, which today are 26 and 24. Install it from npm, into a project or globally.

```sh
pnpm add -D @amitkaps/prose
npm install -g @amitkaps/prose
```

To read a repository once without installing, run `npx @amitkaps/prose .` or `pnpm dlx @amitkaps/prose .`.

## Read a repository

```sh
prose .                 # serve it at http://127.0.0.1:1234/ and open the browser
prose . --no-open       # serve without opening the browser
prose . --port 4000     # another port (the default, 1234, falls through to the next free one)
```

It works on any repository, with no config and no `@prose` required. A repository without any prose still reads as its Markdown and its code.

A folder's page shows its `README.md` and a summary of each file in it. A source file reads as one document, with its prose in order and the code between. A page reloads when its file changes. [reading.md](reading.md) has what every page shows.

## Write prose

Put a `@prose` comment above the code it explains. `@prose` and the closing delimiter each sit on their own line.

```ts
/** @prose
 * # Adding
 *
 * Empty text is ignored, so the list never shows a blank row.
 */
export function addTodo(text: string) {
  /* … */
}
```

The first `@prose` in a file is its summary, and a folder's page shows its first paragraph. Writing that spans files goes in Markdown, and the bar links the docs in `docs/`. [writing.md](writing.md) has what to write, the links and the details for each language.

## Build

```sh
prose build             # the same pages as static files, in .prose
prose build --out site  # somewhere else
```

`prose build` renders the last commit, not the working tree. Nothing untracked, ignored or uncommitted reaches the site, and the build warns when there are uncommitted changes. Add `.prose/` to `.gitignore`, since the folder is prose's own and each build clears it. How the published pages differ from local ones is in [reading.md](reading.md#local-and-published).

The folder is plain static files, and any static host can serve it. Point the host at the folder, and set it up for two things.

- **Addresses without `.html`.** The page for `/src/store.ts` is `src/store.ts.html`, and the host should serve it there with no redirect.
- **A 404 page.** The build writes `404.html`, with the file tree, for any missing address.

The build also writes a `_headers` file, which Cloudflare and Netlify read. It caches the shared stylesheet and script in `/assets/` for good. Deploying is the host's job, and prose has no command for it. This repository's own site, on Cloudflare, is set up in [development.md](development.md#the-site).

## For agents

Copy this into the project's `CLAUDE.md` or `AGENTS.md`:

```markdown
- Every source file opens with a `@prose` comment, its summary. Add more wherever the reader needs the why, like a design choice or an edge that's easy to get wrong. Trivial declarations, types, constants and mechanical helpers don't need one. A paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose comment, README and doc begins with a short first paragraph, its summary for the human, in about three lines. It says what the file or section means, not what its code does. Detail goes below it. When a change alters a file's role, rewrite that paragraph in the same change.
- Write plain sentences. Each one holds one idea, in about 25 words at most, in the active voice with a named subject. If a point doesn't fit, give it its own sentence or cut it. Don't join ideas with semicolons or colons, and keep parentheses for links and examples. Use one term for each concept, the one the docs already use.
- Prose goes in `@prose` comments, in markz's Markdown. Ordinary comments stay for code-level notes.
- Prose says what the code can't: why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- A library ships the comment above each export in its types, as that export's documentation. So give every export a comment, even one line, and put a section's prose above the declaration it describes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted, and don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change. One that spans files goes into the doc it changes, and one about a single spot goes into the `@prose` there. Write docs for a reader who wasn't in the chat, since they may be published as they are. When something is ruled out, write down that it's out and why, so it isn't rebuilt.
- If the project keeps a plan, keep it current, with what's done in one line each and what's next in order.
- To find your way, `grep -rn -A4 "@prose" src` is the map, and `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet.
```
