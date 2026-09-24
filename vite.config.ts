import { defineConfig } from "vite-plus";

// `examples/**` each have their own vite-plus config and style — running from the repo root
// must not reach into them. `prose/**` and `README.md` are hand-formatted prose, not code.
const ignored = [
	"dist/**",
	"client/dist/**",
	"examples/**",
	"prose/**",
	"README.md",
	"pnpm-lock.yaml",
];

export default defineConfig({
	// This config drives `vp fmt` / `vp lint` / `vp test` for the plugin's own source.
	// The library itself builds via `tsdown` and the client SPA via
	// `vite build --config vite.client.config.ts` — neither goes through `vp build`.
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
