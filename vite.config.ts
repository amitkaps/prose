/** @prose
 * Drives `vp fmt`, `vp lint`, `vp test` and `vp pack` for the package's own source. There is no
 * app to build, so `plugins` stays empty. `tests/fixtures/**` are fixtures with their own style, and
 * running `vp` from the repo root must not reach into them, so `ignored` excludes them.
 */
import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";

const ignored = ["dist/**", "tests/fixtures/**", "docs/**", "README.md", "pnpm-lock.yaml"];

export default defineConfig({
  plugins: [],

  // oxfmt's defaults, as the editor has them.
  fmt: {
    ignorePatterns: ignored,
  },

  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ignored,
  },

  /** @prose
   * Builds the library and the command (`src/index.ts`, `src/cli.ts` → `dist/*.js` + `.d.ts`)
   * for Node, where the parser and the renderer run.
   */
  pack: {
    entry: ["src/index.ts", "src/cli.ts"],
    format: "esm",
    platform: "node",
    // `type: "module"` already makes `.js` ESM; tsdown's Node default would emit `.mjs`.
    fixedExtension: false,
    dts: true,
    sourcemap: true,
    // `import css from "./style.css?raw"` works under Vite (`vp test`); the bundler needs it said.
    plugins: [
      {
        name: "raw",
        load(id: string) {
          if (!id.endsWith("?raw")) return null;
          return `export default ${JSON.stringify(readFileSync(id.slice(0, -4), "utf8"))};`;
        },
      },
    ],
  },

  test: {
    expect: { requireAssertions: true },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
