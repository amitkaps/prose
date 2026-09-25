# Lessons

How to build `@amitkaps/prose` correctly next time. `spec.md` is the design, `plan.md` the remaining work; this file is for gotchas and bug classes. Each entry: symptom, cause, fix, how to detect it.

## Integrating Devframe

- **Set the client build's `base` absolutely to the mount path, and pass `connectDevframe()` an explicit `baseURL`.** The same relative-path bug lives at two layers. (1) `base: "./"` in the client's Vite config breaks when the route is hit without its trailing slash (`/__prose`): `./assets/x.js` resolves against the parent path and lands on the host app. Hardcode `base: "/__<id>/"`, Devframe's default mount for a hosted devframe. (2) `connectDevframe()` defaults to `baseURL: "./"`, so `__connection.json` 404s the same way (`Failed to get connection meta from ./`). Derive `baseURL` from `import.meta.url` by string slicing (`lastIndexOf("/")`, twice), not `new URL("../", import.meta.url)` (next entry).
- **`new URL(<string literal>, import.meta.url)` is a build-time asset pattern in Vite, not a runtime join.** With `"../"` it resolved to the repo's `dist/index.js` and inlined it as a `data:text/javascript;base64,…` URL, so the browser failed with `Failed to get connection meta from data:text/javascript…`. Node-based checks never run Vite's asset analysis and passed. Detect with `grep -c "data:text/javascript" client/dist/assets/*.js`; `scripts/check-client-bundle.mjs` now does this as the last `pnpm build` step.
- **Register RPC names fully qualified on the server.** `client.scope("prose").rpc.call("tree")` prefixes to `prose:tree`, but `ctx.rpc.register(defineRpcFunction({ name: "tree" }))` registers the literal string. Register `"prose:tree"`. The error `[birpc] function "prose:tree" not found` points straight at it.
- **Verify asset serving by content, not status.** A wrong base can return `200` with the host app's `index.html`. Use `curl -sD - -o /dev/null <url>` and compare `content-type` and `content-length` with the built file.
- **`SharedState` can resolve before it is populated.** `sharedState("tree")` with no client `initialValue` takes an internal trusted branch that resolves at once; `.value()` is `undefined` for a tick, then the real data arrives as an ordinary `"updated"` event. `client/main.ts`'s `firstTreeValue()` reads `.value()` and falls back to awaiting the first `"updated"`. Found with a live headless script, not by reading source.
- **Devframe's node context does not expose Vite's watcher** (its own doc comment says it is narrower than `ViteDevServer`). Watch files in a plain `configureServer` plugin and share one closure-scoped object with `registerRpc`'s `setup(ctx)`, not a module-level global, so multiple `prose()` instances can't collide.
- **Headless clients:** `devframe/client` reads `location` unconditionally, so a Node script needs `globalThis.location = new URL(...)` first. Use `transport: "websocket"`; forcing `"sse"` hung every RPC call in this environment (not root-caused). A real RPC error from a script beats guessing from `.d.ts`.
- **`@vitejs/devtools` was the wrong host.** Its `clientAuth` defaulted on, gated by a terminal-approved handshake and not a plain option on `DevTools()`, and it brings a dock/terminal/command surface a one-developer tool doesn't need. `@devframes/vite`'s `devframeViteBridge` takes `auth: false` directly. See spec §6.

## The parser and scanner

Found by dogfooding on the plugin's own source; `examples/single` and `examples/base` hadn't hit them. Real code has more variety than two curated examples.

- **A `@prose` block inside a callback or object literal is silently dropped.** `defineDevframe({ setup(ctx) { /** @prose */ } })` is at depth 2, not 0. The depth-0 rule (spec §3.1) is intentional but gives no visual hint. Pull the callback out to a named top-level function (`registerRpc` in `src/plugin.ts`).
- **A tokenizer that handles strings and comments but not regex literals is one construct from silent corruption.** `.replace(/\`/g, "")` read the backtick as a template-literal opener, which "closed" at the next backtick in the file and broke `{}` depth for everything after. No error, comments just stopped being found. `scanJsLike` now has `skipRegexLiteral` (the last-significant-token heuristic); `return /x/` is still misread as division, a documented limitation.
- **A scanner with no closing delimiter must let the marker define the boundary.** YAML/TOML `#` comments: collecting every contiguous `#` line and checking only the first for a marker merged a `@prose` and its back-to-back `@note`. A block now runs from a marker line to the next marker line or the first non-`#` line. Ask "what happens when two blocks touch," not just "what happens at the end." Caught by writing that test case directly.
- **Measure a block's indentation from its opening line, not its closing one.** A multi-line block's closing line is `" */"`, with the gutter's own leading space, so every inserted `@note` was one space too deep. `ProseChunk.startIndex` fixes it. A single-line block can't reproduce this; only a live round trip against `examples/base` and a multi-line regression test show it.

