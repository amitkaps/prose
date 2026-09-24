# Lessons

Things learned building `@amitkaps/prose`, kept separate from `spec.md` (the design) and
`plan.md` (the roadmap) because they're about *how* to build it correctly next time, not *what*
to build.

## Integrating Devframe

- **The client build's `base` must be the devframe's actual mount path, set absolutely — not
  relative.** A relative base (`base: "./"`) breaks the moment the route is reached without its
  trailing slash (`/__prose` instead of `/__prose/`): the browser resolves `./assets/x.js`
  against the *parent* of the last path segment, landing back on the host app's own root instead
  of the devframe's static host. Devframe's default mount for a hosted (`vite`/`embedded`)
  devframe is `/__<id>/`, so hardcode `base: "/__<id>/"` in the client's Vite config to match —
  don't rely on a relative base just because the exact mount path "isn't known at build time" (it
  is, unless the consuming app overrides `basePath`/`base` explicitly, which is rare).
- **This failure mode is easy to misdiagnose as a caching or server problem** because the
  symptoms are inconsistent per request: some asset requests come back a real 404, others come
  back 200 with the *wrong* content-type (the host app's own `index.html`, served by its SPA
  fallback for an unmatched path). `curl -sD - -o /dev/null <url>` on the actual asset URL,
  checking `content-type` and `content-length` against the real built file, cuts through this
  fast — status code alone (`curl -o /dev/null -w "%{http_code}"`) is not enough verification,
  since the wrong content can still return `200`. That gap in verification (checking only status
  codes) is exactly what let this bug ship past Phase 1's own "verified" checklist item.
- **RPC function names must be registered fully-qualified, matching how the client calls them.**
  `client.scope("prose").rpc.call("tree")` auto-prefixes the outgoing call to `"prose:tree"`, but
  `ctx.rpc.register(defineRpcFunction({ name: "tree", ... }))` registers the *literal* string
  given — it does not auto-prefix on the server side. The two sides only agree if the server
  registers `"prose:tree"` explicitly (matching Devframe's own quickstart example's
  `name: 'my-devframe:hello'` pattern). The resulting error
  (`[birpc] function "prose:tree" not found`) is specific enough to point at the fix directly,
  once you know to look at exact-name-on-both-sides rather than at auth or asset-serving.
- **Devframe's browser client (`devframe/client`) isn't headless-friendly out of the box** — it
  touches `location` unconditionally, so a plain Node script needs
  `globalThis.location = new URL(...)` before importing it. Once polyfilled, it's usable from a
  script for diagnosis: a real RPC error (`[birpc] function "..." not found`, or
  `[devframe] Not authorized by the devframe server`) is a much stronger signal than guessing from
  package type declarations, and doesn't require driving an actual browser.
- **The same relative-base bug can hide inside a library's own client, not just your build
  config.** `devframe/client`'s `connectDevframe()` defaults to `baseURL: "./"`, resolved against
  the *current page URL* to fetch `__connection.json` — so visiting `/__prose` (no trailing
  slash) makes that relative fetch resolve against the parent path and 404, throwing
  `Failed to get connection meta from ./`. This is the identical class of bug as the asset-`base`
  one above, just one layer further from the code you wrote — the fix isn't in your Vite config
  this time, it's passing an explicit `baseURL` to `connectDevframe()`. Deriving it from
  `import.meta.url` (`new URL("../", import.meta.url).href`, one directory up from the script's
  own `assets/` folder) is immune to the bug entirely, since a built script's `src` is always
  absolute under the configured `base` regardless of what the address bar shows.
- **`new URL(<string literal>, import.meta.url)` is not a plain runtime call in Vite — it's a
  special static-asset pattern.** The fix above (`new URL("../", import.meta.url)`, to get an
  absolute base directory) built without error and worked in every Node-based headless check, but
  broke in a real browser with `Uncaught Error: Failed to get connection meta from
  data:text/javascript;base64,...`. Vite's build specially recognizes the exact shape
  `new URL(<literal>, import.meta.url)` as a request to resolve a static asset relative to *this
  source file*, at *build time* — not a plain runtime URL join against the deployed page's URL.
  Resolving `"../"` (a directory, not a file) from `client/main.ts` at build time walked up to the
  repo root and picked up its `dist/index.js` (this project's own server-side entry point,
  `export { prose } from "./plugin.js";`), then inlined its tiny contents as a base64 data URL —
  completely unrelated content, silently substituted for the literal string argument. The fix:
  never use that call shape for a "give me a directory" computation; do plain string slicing on
  `import.meta.url` instead (`url.lastIndexOf("/")`, twice, to walk up two segments). Headless
  Node checks didn't catch this because Node doesn't run the code through Vite's asset-URL
  static analysis at all — only an actual Vite production build, inspected for it, would show it
  (`grep -c "data:text/javascript" client/dist/assets/*.js` is now part of that check).
