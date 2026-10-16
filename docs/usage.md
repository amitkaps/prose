# Using prose

Install it, read a repository with it, write `@prose` as you build, and publish the pages as a site. Why it works this way is in [design.md](design.md), and the rules for the comment are in [writing.md](writing.md).

## Install

prose needs Node 26 or newer, the Node it's built and tested on. Install it from npm, into a project or globally.

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

`prose build` renders the last commit, not the working tree. Nothing untracked, ignored or uncommitted reaches the site, and the build warns when there are uncommitted changes. It prints the text's [warnings](#warnings) too, and writes the site anyway. Add `.prose/` to `.gitignore`, since the folder is prose's own and each build clears it. How the published pages differ from local ones is in [reading.md](reading.md#local-and-published).

The folder is plain static files, and any static host can serve it. Point the host at the folder, and set it up for two things.

- **Addresses without `.html`.** The page for `/src/store.ts` is `src/store.ts.html`, and the host should serve it there with no redirect.
- **A 404 page.** The build writes `404.html`, with the file tree, for any missing address.

The build also writes a `_headers` file, which Cloudflare and Netlify read. It caches the shared stylesheet and script in `/assets/` for good. Deploying is the host's job, and prose has no command for it. This repository's own site, on Cloudflare, is set up in [development.md](development.md#the-site).

## Warnings

```sh
prose check             # what the text gets wrong, by file and line
prose check docs        # another folder
```

`prose check` reads the working tree and prints one warning a line, as a compiler does. It fails when it finds any, so it can run in CI. It always ends with how many files it read, and how many `.gitattributes` left out. A folder's warning, like a missing `README.md`, counts the folder apart from the files.

```text
prose: warning: docs/usage.md:12:5: reference-link: reference link; write inline links
prose: warning: scripts/: no-readme: folder with no `README.md`; write a `README.md` that says what lives there
prose: 2 warnings in 1 file and 1 folder, of 84 files checked, 12 left out by .gitattributes
```

Each warning has a place, a code, what's wrong and what to write instead. Most come from [markz](https://markz.amitkaps.com/docs/reference.md#warnings), which reads every Markdown file and every `@prose` comment. prose adds its own, on how the text is put together ([writing](writing.md)).

| Code                  | When                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| `broken-link`         | a relative link reaches no file or folder in the repository                         |
| `broken-anchor`       | a link's `#fragment` matches no heading on the page it reaches                      |
| `heading-skip`        | a heading is two or more levels below the one before it on the page                 |
| `marker-line`         | prose shares a line with `@prose`, or with the comment's close                      |
| `untitled-summary`    | a file's first `@prose` comment, its summary, doesn't open with a heading           |
| `no-prose`            | a file prose reads for prose has no `@prose` comment                                |
| `no-readme`           | a folder with a file prose reads has no `README.md`, except `.github/`              |
| `undocumented-export` | a package that isn't private ships types, and an export it ships has no doc comment |
| `nav-missing`         | `nav` in `docs/README.md` names a file that isn't a doc                             |
| `uncommitted`         | the build leaves out uncommitted changes                                            |
| `out-not-ignored`     | the build's folder isn't in `.gitignore`                                            |

A Markdown file is prose already, and JSON can't hold a comment, so neither is asked for `@prose`. Nor is HTML, since a hand-written page is served with its comments, prose and all ([writing](writing.md#in-each-language)). What a package ships is read from the `types` paths in its `package.json`, like `./dist/index.d.ts` for `src/index.ts`, through each `export … from`. A link with a scheme, a site path like `/about`, or a path out of the repository isn't checked, since prose can't see where it goes. Neither is a GitHub line, like `#L42`. The last two codes are about a build, so only `prose build` prints them. `prose .` shows a page's own warnings at its foot, each linked to its line in the editor. A published page never does.

Some files aren't held to the rules, like fixtures, build snapshots or a corpus of other projects' docs. Mark them `prose-unchecked` in `.gitattributes`, and `prose check` leaves them out. Their pages still read as any other, and on `prose .` each says it wasn't checked.

```text
tests/fixtures/** prose-unchecked
```

`linguist-vendored` and `linguist-generated` leave a file out too, as GitHub reads them. They also hide it from the repository's languages on GitHub. So `linguist-vendored` suits copied-in code, and `linguist-generated` a test's build snapshot, whose diff GitHub then folds. Neither suits a repository's own tests.

## Style

```sh
prose style docs/usage.md src/store.ts   # advice on the files you just wrote
prose style docs                         # a folder
```

`prose style` gives advice on how the files you name read, against [the agent rules](#for-agents). It prints one suggestion a line, like a warning, and always passes. With no path, it reads every file. It ends with how many files it read, as `prose check` does.

```text
prose: style: docs/usage.md:20:31: semicolon: semicolon joining two ideas; write two sentences
prose: 1 suggestion in 1 file, of 12 files read
```

It's for the writer of a file, right after writing it. So it isn't part of `prose check` and never shows on a page. A count of words is only a guess at what's hard to read. In CI or on every page, it would teach an agent to dodge the count. Rewrite where a suggestion helps the reader, not to make it go away.

| Code            | When                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| `long-summary`  | a text's first paragraph is over 60 words, about four lines                    |
| `long-sentence` | a sentence is over 35 words                                                    |
| `semicolon`     | a semicolon joins two ideas                                                    |
| `colon`         | a colon joins two ideas, with a lowercase clause after it                      |
| `parenthetical` | a parenthesis holds an aside, not a link, an example or a gloss of a few words |

Only paragraphs are read. Headings, code, tables and metadata aren't sentences. A colon that leads into a list, or labels a list item, as in `- [a.ts](a.ts): what it does`, gets no suggestion. A file that `.gitattributes` marks `prose-unchecked` gets no advice, as it gets no warnings ([warnings](#warnings)).

## For agents

Link to this section from the project's `AGENTS.md` or `CLAUDE.md`, so it follows the rules as they change. Or copy them in:

```markdown
- Every source file opens with a `@prose` comment, its summary. Add more wherever the reader needs the why, like a design choice or an edge that's easy to get wrong. Trivial declarations, types, constants and mechanical helpers don't need one. A paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose comment, README and doc begins with a short first paragraph, its summary for the human, in about three lines. It says what the file or section means, not what its code does. Detail goes below it. When a change alters a file's role, rewrite that paragraph in the same change.
- Write plain sentences. Each one holds one idea, in about 25 words at most, in the active voice with a named subject. If a point doesn't fit, give it its own sentence or cut it. Don't join ideas with semicolons or colons, and keep parentheses for links and examples. Use one term for each concept, the one the docs already use.
- Prose goes in `@prose` comments, written in [markz's Markdown](https://markz.amitkaps.com/docs/syntax.md). Write `_emphasis_`, never `*emphasis*`, and no raw HTML. Ordinary comments stay for code-level notes.
- Prose says what the code can't. That's why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- A library ships the comment above each export in its types, as that export's documentation. So give every export a comment, and a one-line JSDoc is enough. Put a section's prose above the declaration it describes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted, and don't append. A change that only tunes code, with the same behaviour and the same stated costs, needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change. One that spans files goes into the doc it changes, and one about a single spot goes into the `@prose` there. Write docs for a reader who wasn't in the chat, since they may be published as they are. When something is ruled out, write down that it's out and why, so it isn't rebuilt.
- If the project keeps a plan, keep it current, with what's done in one line each and what's next in order.
- Never mark a file `prose-unchecked` in `.gitattributes` to quiet a warning. Fix the text. `prose-unchecked` is for files that are wrong on purpose, like fixtures.
- After writing prose, run `prose style` on the files you changed. Rewrite where a suggestion helps the reader, and leave it where it doesn't. Never split or reword a sentence only to make a suggestion go away.
- To find your way, `grep -rn -A4 "@prose" src` is the map, and `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet. Add an `--include` for each other language the project writes.
```
