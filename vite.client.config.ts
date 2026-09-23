import { defineConfig } from "vite";

/** Builds the /__prose/ SPA that Devframe serves via `clientAssets` (spec §6.1). */
export default defineConfig({
	root: "client",
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
