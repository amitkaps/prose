# prose

Standard web source files, a light prose convention in their comments, and a dev route that shows
the codebase as a navigable, annotatable document. It is code review without a pull request, for
one person working with coding agents.

- The **app** is where the code executes.
- **`/__prose/`** is where prose and code are read, navigated, and given direction.

## The convention

Three things, and nothing else:

**1. `@prose`: a marker in comments.** A comment whose first token is `@prose` is a prose block: the
maintained explanation of the code that follows it. Everything else stays an ordinary code comment.
`@prose` and the closing delimiter each sit on their own line.

| Language          | Prose block                        |
| ----------------- | ---------------------------------- |
| JS, TS, Svelte `<script>` | `/** @prose … */`          |
| CSS, Svelte `<style>`     | `/** @prose … */`          |
| HTML, Svelte markup       | `<!-- @prose … -->`        |
| YAML, TOML        | `# @prose …`, at column 0          |

```ts
/** @prose
 * # State
 *
 * The count is a single number in module scope.
 */
```

**2. `@note`: feedback, in source.** A temporary note left for the agent (or yourself), in the same
comment style, right after a `@prose` block or directly above a line of code. Notes are mostly
added from the view; resolving one deletes it.

**3. `prose/`: cross-cutting prose.** A root `prose/` folder holds Markdown that explains across
the codebase (architecture, migrations, lessons), linked to code with ordinary Markdown links.
Folder `README.md`s are folder prose.

The Vite plugin serves all of this at `/__prose/` in dev only, and strips `@prose` comments from
built HTML. The full design is in [prose/spec.md](prose/spec.md).

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
