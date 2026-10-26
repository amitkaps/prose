# Tests

One test file for each source file that has logic, run with `pnpm run test`. The build and server tests run against [`fixtures/simple`](fixtures/simple/), a small committed project, because `prose build` reads `HEAD`. It's a counter on one static page, with file prose in all three files and headed comments, so it covers the parser and every kind of page.

- [parser.test.ts](parser.test.ts): what counts as prose in each language.
- [highlight.test.ts](highlight.test.ts): the HTML the highlighter writes, and a token or two in each language.
- [lexer.test.ts](lexer.test.ts): what can hide a comment in JS and TS, and agreement with oxc's parser on the repository's own files.
- [tree.test.ts](tree.test.ts): the walk, summaries, and which files are read.
- [server.test.ts](server.test.ts) and [build.test.ts](build.test.ts): the pages and the static site.
- [repo.test.ts](repo.test.ts): the project's name and GitHub address, and the rail's footer and README rows.
- [nav.test.ts](nav.test.ts): the docs linked in the bar.
- [warnings.test.ts](warnings.test.ts): what `prose check` finds, at its place in the file.
- [presence.test.ts](presence.test.ts): a file, folder or export with no prose, and what isn't asked.
- [structure.test.ts](structure.test.ts): links that reach nothing, headings that skip a level, and prose on the marker's line.
- [style.test.ts](style.test.ts): the advice `prose style` gives, and what looks like a break but isn't.
- [codes.test.ts](codes.test.ts): every code `check` and `style` print has a row in the docs, and every row a code. `prose rules` reads the same rows.
- [stylesheet.test.ts](stylesheet.test.ts): every rule in the stylesheet sits in a layer.
- [outline.test.ts](outline.test.ts): the map `prose outline` writes, its links and what it leaves out.
- [skills.test.ts](skills.test.ts): the skills ship, load, and name only commands prose has.
- [cli.test.ts](cli.test.ts): the command's exit codes, streams, summary and flags, run on the built command.
- [accent.test.ts](accent.test.ts): a project's colour and tab icon, and the browser's bar in the paper's colour.

Two checks need Chrome, so they run by hand before a release, not with the rest. [axe.ts](axe.ts) is the accessibility audit, `pnpm run axe`. [keyboard.ts](keyboard.ts) reads pages by keyboard, `pnpm run keyboard`. Both build and serve the site through [site.ts](site.ts).

Commit a change to the fixture before running them, since a build exports `HEAD`.
