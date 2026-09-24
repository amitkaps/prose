/** @prose
 * Builds the `/__prose/` SPA that Devframe serves via `clientAssets` (spec §6.1) — a completely
 * separate build from the library itself (`tsdown.config.ts`), since this one's output is static
 * assets for a browser, not a Node-consumable package.
 *
 * `base: "/__prose/"` is hardcoded, not relative, matching Devframe's default mount path for a
 * hosted devframe (`/__<id>/`; ours is `id: "prose"`, unoverridden — see `src/plugin.ts`). A
 * relative base (`"./"`) breaks whenever the page is reached without its trailing slash
 * (`/__prose`, not `/__prose/`): the browser resolves `"./assets/x.js"` against the *parent* of
 * `"__prose"` in that case, landing on the host app's own root instead.
 */
import { defineConfig } from "vite";

export default defineConfig({
	root: "client",
	base: "/__prose/",
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
