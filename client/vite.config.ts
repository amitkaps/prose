/** @prose
 * Builds the `/__prose/` SPA that Devframe serves via `clientAssets` (spec §6.1) — a completely
 * separate build from the library itself (the `pack` block in `../vite.config.ts`), since this one's output is static
 * assets for a browser, not a Node-consumable package.
 *
 * `base: "/__prose/"` is hardcoded, not relative, matching Devframe's default mount path for a
 * hosted devframe (`/__<id>/`; ours is `id: "prose"`, unoverridden — see `src/plugin.ts`). A
 * relative base (`"./"`) breaks whenever the page is reached without its trailing slash
 * (`/__prose`, not `/__prose/`): the browser resolves `"./assets/x.js"` against the *parent* of
 * `"__prose"` in that case, landing on the host app's own root instead.
 */
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
	// No `svelte.config.js`: options go inline. Runes are forced project-wide so a component can't
	// silently fall back to legacy reactivity. Component `<style>` blocks are avoided on purpose
	// (they would be unlayered and beat `@layer` in `style.css`), so all styling is global. Lives in
	// `client/` (not the repo root) because `svelte-check` finds the Svelte config in the `vite.config`
	// of the workspace it checks; `root` is therefore this directory, not the current one.
	plugins: [svelte({ compilerOptions: { runes: true } })],
	root: import.meta.dirname,
	base: "/__prose/",
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
