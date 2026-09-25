/** @prose
 * Builds the library (`src/index.ts` → `dist/index.mjs` + `.d.mts`), replacing what used to be a
 * raw `tsc` compile. `platform: "node"` since this only ever runs server-side, inside a
 * consuming app's Vite dev server — the client SPA is a completely separate build
 * (`client/vite.config.ts`), never touched by this one.
 */
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: "esm",
	platform: "node",
	dts: true,
	sourcemap: true,
});
