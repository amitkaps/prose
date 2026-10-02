# Source

The package. The parser reads `@prose` out of a file, the tree walk finds the files, and the renderer turns them into pages, served or written out. Each file's own prose says how it works.

- **Reading a file:** [parser.ts](parser.ts) finds the comments and makes chunks and anchors. [names.ts](names.ts) names what a chunk declares.
- **Finding the files:** [tree.ts](tree.ts) walks the repository into folders and files, each with a summary.
- **Making pages:** [render.ts](render.ts) turns a node into HTML, with [rail.ts](rail.ts) for the file tree, [nav.ts](nav.ts) for the docs linked in the bar, [highlight.ts](highlight.ts) for code and [style.css](style.css) for the look. [ebnf.ts](ebnf.ts) adds a grammar shiki lacks.
- **Showing them:** [server.ts](server.ts) serves the pages for `prose .`, and [build.ts](build.ts) writes them as static files. [repo.ts](repo.ts) reads the project's name and GitHub address.
- **Entry points:** [cli.ts](cli.ts) is the command and [index.ts](index.ts) the library.
