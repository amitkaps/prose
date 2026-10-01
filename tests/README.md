# Tests

One test file for each source file that has logic, run with `pnpm run test`. The build and server tests run against [`fixtures/simple`](fixtures/simple/), a small committed project, because `prose build` reads `HEAD`.

- [parser.test.ts](parser.test.ts) and [names.test.ts](names.test.ts): what counts as prose in each language, and the names a chunk declares.
- [tree.test.ts](tree.test.ts): the walk, summaries, and which files are read.
- [server.test.ts](server.test.ts) and [build.test.ts](build.test.ts): the pages and the static site.
- [repo.test.ts](repo.test.ts): the GitHub address, and the rail's footer and README rows.

Commit a change to the fixture before running them, since a build exports `HEAD`.