## The symbol check

- **Don't reimplement scope analysis with regexes.** `declaredIdentifiers` grew one construct per bug report: imports (`marked`), then parameters (`html` in `headingId(html: string)`, whose nested parens and braces no flat regex can find), with destructuring and class members still pending. The fix was structural: parse with `oxc-parser` (the engine oxlint, oxfmt and tsdown already use) and walk the AST. Keep parameters (`declaredParameters`) local-only so they never enter the cross-file table.
- **Check that an API exists before choosing it.** `typescript` is TS 7 here (the native port); its package entry resolves to `version.cjs`, with no `ts.createSourceFile` (`Cannot read properties of undefined (reading 'Latest')`). Revisit if 7.1's WASM compiler API arrives, since pure JS has no native binary to ship.
- **A tolerant parser matters when one path serves several languages.** `oxc-parser` on CSS returns an empty `program.body` plus `errors`, no throw (checked with a real snippet). `codeLang` per chunk gates the parse anyway, since a `.svelte` file's `<script>` and `<style>` share the comment-scanning path.
- **Real false positives come from real projects.** Package names in prose (`` `marked` ``), JS builtins (`Set`), file names (`README.md`), reserved words (`return`, `import`) and `import.meta.*` were all flagged. Fixes: `package.json` dependency names, `BUILTIN_GLOBALS`, filename-shaped spans and a longer keyword list skipped; the file's preamble scope shared by all its chunks.

## Build and tooling

- **A `200` or a clean startup is not "the feature works."** Every early check passed until a browser hit three unrelated bugs (asset base, RPC naming, `location`). Verify a client/server integration with a browser or a headless client that calls the RPC layer end to end.
- **No standalone tests meant one-off scripts, written and thrown away, which is how the `new URL` bug shipped.** Now: `vp test` for parser, tree, checks, notes; `vp check` (oxfmt + type-aware oxlint) on `src/`, `client/` and root config; `check-client-bundle.mjs` for the one bug class no Node test can see.
- **`oxlint`'s type-aware mode (`tsgolint`) is the type check** for `.ts`, not a separate `tsc --noEmit`; it caught a real `no-floating-promises` at once. It does not read `.svelte`, so `svelte-check` covers those (next section).
- **Import shiki through `shiki/core`, not the main entry.** The main `codeToHtml` resolves `lang` by name at runtime, so Rollup kept all ~200 grammars as lazy chunks (321 files in `client/dist`). Explicit `@shikijs/langs/*` imports plus `createHighlighterCore` gave 14 assets, ~1.5 MB; keep the highlighter lazy and memoized.
- **SvelteKit's `vite build` never runs `transformIndexHtml`** (it warns "not supported"). The HTML strip (spec §6.4) is skipped there. Harmless today, but a `@prose` in `app.html` on a SvelteKit host would ship to production with no error, only that easy-to-miss warning. Not something this plugin can detect.
- **A global `code { padding }` rule for inline spans also hit shiki's `<pre><code>`,** adding a stray space before every block's first token. Copying the text came out clean, since padding is box model, not content. Fix with a `pre code` reset.

## The Svelte client

`examples/base` (`src/content/lessons.md`) had already worked through most of this.

- **Stay on TypeScript 6.x.** TS 7 (the native port) breaks `svelte-check`, which still expects the 6.x JS API. The repo was on 7.0.2 and is back on 6.0.3. Re-test when svelte-check supports the native port.
- **`svelte-check` finds the Svelte config in the `vite.config` of the workspace it checks**, and `vp check` doesn't read `.svelte` at all. The root `vite.config.ts` is the `vite-plus` tooling config with no Svelte plugin, so the client build config lives at `client/vite.config.ts` (with `root: import.meta.dirname`) and `check` runs `svelte-check --workspace client`. Symptom otherwise: `No Svelte configuration found in vite config`.
- **`client/tsconfig.json` needs `types: ["node", …]`** because the client imports the `TreeNode` type from `src/tree.ts`, which uses `node:fs`. Type-only import: the server module must never be bundled into the browser.
- **Component `<style>` blocks are unlayered and beat `@layer`**, so styling stays in the global `style.css`.
- **Force runes** (`compilerOptions: { runes: true }`) so a component can't fall back to legacy reactivity. Reactive class fields (`$state`, `$derived`) require a `.svelte.ts` module; keep logic that Node tests must reach (`nav.ts`, `stats.ts`, `fuzzy.ts`) in plain `.ts`.
- **Derive the current node from the pushed tree instead of fetching it.** The tree already carries every node's prose, code and note, so a lookup by path is local, live updates re-render for free, and there's no async flash. The old client fetched `node` per navigation and rebuilt `innerHTML` wholesale, which also wiped a half-typed note whenever a file changed.
- **Found by dogfooding again:** the symbol check flagged browser globals (`sessionStorage`) named in the client's prose. `BUILTIN_GLOBALS` now lists the common ones.

