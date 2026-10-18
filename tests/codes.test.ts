/** @prose
 * # Codes tests
 *
 * Holds the code tables in [usage](../docs/usage.md#warnings) and the codes the source emits to
 * the same ids, both ways, so a code can't ship without a row, and a row can't outlive its code.
 * Each row opens with its code as a span, like `` [`no-readme`]{#no-readme} ``, which gives the
 * row a link ([plan](../docs/plan.md#next-in-order)).
 */
import { readFileSync } from "node:fs";
import { html, parse } from "@amitkaps/markz";
import { expect, test } from "vite-plus/test";
import { STYLE_CODES } from "../src/style.js";
import { PROSE_CODES } from "../src/warnings.js";

const usage = html(parse(readFileSync(new URL("../docs/usage.md", import.meta.url), "utf8")));

// The codes a section's table states, each a span whose text is its id.
function stated(section: string): string[] {
  const start = usage.indexOf(`<h2 id="${section}">`);
  const end = usage.indexOf("<h2 ", start + 1);
  const part = usage.slice(start, end === -1 ? undefined : end);
  return [...part.matchAll(/<td><span id="([^"]+)"><code>([^<]+)<\/code><\/span><\/td>/g)].map(
    ([, id, text]) => {
      expect(text).toBe(id);
      return id!;
    },
  );
}

test("the warnings table states every code prose check prints, and only those", () => {
  expect(stated("warnings").sort()).toEqual([...PROSE_CODES].sort());
});

test("the style table states every code prose style prints, and only those", () => {
  expect(stated("style").sort()).toEqual([...STYLE_CODES].sort());
});
