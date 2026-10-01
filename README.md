# prose

Prose lets coding agents explain the code they write, and lets humans read the resulting
repository as a document. It is two things:

- **`@prose`**, a convention for writing human-oriented meaning directly into source code.
- **`prose`**, a read-only renderer that opens any repository in the browser as a
  Markdown-first document, locally or as a static site.

This repository, read with it: [prose.amitkaps.com](https://prose.amitkaps.com).

## What it looks like

A comment whose first token is `@prose` is the maintained explanation of the code below it.
Everything else stays an ordinary code comment.

```ts
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
let count = 0;
```

`prose .` shows each file as one document: the prose in order, with the code between it.

## Install and run

The current Node and the previous LTS (today, 26 and 24):

```sh
npm install -g https://github.com/amitkaps/prose/releases/download/v0.2.0/amitkaps-prose-0.2.0.tgz
prose .            # read this repository in the browser
prose build        # the same pages as static files, from the last commit
prose publish      # commit that site to the `prose` branch
```

## Docs

[docs/](docs/README.md) has the design, how to use it, the `@prose` convention, and how the renderer works; [development](docs/development.md) is how to build and release it.
