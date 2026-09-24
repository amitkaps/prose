/** @prose
 * Drives `vp fmt` / `vp lint` / `vp test` for the plugin's own source — not `vp build`: the
 * library builds via `tsdown` (`tsdown.config.ts`) and the client SPA via
 * `vite build --config vite.client.config.ts`, so `plugins` stays empty here. `examples/**`
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
		ignorePatterns: ignored,
	},

	lint: {
		plugins: ["typescript", "unicorn", "import"],
		categories: { correctness: "error" },
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: ignored,
	},

	test: {
		expect: { requireAssertions: true },
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
