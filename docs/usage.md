# Using prose

Install it, read a repository with it, write `@prose` as you build, and publish the pages as a site. Each command is stated once, as the list item that opens its section, and `prose help` prints them from the version installed. Why it works this way is in [design.md](design.md), and the rules for the comment are in [writing.md](writing.md).

## Install

prose needs Node 26 or newer, the Node it's built and tested on. Install it from npm, into a project or globally.

```sh
pnpm add -D @amitkaps/prose
npm install -g @amitkaps/prose
```

To read a repository once without installing, run `npx @amitkaps/prose .` or `pnpm dlx @amitkaps/prose .`. `prose --version` prints the version installed.

## Read a repository

- [`prose [dir] [--port <n>] [--no-open]`]{#serve}: serves a repository and opens it in the browser.

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

## Publish a site

- [`prose build [dir] [--out <dir>]`]{#build}: writes the same pages as a static site, from the last commit.

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

- [`prose check [dir]`]{#check}: prints what the text gets wrong, and fails if it finds anything.

```sh
prose check             # what the text gets wrong, by file and line
prose check docs        # another folder
```

`prose check` reads the working tree and prints one warning a line, as a compiler does. It fails when it finds any, so it can run in CI. It always ends with how many files it read, and how many `.gitattributes` left out. A folder's warning, like a missing `README.md`, counts the folder apart from the files. With more than one warning, a line before that counts them by code, most first. Then a line names `prose rules <code>`, which prints a code's row from the table below and the rule it serves.

```text
prose: warning: docs/usage.md:12:5: reference-link: reference link; write inline links
prose: warning: scripts/: no-readme: folder with no `README.md`; write a `README.md` that says what lives there
prose: by code: no-readme 1, reference-link 1
prose: `prose rules <code>` says what a code asks for
prose: 2 warnings in 1 file and 1 folder, of 84 files checked, 12 left out by .gitattributes
```

Each warning has a place, a code, what's wrong and what to write instead. Most come from [markz](https://markz.amitkaps.com/docs/reference.md#warnings), which reads every Markdown file and every `@prose` comment. prose adds its own, on how the text is put together ([writing](writing.md)).

It reads only form a machine can be sure of, never meaning. It warns about each file, folder or export with no prose, but never prints a coverage percentage. A percentage invites a target, and a target is met with prose written to fill it.

| Code | When | Write instead | Rule |
| --- | --- | --- | --- |
| [`broken-link`]{#broken-link} | a relative link reaches no file or folder in the repository | a path from this file | [Stated once](#stated-once) |
| [`broken-anchor`]{#broken-anchor} | a link's `#fragment` matches no id on the page it reaches, a heading's or a span's | a heading's or span's id, as the page's `#` gives it | [Stated once](#stated-once) |
| [`heading-skip`]{#heading-skip} | a heading is two or more levels below the one before it on the page | one level below | [markz's Markdown](#markz-markdown) |
| [`marker-line`]{#marker-line} | prose shares a line with `@prose`, or with the comment's close | `@prose` and the close each on their own line | [markz's Markdown](#markz-markdown) |
| [`untitled-summary`]{#untitled-summary} | a file's first `@prose` comment, its summary, doesn't open with a heading | a `# Title` line first, which is the page's title | [Summary first](#summary-first) |
| [`no-prose`]{#no-prose} | a file prose reads for prose has no `@prose` comment | its summary in a `@prose` comment at the top | [Every file](#every-file) |
| [`no-readme`]{#no-readme} | a folder with a file prose reads has no `README.md`, except `.github/` | a `README.md` that says what lives there | [Every file](#every-file) |
| [`undocumented-export`]{#undocumented-export} | a package that isn't private ships types, and an export it ships has no doc comment | a `/** … */` comment above it, and one line is enough | [Every export](#every-export) |
| [`nav-missing`]{#nav-missing} | `nav` in `docs/README.md` names a file that isn't a doc | a doc's name in docs/ | [Stated once](#stated-once) |
| [`id-case`]{#id-case} | a span's written id isn't lowercase kebab case | the id in lowercase kebab case, like `no-readme` | [Written ids](#written-ids) |
| [`id-twice`]{#id-twice} | a span's written id is stated on another page of the repository too | a link to the page that states it | [Written ids](#written-ids) |
| [`uncommitted-changes`]{#uncommitted-changes} | the build leaves out uncommitted changes | a commit first |  |
| [`unignored-build`]{#unignored-build} | the build's folder isn't in `.gitignore` | the build's folder in `.gitignore` |  |

A Markdown file is prose already, and JSON can't hold a comment, so neither is asked for `@prose`. Nor is HTML, since a hand-written page is served with its comments, prose and all ([writing](writing.md#in-each-language)). What a package ships is read from the `types` paths in its `package.json`, like `./dist/index.d.ts` for `src/index.ts`, through each `export … from`. A link with a scheme, a site path like `/about`, or a path out of the repository isn't checked, since prose can't see where it goes. Neither is a GitHub line, like `#L42`. The last two codes are about a build, so only `prose build` prints them. `prose .` shows a page's own warnings at its foot, each linked to its line in the editor. A published page never does.

Some files aren't held to the rules, like fixtures, build snapshots or a corpus of other projects' docs. Mark them `prose-unchecked` in `.gitattributes`, and `prose check` leaves them out. Their pages still read as any other, and on `prose .` each says it wasn't checked.

```text
tests/fixtures/** prose-unchecked
```

`linguist-vendored` and `linguist-generated` leave a file out too, as GitHub reads them. They also hide it from the repository's languages on GitHub. So `linguist-vendored` suits copied-in code, and `linguist-generated` a test's build snapshot, whose diff GitHub then folds. Neither suits a repository's own tests.

## Advice on style

- [`prose style [path ...]`]{#style}: gives advice on how the files you name read, and always passes.

```sh
prose style docs/usage.md src/store.ts   # advice on the files you just wrote
prose style docs                         # a folder
```

`prose style` gives advice on how the files you name read, against [the agent rules](#for-agents). It prints one suggestion a line, like a warning, and always passes. With no path, it reads every file. It ends with how many files it read, and counts its suggestions by code, as `prose check` does.

```text
prose: note: docs/usage.md:20:31: joining-semicolon: semicolon joining two ideas; write two sentences
prose: note: docs/usage.md:41:12: joining-semicolon: semicolon joining two ideas; write two sentences
prose: note: src/store.ts:9:24: joining-colon: colon joining two ideas; write two sentences
prose: by code: joining-semicolon 2, joining-colon 1
prose: `prose rules <code>` says what a code asks for
prose: 3 suggestions in 2 files, of 12 files read
```

It's for the writer of a file, right after writing it. So it isn't part of `prose check` and never shows on a page. A count of words is only a guess at what's hard to read. In CI or on every page, it would teach an agent to dodge the count.

It's conservative, so a suggestion is worth taking. It flags only what it's confident a rewrite would improve, and lets a form that's often fine pass, even when some of that form joins two ideas. A wrong suggestion would have an agent rewrite a good sentence, and learn to pass over the rest. A miss costs less, since [the agent rules](#for-agents) still say how to write. So fix what it finds, and rewrite to help the reader, not to make a suggestion go away.

| Code | When | Write instead | Rule |
| --- | --- | --- | --- |
| [`long-summary`]{#long-summary} | a text's first paragraph is over 60 words, about four lines | a summary of about three lines, with detail below it | [Summary first](#summary-first) |
| [`long-sentence`]{#long-sentence} | a sentence is over 35 words | one idea a sentence, in about 25 words | [Plain sentences](#plain-sentences) |
| [`joining-semicolon`]{#joining-semicolon} | a semicolon joins two ideas | two sentences | [Plain sentences](#plain-sentences) |
| [`joining-colon`]{#joining-colon} | a colon joins two ideas, with a clause after it that a subject or verb opens | two sentences | [Plain sentences](#plain-sentences) |
| [`parenthetical-aside`]{#parenthetical-aside} | a parenthesis holds an aside, not a link, an example or a gloss of a few words | its own sentence, or cut it | [Plain sentences](#plain-sentences) |

Only paragraphs are read. Headings, code, tables and metadata aren't sentences. A file that `.gitattributes` marks `prose-unchecked` gets no advice, as it gets no warnings ([warnings](#warnings)).

A colon gets a suggestion only when a clause plainly follows it. That means a subject like "it", "they" or "there" opens what follows, or a verb like "is", "doesn't" or "keeps" comes within its first four words. A verb after "that" or "what" belongs to an inner clause, and doesn't count. So `It never throws: syntax markz doesn't accept stays text` gets one. A list like `three settings: the cooldown, allowBuilds and the override` doesn't, and nor does an explanation like `How it's built: the tree it produces`. Some colons that join two clauses pass too, and that's the cost of being conservative.

Other forms look like a joined idea or an aside but aren't, so they get no suggestion.

- **A label.** A colon labels a list item, as in `- [a.ts](a.ts): what it does` or `- **spec**: its text`.
- **A list of clauses.** Semicolons separate items with commas of their own, when a sentence has two or more, or "and" follows one.
- **A citation.** A parenthesis opens with a label, like `(grammar: link; brackets)`. Its colon and semicolon are part of it.
- **An example or a gloss.** A parenthesis holds a run of short items, or is mostly inline code.

## An outline for agents

- [`prose outline [dir]`]{#outline}: writes `outline.md`, every file in the repository with its summary.

```sh
pnpm prose outline   # writes outline.md at the root
```

The outline is the repository as a tree, with the first paragraph of each file's prose, and a folder's from its `README.md`. It leaves out what `.gitattributes` marks `prose-unchecked`, like fixtures. An agent reads it to find its way, so have `AGENTS.md` import it, as `@outline.md` does in Claude Code. Put `outline.md` in `.gitignore`, and have `verify` run `prose outline` after `prose check`. It's then current wherever the work is checked, and two pull requests never conflict over it.

## Rules and help

- [`prose rules [code]`]{#rules}: prints the rules to write prose by, or what one code asks for.
- [`prose help [command]`]{#help}: lists the commands, or prints what one does.

```sh
pnpm prose help        # every command, with how it's run
pnpm prose help style  # what one does, from this page
```

`prose rules` is for an agent, as [For agents](#for-agents) says.

## For agents

`prose rules` prints the rules below, from the docs of the version installed, and `prose rules <code>` prints one code's row with the rule it serves. Have the project's `AGENTS.md` or `CLAUDE.md` say to run it before writing prose, or changing code a `@prose` comment explains. An agent then reads the rules as written, with no fetch, and they change when prose is upgraded.

```sh
pnpm prose rules                # the rules, as raw text
pnpm prose rules joining-colon  # what one code asks for
```

The rules fall in four groups: where prose goes, how it reads, what it says, and keeping it true. Each rule has a name, and each code in [warnings](#warnings) and [style](#style) names the rule it serves. So `prose rules` prints each rule with the codes that check it, and a test holds the two to each other. A code can't ship without a rule to say what to write, though most rules are about meaning and no code checks them. markz's rules print after prose's, from the markz prose bundles, and each markz code serves one of them. The codes about a build, `uncommitted-changes` and `unignored-build`, serve none, since they aren't about the writing.

### Where prose goes

- [**Every file.**]{#every-file} Every source file opens with a `@prose` comment, its summary. Add more wherever the reader needs the why, like a design choice or an edge that's easy to get wrong. Trivial declarations, types, constants and mechanical helpers don't need one. A paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- [**Every export.**]{#every-export} A library ships the comment above each export in its types, as that export's documentation. So give every export a comment, and a one-line JSDoc is enough. Put a section's prose above the declaration it describes.
- [**Outline first.**]{#outline-first} Read `outline.md` before searching, to find your way. `prose outline` writes it, so run that when there's none. `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet. Add an `--include` for each other language the project writes.

### How it reads

- [**Summary first.**]{#summary-first} Every prose comment, README and doc begins with a short first paragraph, its summary for the human, in about three lines. A file's summary opens with a heading, its title. The paragraph says what the file or section means, not what its code does. Detail goes below it. When a change alters a file's role, rewrite that paragraph in the same change.
- [**Plain sentences.**]{#plain-sentences} Write plain sentences. Each one holds one idea, in about 25 words at most, in the active voice with a named subject. If a point doesn't fit, give it its own sentence or cut it. Don't join ideas with semicolons or colons, and keep parentheses for links and examples. Use one term for each concept, the one the docs already use.
- [**markz's Markdown.**]{#markz-markdown} Prose goes in `@prose` comments, written in [markz's Markdown](https://markz.amitkaps.com/docs/usage.md#for-agents), whose rules `prose rules` prints after these. `@prose` and the comment's close each sit on their own line, and headings step down one level at a time. Ordinary comments stay for code-level notes.

### What it says

- [**Beyond code.**]{#beyond-code} Prose says what the code can't. That's why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- [**Stated once.**]{#stated-once} State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it. A link reaches a file that exists, and a heading or span on it.
- [**Written ids.**]{#written-ids} A rule, a code or a claim that other places name is stated once, as a span with an id, and the others link to it. So a removed or renamed one breaks a link. Write the id in lowercase kebab case, like `no-readme`, and state it on one page of the repository, since `prose rules <id>` finds an id without its page.
- [**Chat decisions.**]{#chat-decisions} Decisions made in the chat go into the prose in the same change. One that spans files goes into the doc it changes, and one about a single spot goes into the `@prose` there. Write docs for a reader who wasn't in the chat, since they may be published as they are. When something is ruled out, write down that it's out and why, so it isn't rebuilt.

### Keeping it true

- [**Kept current.**]{#kept-current} Keep prose current in the same change as the code. Rewrite it where it has drifted, and don't append. A change that only tunes code, with the same behaviour and the same stated costs, needn't touch prose.
- [**Current plan.**]{#current-plan} If the project keeps a plan, keep it current: what's next first, in order, then what works now, one line for each thing it does, rewritten in place rather than added to with each release.
- [**After writing.**]{#after-writing} After writing prose, run `prose style` on the files you changed. Rewrite where a suggestion helps the reader, and leave it where it doesn't. Never split or reword a sentence only to make a suggestion go away.
- [**No quieting.**]{#no-quieting} Never mark a file `prose-unchecked` in `.gitattributes` to quiet a warning. Fix the text. `prose-unchecked` is for files that are wrong on purpose, like fixtures.
