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
- **`@vitejs/devtools`'s `clientAuth` defaulted to on**, gating new browser clients behind a
  terminal-approved trust handshake, and wasn't a plain option on `DevTools()` itself (passing
  `{ clientAuth: false }` there was a type error) — it lived in a separate `DevToolsConfig` the
  hub resolved from elsewhere. This was one of the reasons for dropping `@vitejs/devtools` for
  `@devframes/vite`'s `devframeViteBridge`, whose `auth` option takes a plain `false` — a real
  fix, not a workaround, once the hub's dock/terminal/command surface turned out to be unneeded
  for this project's "audience of one" target (`spec.md` §2).

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
