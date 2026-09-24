/** @prose
 * # Build config
 *
 * One [`vite-plus`](https://vite-plus.dev) config drives dev, build, format, lint and test —
 * `vp <script>` in `package.json` reads whichever of the sections below its command needs.
 * `prose()` (this repo's own dev tool, see [`../../docs/spec.md`](../../docs/spec.md)) is mounted
 * alongside SvelteKit's own plugin, at `/__prose/`.
 */
import { defineConfig } from 'vite-plus';
import { prose } from '@amitkaps/prose';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

const generated = ['.svelte-kit/**', 'build/**', 'worker-configuration.d.ts'];

/** @prose The SvelteKit plugin installs a dev-server hook that is incompatible with the Vitest
 *  environment. Unit tests cover pure modules plus `import.meta.glob` content loading, none of
 *  which need SvelteKit — so plugins (including `prose()`) are skipped entirely under Vitest. */
const inTest = !!process.env.VITEST;

export default defineConfig({
	plugins: inTest
		? []
		: [
				sveltekit({
					// SvelteKit 3 takes these options flat — not under a `kit` key.
					prerender: {
						// Prerendering follows every internal link, so a strict handler
						// turns the build into a link checker. Add a path here only when
						// something outside this app serves it.
						handleHttpError: ({ path, referrer, message }) => {
							const external: string[] = [];
							if (external.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))
								return;
							throw new Error(`${message} (linked from ${referrer})`);
						}
					},
					compilerOptions: {
						// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
						runes: ({ filename }) =>
							filename.split(/[/\\]/).includes('node_modules') ? undefined : true
					},
					adapter: adapter()
				}),
				prose()
			],

	// Oxfmt — `vp fmt` / `vp check`. Formats .ts/.js/.svelte/.css/.json.
	fmt: {
		useTabs: true,
		singleQuote: true,
		semi: true,
		printWidth: 100,
		trailingComma: 'none',
		svelte: { indentScriptAndStyle: true },
		sortPackageJson: true,
		ignorePatterns: [...generated, 'pnpm-lock.yaml', 'CHANGELOG.md']
	},

	// Oxlint — `vp lint` / `vp check`. Lints .ts/.js only; `.svelte` type + a11y
	// diagnostics come from `pnpm check:svelte`.
	lint: {
		plugins: ['typescript', 'unicorn', 'import'],
		categories: { correctness: 'error' },
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: generated
	},

	// Vitest — `vp test`.
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
