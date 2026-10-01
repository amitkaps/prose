# Source

The package: the parser that reads `@prose` out of a file, the tree walk that finds the files, and the renderer that turns them into pages, served or written out. Each file's own prose says how it works.

- **Reading a file:** [parser.ts](parser.ts) finds the comments and makes chunks and anchors; [names.ts](names.ts) names what a chunk declares.
- **Finding the files:** [tree.ts](tree.ts) walks the repository into folders and files, each with a summary.
- **Making pages:** [render.ts](render.ts) turns a node into HTML, with [rail.ts](rail.ts) for the file tree, [highlight.ts](highlight.ts) for code and [style.css](style.css) for the look.
- **Showing them:** [server.ts](server.ts) serves the pages for `prose .`; [build.ts](build.ts) writes them as static files and [publish.ts](publish.ts) commits those to a branch. [repo.ts](repo.ts) reads the GitHub address for the links.
- **Entry points:** [cli.ts](cli.ts) is the command and [index.ts](index.ts) the library.
