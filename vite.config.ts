/** @prose
 * Drives `vp fmt`, `vp lint`, `vp test` and `vp pack` for the package's own source. There is no
 * app to build, so `plugins` stays empty. `examples/**` are fixtures with their own style, and
 * running `vp` from the repo root must not reach into them, so `ignored` excludes them.
 */
import { defineConfig } from "vite-plus";

const ignored = ["dist/**", "examples/**", "prose/**", "README.md", "pnpm-lock.yaml"];

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
	 * Builds the library (`src/index.ts` → `dist/index.js` + `.d.ts`) for Node, where the parser
	 * and the renderer run.
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
		include: ["src/**/*.test.ts"],
	},
});
