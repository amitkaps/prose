/** @prose
 * # The toolchain
 *
 * One config for formatting, linting, tests and the build, all run through `vp`. There's no app
 * to build. The one plugin prepares the files the browser gets, for the build and the tests alike.
 *
 * Formatting and linting cover every file git tracks, the docs and READMEs included. Both
 * already skip what `.gitignore` lists, and oxfmt skips lockfiles.
 *
 * The one exception is `tests/fixtures/`. A fixture stands in for another project, with tabs and
 * single quotes, and a test checks that its code shows as written. Lint passes there today, but
 * skips it too, so a fixture can hold whatever code a test needs.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite-plus";
import { format } from "vite-plus/fmt";
import { lexJs } from "./src/lexer.js";

/** @prose
 * # The browser's files
 *
 * The files in `src/page/` are imported with `?built`, as text that's ready to send. Their
 * comments are stripped, since the prose is for the repository and the page needs only the code.
 * Then oxfmt formats them, so the page source reads cleanly in the browser. Nothing is minified
 * ([assets.ts](src/assets.ts)).
 *
 * JS comments are found by the lexer, so a `//` in a string or a regex stays. A removed comment
 * leaves a space, so two tokens can't run together. The bundler and the tests both load the files
 * through this plugin, so the tests check what ships.
 */
function stripComments(file: string, text: string): string {
  if (file.endsWith(".html")) return text.replace(/<!--[\s\S]*?-->\n?/g, "");
  if (file.endsWith(".css")) {
    // A string is matched first and kept, so a `/*` inside one isn't read as a comment.
    return text.replace(
      /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?\*\//g,
      (match, string?: string) => string ?? " ",
    );
  }
  let out = "";
  let at = 0;
  for (const token of lexJs(text)) {
    if (token.kind !== "comment") continue;
    out += text.slice(at, token.start) + " ";
    at = token.end;
  }
  return out + text.slice(at);
}

// Vite's CSS handling claims any id with `.css` before its end or a `?`, and empties it in the
// tests. So a built file's id ends in `.built` instead.
const BUILT = "\0built:";

const built = {
  name: "built",
  enforce: "pre" as const,
  resolveId(id: string, importer?: string) {
    if (!id.endsWith("?built") || !importer) return null;
    return BUILT + resolve(dirname(importer), id.slice(0, -"?built".length)) + ".built";
  },
  async load(id: string) {
    if (!id.startsWith(BUILT)) return null;
    const file = id.slice(BUILT.length, -".built".length);
    const { code, errors } = await format(file, stripComments(file, readFileSync(file, "utf8")));
    if (errors.length) throw new Error(`${file}: ${JSON.stringify(errors)}`);
    return `export default ${JSON.stringify(code)};`;
  },
};

export default defineConfig({
  plugins: [built],

  // oxfmt's defaults, as the editor has them.
  fmt: {
    ignorePatterns: ["tests/fixtures/**"],
  },

  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["tests/fixtures/**"],
  },

  /** @prose
   * # The build
   *
   * Builds the library and the command for Node, where the parser and the renderer run.
   * `src/index.ts` and `src/cli.ts` become `dist/*.js`, with their types.
   *
   * The bundler inlines every package outside `dependencies`. So markz is a dev dependency, and
   * its code ships inside `dist/`. So the package has no dependencies at all.
   *
   * What ships is readable code, without its prose, as the page's files are. A `/*!` banner
   * carries the license, so it stays with the code even when another build bundles prose. It isn't minified, so
   * anyone reading it in `node_modules` can follow it. Comments are stripped, but license comments
   * stay, and so do annotations like `@__PURE__`, which help a bundler that takes prose in.
   * There are no sourcemaps. They would carry every source file whole, and the source is on GitHub.
   */
  pack: {
    entry: ["src/index.ts", "src/cli.ts"],
    format: "esm",
    platform: "node",
    // `type: "module"` already makes `.js` ESM; tsdown's Node default would emit `.mjs`.
    fixedExtension: false,
    dts: { generator: "oxc" },
    sourcemap: false,
    banner: { js: "/*! @amitkaps/prose · MIT License · https://github.com/amitkaps/prose */" },
    outputOptions: { comments: { legal: true, annotation: true, jsdoc: false } },
    // publint checks the package's `exports`, `files` and types, and fails the build on a problem.
    publint: { strict: true },
    plugins: [built],
  },

  test: {
    expect: { requireAssertions: true },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
