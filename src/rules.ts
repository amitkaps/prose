/** @prose
 * # `prose rules`
 *
 * The rules an agent writes prose to, read from [usage](../docs/usage.md) as it shipped with this
 * version. The command prints them as raw text, so an agent needs no fetch, and a fetched page
 * goes through a smaller model that drops specifics ([lessons](../docs/lessons.md#working-style)).
 *
 * `prose rules` prints [the agent rules](../docs/usage.md#for-agents), the block a project copies.
 * `prose rules <code>` prints one code's row, from the tables a test holds to the codes the source
 * emits ([tests/codes.test.ts](../tests/codes.test.ts)). Nothing is written twice, since the doc
 * is the source and the build bundles it.
 *
 * markz's codes aren't here. markz keeps its list to itself, and each of its warnings already
 * names the form to write instead. So an unknown code points to markz's syntax.
 */
import usage from "../docs/usage.md?built";

const SITE = "https://prose.amitkaps.com/docs/usage.md";
const MARKZ = "https://markz.amitkaps.com/docs/syntax.md#not-supported";

/** The block under `## For agents`, as a project copies it. */
export function agentRules(text: string = usage): string {
  const section = text.slice(text.indexOf("\n## For agents\n"));
  const start = section.indexOf("```markdown\n") + "```markdown\n".length;
  return section.slice(start, section.indexOf("\n```", start)) + "\n";
}

/** Each code's row, by code, with its kind, a warning or style advice, and when it's given. */
export function codeRules(text: string = usage): Map<string, { kind: string; when: string }> {
  const rules = new Map<string, { kind: string; when: string }>();
  let kind = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("## "))
      kind = { "## Warnings": "warning", "## Style": "style" }[line] ?? "";
    const row = /^\| \[`([a-z-]+)`\]\{#\1\} +\| (.+?) +\|$/.exec(line);
    if (row && kind) rules.set(row[1]!, { kind, when: row[2]! });
  }
  return rules;
}

/** `no-readme (warning): when it's given`, and where the doc says more. A code prose doesn't
 *  have is an error that names markz's list. */
export function codeRule(code: string): string {
  const rule = codeRules().get(code);
  if (!rule) {
    throw new Error(`${code} isn't one of prose's codes. markz's are at ${MARKZ}`);
  }
  return `${code} (${rule.kind}): ${rule.when}\n  ${SITE}#${code}\n`;
}