## The file as the leaf

- **A chunk shown alone doesn't make sense**, so the tree stops at files and blocks hang off the file node (`blocks`, each with its comment's byte `span`). The page lays the source out around those spans, dropping the comment text and rendering it as prose in its place, which shows the whole file with nothing repeated. Exact offsets beat line ranges here; the `.svelte` part-clipping had already shown that per-chunk code slices lose the tags between parts.
- **Checking file prose adds noise, so scope it.** Once the file prose became a checked block, about 20 new warnings appeared. Two were structural: its "code" is only the preamble, so a staleness comparison against imports means nothing (skipped), and its prose describes the whole file, so it resolves against everything the file declares, not just the imports. The rest are the usual symbol-check false positives on external names.

## Design review (2026-09-25)

Found by reading the spec against the code rather than by running either; `prose/review.md` has the full list.

- **A write path that builds comments from user text must escape the delimiter.** `formatNote` put note text inside `/** … */` verbatim, so a note containing `*/` closed the comment and the rest became live code, run by HMR. Every round-trip test used friendly text. Detect with property tests over arbitrary note text, not examples (spec §6.2).
- **An address built from position isn't stable, whatever the spec calls it.** The spec promised `#addTodo`; the code produced `top-chunk-2`, which moves when a block is inserted above. Re-parsing the file fresh on every write didn't help, because the address itself had moved. Derive anchors from content and guard writes with a content hash (spec §3.2).
- **`git blame` can't tell who wrote a line when the human makes every commit.** Author-based ideas (agent notes vs human notes) fail in a one-person-plus-agents workflow. Put anything that needs an author in the text itself.
- **Don't assume work gets committed.** Sessions run long and uncommitted; blame-based checks see all of it as "newest". Anything the view needs within a session has to compare against the working tree or the review baseline the browser keeps (spec §2, §6.5).
- **Section references drift like any other reference.** Code prose cited §6.4 for the RPC handlers (§6.3) and §3.3 for rules in §3.1. Check them (plan step 7a) and don't renumber sections casually; add new ones at the end of their chapter.

## Safe writes

- **Devframe's origin check lets through clients that send no `Origin` header.** It refuses browser pages on non-loopback origins, but it treats a connection with no `Origin` as a native tool and allows it. So with `vite --host`, anything on the network could call `add-note`. The loopback check on the HTTP server's own bound address (`isLoopbackAddress` from `devframe/utils/origin`) is what closes that. Verified with a headless client against a `--host` server; reading the origin module alone suggested the boundary was already covered.
- **Property tests found a CRLF bug that no example had.** The parser kept the `\r` of a CRLF line inside comment text, and the `#`-style scanner's `endIndex` sat between `\r` and `\n`, so a note inserted in a CRLF YAML/TOML file would have split a line ending. Fixture variants (LF, CRLF, no final newline) cost one line each in the generator.
- **Property-test the pure edit, not the file write.** Going through `addNote` put `git ls-files`, a tree build and file I/O in every run, and 100 runs timed out. Splitting out `withNote`/`withoutNote` (source in, source out) gave 500 runs per comment style in about a second, leaving the path guard to ordinary example tests.
- **A mechanical rename across a test file also renamed the helper it introduced.** Replacing `addNote(root, ` with `add(` turned `add`'s own body into `add(…)`, which recursed with a tree build at each level. It looked like slow property tests, not a bug. When a run hangs, time one test at a time (`-t`) before tuning the slow-looking one.

## Working style

- **Read the installed `.d.ts` files, not a summarized doc fetch.** `WebFetch` ran pages through a smaller model that lost specifics (no concrete `action`/`event`/state examples, and it omitted "mounts inside `@vitejs/devtools`", which changed the cost of adopting it). Install into a scratch directory and grep `dist/*.d.ts`.
- **Stale dev servers make a correct fix look broken.** `pkill -f "vp dev --port …"` matched the wrapper, not the child `vite-plus-core` holding the port; the oldest server kept answering while a new one started elsewhere. A fix verified by a direct `buildTree()` call still failed over RPC, which burned time in the parser. `ps aux | grep -i vite`, kill by PID, and confirm the list is empty before starting one.
