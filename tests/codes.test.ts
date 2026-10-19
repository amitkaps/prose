/** @prose
 * # Codes tests
 *
 * Holds the code tables in [usage](../docs/usage.md#warnings) and the codes the source emits to
 * the same ids, both ways, so a code can't ship without a row, and a row can't outlive its code.
 *
 * Each row opens with its code as a span, like `` [`no-readme`]{#no-readme} ``, which gives the
 * row a link ([plan](../docs/plan.md#next-in-order)). Each row also names the agent rule its code
 * serves, and each rule opens with its name as a span. So a code can't ship without a rule to say
 * what to write. `prose rules` reads the rows and the rules from the bundled doc, so it's held to
 * them here too.
 */
import { readFileSync } from "node:fs";
import { html, parse, WARNINGS } from "@amitkaps/markz";
import { expect, test } from "vite-plus/test";
import { agentRules, codeRules, MARKZ_RULE } from "../src/rules.js";
import { STYLE_CODES } from "../src/style.js";
import { PROSE_CODES } from "../src/warnings.js";

const source = readFileSync(new URL("../docs/usage.md", import.meta.url), "utf8");
const usage = html(parse(source));

// A section of the rendered doc, from its heading to the next.
function section(id: string): string {
  const start = usage.indexOf(`<h2 id="${id}">`);
  const end = usage.indexOf("<h2 ", start + 1);
  return usage.slice(start, end === -1 ? undefined : end);
}

// The codes a section's table states, each a span whose text is its id.
function stated(id: string): string[] {
  const part = section(id);
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

test("prose rules reads every code's row, from the doc as it is", () => {
  const rules = codeRules();
  expect([...rules.keys()].sort()).toEqual([...PROSE_CODES, ...STYLE_CODES].sort());
  expect(rules).toEqual(codeRules(source));
});

test("prose rules reads every agent rule, each a list item under a group, opening with its name", () => {
  const items = section("for-agents").match(/<li>/g) ?? [];
  const named = [...section("for-agents").matchAll(/<li><span id="([^"]+)"><strong>/g)];
  expect(agentRules().map((rule) => rule.id)).toEqual(named.map(([, id]) => id));
  expect(agentRules()).toHaveLength(items.length);
  expect(agentRules().every((rule) => rule.group)).toBe(true);
  expect(agentRules()).toEqual(agentRules(source));
});

test("every code serves an agent rule, except the codes about a build", () => {
  const rules = new Set(agentRules().map((rule) => rule.id));
  const rows = [...codeRules()];
  expect(rows.filter(([, row]) => row.rule && !rules.has(row.rule))).toEqual([]);
  expect(rows.filter(([, row]) => !row.rule).map(([code]) => code)).toEqual([
    "uncommitted-changes",
    "unignored-build",
  ]);
  expect(rules.has(MARKZ_RULE)).toBe(true);
});

test("no prose code shares a name with a markz code, so `prose rules` reads each one way", () => {
  const markz = new Set(Object.keys(WARNINGS));
  expect([...PROSE_CODES, ...STYLE_CODES].filter((code) => markz.has(code))).toEqual([]);
});
