# The page

What the browser gets: the page's frame, its stylesheet and its scripts. They're written as ordinary HTML, CSS and JS, so the editor, the formatter and the linter treat them as code.

The build imports each one with `?built`, which strips its comments and formats it ([vite.config.ts](../../vite.config.ts)). So the prose stays in the repository, and the browser gets clean, readable code. Nothing is minified ([assets.ts](../assets.ts)).

- [page.html](page.html) is the frame around every page, filled in by [render.ts](../render.ts).
- [style.css](style.css) is the one stylesheet, and [page.js](page.js) the one script, both shared files.
- [live.js](live.js) is the live reload, sent only by `prose .`.
- [mode.js](mode.js) and [rail.js](rail.js) run inline, before the first paint.
