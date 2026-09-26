# prose

Literate programming for the web: standard source files, a light `@prose` convention in their
comments, and a dev route (`/__prose/`) that shows the codebase as a navigable, annotatable
document. It is code review without a pull request, for one person working with coding agents.

- **Convention:** `/** @prose … */` blocks in JS/TS/CSS/Svelte/HTML explain the code beneath them;
  `@note` leaves review notes. Cross-cutting prose lives in `prose/*.md`.
- **Tool:** a Vite plugin that serves the map at `/__prose/` in dev only, and strips `@prose`
  comments from built HTML.

The design is in [prose/spec.md](prose/spec.md).

## Install

Until it is on a registry, install a tagged release straight from GitHub (pick the version from
the [releases page](https://github.com/amitkaps/prose/releases)):

```sh
pnpm add -D https://github.com/amitkaps/prose/releases/download/v0.1.0/amitkaps-prose-0.1.0.tgz
# npm / yarn work the same with that URL
```

Requires Node ≥ 22.12 and Vite 8 (or Vite+, which is Vite 8 underneath).

## Use

```ts
// vite.config.ts
import { defineConfig } from "vite"; // or "vite-plus"
import { prose } from "@amitkaps/prose";

export default defineConfig({
	plugins: [prose()],
});
```

Run the dev server and open `http://localhost:5173/__prose/`. Then write `@prose` blocks (see the
spec, §3) or ask your agent to. The route is dev-only, binds to loopback for writes, and adds
nothing to `vite build` output other than stripping prose comments from HTML.

## Develop

```sh
pnpm install
pnpm run check && pnpm run test
pnpm run build        # library (vp pack) + client SPA
pnpm run dev:prose    # dogfood /__prose/ on this repo
```

## Release

Bump `version` in `package.json`, merge to `main`, then tag and push:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The `release` workflow verifies the tag matches `package.json`, runs checks and tests, builds, and
attaches `amitkaps-prose-<version>.tgz` to a GitHub Release.
