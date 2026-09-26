/** @prose
 * Drives `vp fmt` / `vp lint` / `vp test` / `vp pack` for the plugin's own source — not `vp build`:
 * the library builds via `vp pack` (the `pack` block below) and the client SPA via
 * `vite build --config client/vite.config.ts`, so `plugins` stays empty here. `examples/**`
 * each have their own `vite-plus` config and style; running `vp` from the repo root must not
 * reach into them, which is why `ignored` excludes them explicitly rather than relying on
 * per-project config discovery.
 */
import { defineConfig } from "vite-plus";

const ignored = [
	"dist/**",
	"client/dist/**",
	"examples/**",
	"prose/**",
	"README.md",
	"pnpm-lock.yaml",
];

export default defineConfig({
	plugins: [],

	fmt: {
		useTabs: true,
		printWidth: 100,
		svelte: { indentScriptAndStyle: true },
		ignorePatterns: ignored,
	},

	lint: {
		plugins: ["typescript", "unicorn", "import"],
		categories: { correctness: "error" },
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: ignored,
	},

	/** @prose
	 * Builds the library (`src/index.ts` → `dist/index.js` + `.d.ts`). `platform: "node"` since
	 * this only ever runs server-side, inside a consuming app's Vite dev server — the client SPA is
	 * a completely separate build (`client/vite.config.ts`), never touched by this one.
	 */
	pack: {
		entry: ["src/index.ts"],
		format: "esm",
		platform: "node",
		// `type: "module"` already makes `.js` ESM; tsdown's Node default would emit `.mjs`.
		fixedExtension: false,
		dts: true,
		sourcemap: true,
	},

	test: {
		expect: { requireAssertions: true },
		environment: "node",
		include: ["src/**/*.test.ts", "client/**/*.test.ts"],
	},
});
