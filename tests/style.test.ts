/** @prose
 * # Stylesheet tests
 *
 * Every rule in the shipped stylesheet sits in a cascade layer. A rule outside one would beat
 * every layer, and no page would show the mistake at once ([style.css](../src/page/style.css)).
 */
import { describe, expect, it } from "vite-plus/test";
import { STYLE } from "../src/assets.js";

/** The start of each top-level statement, up to its `{` or `;`. Comments are already stripped. */
function topLevel(css: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      i = css.indexOf(c, i + 1);
    } else if (c === "{") {
      if (depth === 0) found.push(css.slice(start, i).trim());
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) start = i + 1;
    } else if (c === ";" && depth === 0) {
      found.push(css.slice(start, i).trim());
      start = i + 1;
    }
  }
  return found;
}

describe("style.css", () => {
  it("puts every rule in a layer", () => {
    const statements = topLevel(STYLE.body);
    expect(statements).toContain("@layer tokens, base, components");
    expect(statements.filter((s) => !/^@(layer|property|view-transition)\b/.test(s))).toEqual([]);
  });
});
