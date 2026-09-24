import { defineConfig } from "vite";

/** Builds the /__prose/ SPA that Devframe serves via `clientAssets` (spec §6.1). */
export default defineConfig({
	root: "client",
	// Devframe's default mount path for a hosted devframe is `/__<id>/`; ours
	// is `/__prose/` (id: "prose", unoverridden — see src/plugin.ts). A plain
	// relative base ("./") breaks whenever the page is reached without its
	// trailing slash (e.g. "/__prose", not "/__prose/"): the browser resolves
	// "./assets/x.js" against the *parent* of "__prose" in that case, landing
	// on the app's own root instead. Hardcoding the known absolute mount path
	// avoids that.
	base: "/__prose/",
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
