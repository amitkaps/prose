/** @prose
 * # Codes tests
 *
 * Holds the code tables in [usage](../docs/usage.md#warnings) and the codes the source emits to
 * the same ids, both ways, so a code can't ship without a row, and a row can't outlive its code.
 *
 * Each row opens with its code as a span, like `` [`no-readme`]{#no-readme} ``, which gives the
 * row a link ([plan](../docs/plan.md#next-in-order)). Each row also links to the agent rule its
 * code serves, and each rule opens with its name as a span. So a code can't ship without a rule to
 * say what to write. `prose rules` reads the rows and the rules from the bundled doc, so it's held
 * to them here too, and prose's own rules are held to a snapshot, so a change to how they're read
 * shows.
 */
import { readFileSync } from "node:fs";
import { html, parse, WARNINGS } from "@amitkaps/markz";
import { codesOf, markz, printRules } from "@amitkaps/markz/rules";
import { expect, test } from "vite-plus/test";
import { proseRules } from "../src/rules.js";
import { STYLE_CODES } from "../src/style.js";
import { PROSE_CODES } from "../src/warnings.js";

const source = readFileSync(new URL("../docs/usage.md", import.meta.url), "utf8");
const usage = html(parse(source));
const prose = proseRules();

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
  expect(stated("advice-on-style").sort()).toEqual([...STYLE_CODES].sort());
});

test("prose rules reads every code's row, with its level, from the doc as it is", () => {
  const level = (code: string) => prose.codes.find((c) => c.code === code)?.level;
  expect(prose.codes.map((c) => c.code).sort()).toEqual([...PROSE_CODES, ...STYLE_CODES].sort());
  expect(PROSE_CODES.map(level).every((l) => l === "warning")).toBe(true);
  expect(STYLE_CODES.map(level).every((l) => l === "note")).toBe(true);
  expect(prose.codes.every((c) => c.message && c.instead)).toBe(true);
  expect(prose).toEqual(proseRules(source));
});

test("prose rules reads every agent rule, each a list item under a group, opening with its name", () => {
  const items = section("for-agents").match(/<li>/g) ?? [];
  const named = [...section("for-agents").matchAll(/<li><span id="([^"]+)"><strong>/g)];
  expect(prose.rules.map((rule) => rule.id)).toEqual(named.map(([, id]) => id));
  expect(prose.rules).toHaveLength(items.length);
  expect(prose.rules.every((rule) => rule.group)).toBe(true);
});

test("every code serves one agent rule, except the codes about a build", () => {
  const serving = prose.codes.map(({ code }) => ({
    code,
    rules: prose.rules.filter((r) => codesOf([prose], r).some((c) => c.code === code)).length,
  }));
  expect(serving.filter((s) => s.rules !== 1).map((s) => s.code)).toEqual([
    "uncommitted-changes",
    "unignored-build",
  ]);
  expect(serving.filter((s) => s.rules > 1)).toEqual([]);
});

test("prose's rules print as they did", () => {
  expect(printRules([prose])).toMatchSnapshot();
});

test("no prose rule or code shares an id with markz's, so `prose rules` reads each one way", () => {
  const theirs = new Set([...Object.keys(WARNINGS), ...markz.rules.map((r) => r.id)]);
  const ours = [...prose.rules.map((r) => r.id), ...prose.codes.map((c) => c.code)];
  expect(ours.filter((id) => theirs.has(id))).toEqual([]);
});
