/** @prose
 * Dogfoods `/__prose/` against this repo's own root — `prose()` served over the plugin's own
 * source, not an example. Deliberately separate from `vite.config.ts` (which drives
 * `vp fmt`/`vp lint`/`vp test` and has no dev server) and `client/vite.config.ts` (the client
 * SPA's own build): this one exists purely to run `vite dev` and open `/__prose/` here, at
 * `pnpm run dev:prose`. Imports `prose()` from `./src/index.js` directly rather than adding
 * `@amitkaps/prose` as a self-dependency, since Vite's config loader transpiles a `.ts` config's
 * own imports on the fly. Needs the client SPA already built (`pnpm build`, or just
 * `vite build --config client/vite.config.ts`) — `devframeVitePlugin` serves `client/dist`, not
 * source, same as it would for any consuming project.
 */
import { defineConfig } from "vite";
import { prose } from "./src/index.js";

export default defineConfig({
	plugins: [prose()],
});
