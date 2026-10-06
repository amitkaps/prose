# Tests

One test file for each source file that has logic, run with `pnpm run test`. The build and server tests run against [`fixtures/simple`](fixtures/simple/), a small committed project, because `prose build` reads `HEAD`. It's a counter on one static page, with file prose in all three files and headed comments, so it covers the parser and every kind of page.

- [parser.test.ts](parser.test.ts): what counts as prose in each language.
- [highlight.test.ts](highlight.test.ts): the HTML the highlighter writes, and a token or two in each language.
- [lexer.test.ts](lexer.test.ts): what can hide a comment in JS and TS, and agreement with oxc's parser on the repository's own files.
- [tree.test.ts](tree.test.ts): the walk, summaries, and which files are read.
- [server.test.ts](server.test.ts) and [build.test.ts](build.test.ts): the pages and the static site.
- [repo.test.ts](repo.test.ts): the project's name and GitHub address, and the rail's footer and README rows.
- [nav.test.ts](nav.test.ts): the docs linked in the bar.
- [style.test.ts](style.test.ts): every rule in the stylesheet sits in a layer.
- [accent.test.ts](accent.test.ts): a project's colour and tab icon, and the browser's bar in the paper's colour.

[axe.ts](axe.ts) is the accessibility audit. It needs Chrome, so it runs by hand as `pnpm run axe` before a release, not with the rest.

Commit a change to the fixture before running them, since a build exports `HEAD`.