- **`@vitejs/devtools`'s `clientAuth` defaulted to on**, gating new browser clients behind a
  terminal-approved trust handshake, and wasn't a plain option on `DevTools()` itself (passing
  `{ clientAuth: false }` there was a type error) — it lived in a separate `DevToolsConfig` the
  hub resolved from elsewhere. This was one of the reasons for dropping `@vitejs/devtools` for
  `@devframes/vite`'s `devframeViteBridge`, whose `auth` option takes a plain `false` — a real
  fix, not a workaround, once the hub's dock/terminal/command surface turned out to be unneeded
  for this project's "audience of one" target (`spec.md` §2).

## The parser's own tokenizer (found by dogfooding)

Annotating `src/*.ts` and `client/*.ts` with `@prose` — the plugin's own implementation, not just
the examples — surfaced two real gaps in `scanJsLike` that no amount of testing against
`examples/single`/`examples/base` had hit, simply because neither happened to write a regex
literal with a brace, quote, or backtick inside it, or a `@prose` comment inside an inline
callback. Dogfooding a tool against its own source finds exactly this class of bug: real code has
more variety than two curated examples.

- **A `@prose` comment inside an object literal passed to a function call is silently dropped,**
  even though it *looks* just as top-level as any other comment. `defineDevframe({ ...,
  setup(ctx) { /** @prose */ ... } })` puts the comment inside `setup`'s function body, which
  itself is inside the object literal's braces — depth 2, not depth 0. The depth-0 rule (spec
  §3.1) is intentional, not a bug, but a comment sitting right next to code that's clearly
  "inside something" doesn't visually signal that it won't be read. The fix, once noticed, is
  structural: pull the callback out to a named top-level function so its own doc comment can sit
  at depth 0. `src/plugin.ts`'s `registerRpc` is that fix, in this repo.
- **A regex literal is not a string, and `scanJsLike` used to treat every `` ` ``, `"`, or `'` the
  same way regardless of context.** `slugify()`'s own `.replace(/\`/g, "")` — a regex matching a
  literal backtick — made the tokenizer read that backtick as opening a template literal, which
  then only "closed" at the next backtick anywhere later in the file, silently corrupting `{}`
  depth tracking for everything after it. No error, no crash — `@prose` comments after that point
  just stopped being detected, which is a much harder failure mode to notice than a thrown
  exception. The real fix was giving `scanJsLike` actual regex-literal awareness
  (`skipRegexLiteral`): the standard heuristic (a `/` after an operator/opening-bracket/start-of-
  file is a regex; after an identifier/`)`/`]`/closed-string is division) that every JS tokenizer
  uses, short of full keyword lookback (`return /x/` is still misread as division — a known,
  documented limitation, not silently wrong in a new way). Worth remembering generally: a
  from-scratch tokenizer that handles strings and comments but not regex literals is not "mostly
  right" — it's one common construct away from corrupting everything downstream of it, silently.

## The symbol check's parser (found via a real bug report, twice)

- **Reimplementing scope analysis with regexes fails one construct at a time, predictably.**
  `declaredIdentifiers` started as a regex for `function`/`class`/`const`/`interface`/`type`
  declarations. A real bug (`examples/base`'s own `import { marked } from "marked"` not
  resolving) added import parsing. The very next real bug (a function's own parameter, `` `html`
  `` in `headingId(html: string)`) needed parameters too — and a parameter list can't be found
  with a flat regex at all (`heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) =>
  string } }, token)` nests parens and braces for its type annotations). Each fix covered exactly
  the shape whoever wrote it happened to think of; destructuring, class members, and generics were
  all still one bug report away. The actual fix was structural, not another regex: swap in a real
  parser (`oxc-parser`) so the "what does this code declare" question is answered by parsing, not
  pattern-matching text — this closes the whole class of bugs at once (destructuring, nested
  functions, aliasing, all handled correctly by construction) instead of one instance at a time.
