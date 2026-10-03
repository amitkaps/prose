/** @prose
 * # The toolchain
 *
 * One config for formatting, linting, tests and the build, all run through `vp`. There's no app
 * to build. The one plugin prepares the files the browser gets, for the build and the tests alike.
 *
 * The fixtures in `tests/fixtures/` keep their own style. So `ignored` keeps `vp` out of them
 * when it runs from the root.
 */
import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";
import { format } from "vite-plus/fmt";
import { lexJs } from "./src/lexer.js";

const ignored = ["dist/**", "tests/fixtures/**", "docs/**", "README.md", "pnpm-lock.yaml"];

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

const built = {
  name: "built",
  enforce: "pre" as const,
  async load(id: string) {
    if (!id.endsWith("?built")) return null;
    const file = id.slice(0, -"?built".length);
    const { code, errors } = await format(file, stripComments(file, readFileSync(file, "utf8")));
    if (errors.length) throw new Error(`${file}: ${JSON.stringify(errors)}`);
    return `export default ${JSON.stringify(code)};`;
  },
};

export default defineConfig({
  plugins: [built],

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
   * # The build
   *
   * Builds the library and the command for Node, where the parser and the renderer run.
   * `src/index.ts` and `src/cli.ts` become `dist/*.js`, with their types.
   *
   * The bundler inlines every package outside `dependencies`. So markz is a dev dependency, and
   * its code ships inside `dist/`. So the package has no dependencies at all.
   */
  pack: {
    entry: ["src/index.ts", "src/cli.ts"],
    format: "esm",
    platform: "node",
    // `type: "module"` already makes `.js` ESM; tsdown's Node default would emit `.mjs`.
    fixedExtension: false,
    dts: true,
    sourcemap: true,
    plugins: [built],
  },

  test: {
    expect: { requireAssertions: true },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
