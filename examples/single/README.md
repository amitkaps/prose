# single (Prose example)

A counter on one static page: plain HTML, CSS and JS, served and built by Vite, with no runtime
dependencies and no framework.

It is the smallest Prose test case (see [`prose/spec.md`](../../prose/spec.md) §9). Every file
follows the prose convention: comments marked `@prose` (`/** @prose … */` in CSS and JS,
`<!-- @prose … -->` in HTML) are prose, and each one explains the code that follows it.

```sh
pnpm install
pnpm dev
```