- **The obvious first choice (`typescript`, already a dependency) turned out not to work at all** —
  worth checking directly before assuming an API exists. This project deliberately runs
  **TypeScript 7**, the new native/Go-ported compiler ("tsgo"): its installed package's default
  entry point resolves to `version.cjs`, not a JS-facing AST API. There's no `ts.createSourceFile`
  here — confirmed by trying it and getting `Cannot read properties of undefined (reading
  'Latest')`, not by reading changelogs. TypeScript 7.1 is expected to add a WASM-exposed
  compiler API of its own; if that lands and gives the same AST access `oxc-parser` does now, it's
  worth a second look — pure-JS with no native binary is a real advantage for a package that ships
  inside every consuming project's own dependency tree, if the API is actually there when checked.
  Until then, this is a real, working choice, not a placeholder waiting to be replaced.
- **A parser that tolerates invalid input gracefully — instead of throwing — matters when the same
  code path has to handle multiple languages.** `oxc-parser`, fed CSS text from a `.svelte` file's
  `<style>` block, doesn't throw: it returns an empty `program.body` and an `errors` array,
  confirmed directly with a real CSS snippet before relying on it. That's exactly the behavior the
  symbol check needs for chunks whose code isn't JS/TS at all — checked empirically rather than
  assumed, since a stricter build-oriented parser could reasonably have chosen to hard-fail
  instead. `codeLang`, threaded through `parser.ts` (per-chunk, since a `.svelte` file's `<script>`
  and `<style>` blocks share the same comment-scanning path but not the same code language), gates
  the parse attempt at the file/part level anyway — CSS/HTML chunks skip parsing entirely rather
  than leaning on this tolerance as the only safety net.

## Working style

- **When integrating an unfamiliar package, read the installed `.d.ts` files directly** rather
  than relying only on doc-summary fetches (`WebFetch` here ran the actual page through a
  smaller model, which lost or garbled specifics — e.g. it couldn't produce concrete `action`/
  `event`/state examples that the type declarations answered directly). Installing the package
  into a scratch directory and grepping its `dist/*.d.ts` gave ground truth on exact function
  signatures, default values, and — critically — the "mounts inside `@vitejs/devtools`" detail
  the doc-summary omitted entirely, which changed the actual cost of adopting it.
- **A "server responds 200/starts cleanly" check is not the same as "the feature works."** Every
  verification step in this session that only checked HTTP status codes or that the dev server
  booted without throwing passed, right up until a real browser hit three separate, unrelated-
  looking bugs (asset base path, then RPC naming). Full verification of a client/server RPC
  integration needs either a real browser or a headless client that actually calls the RPC layer
  end to end, not just proxies for it (status codes, startup logs).
- **Stray background dev-server processes silently serve stale code and make a real fix look like
  it didn't work.** Across this session, `pkill -f "vp dev --port 5198"` (or similar) repeatedly
  failed to kill the actual `vite-plus-core` child process the CLI spawns — the pattern matched
  the wrapper, not the process holding the port — leaving 2-3 old servers running simultaneously.
  The *oldest* one keeps the port; a fresh rebuild + restart attempt actually starts a new server
  on a different port while the stale one keeps answering `curl`. Symptom: a fix verified correct
  by direct unit testing (`buildTree()` called straight from a script) still shows the old, wrong
  behavior over RPC — which reads exactly like "the fix didn't propagate," and burned real time
  investigating the wrong layer (parser logic) before `ps aux | grep vite` showed multiple
  listeners. Fix: `ps aux | grep -i vite`, kill by literal PID, confirm the process list is
  actually empty before starting one fresh instance — don't trust a `pkill` pattern match without
  checking what's left running.
- **Measuring "this block's indentation" from its closing delimiter line is wrong when the
  delimiter has its own leading whitespace.** `notes.ts`'s first version measured a `@prose`
  block's indent from the position right after its own `*/` — but for a multi-line block, that
  line is `" */"` (the ` * ` gutter's own single leading space), not the block's real column.
  Every note this wrote came out indented one space further than the code around it. The fix
  needed the block's *opening* line's indentation instead, which meant adding a new byte-offset
  field (`ProseChunk.startIndex`) that hadn't been needed before this feature. Caught by a live
  round trip against `examples/base` (not by unit tests against synthetic single-line fixtures,
  which can't reproduce it — a single-line block's opening and closing positions read the same
  indent by coincidence); locked in afterward with a regression test using a deliberately
  multi-line block.
