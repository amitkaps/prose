import { defineConfig } from "vite";

/** Builds the /__prose/ SPA that Devframe serves via `clientAssets` (spec §6.1). */
export default defineConfig({
	root: "client",
	// Relative, since the mount path (default `/__prose/`) isn't known at build
	// time and isn't the app's own root — root-absolute asset paths would
	// resolve against the *app's* dev server instead of the devframe's own
	// static host.
	base: "./",
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
