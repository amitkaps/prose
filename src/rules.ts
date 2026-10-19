/** @prose
 * # `prose rules`
 *
 * The rules an agent writes prose to, read from [usage](../docs/usage.md) as it shipped with this
 * version. The command prints them as raw text, so an agent needs no fetch, and a fetched page
 * goes through a smaller model that drops specifics ([lessons](../docs/lessons.md#working-style)).
 *
 * The doc drives both halves. Each of [the agent rules](../docs/usage.md#for-agents) is a list
 * item that opens with its name as a span, under a heading for its group, and each code's row
 * names the rule it serves. So
 * `prose rules` prints every rule with the codes that check it, and `prose rules <code>` prints
 * one code's row and then its rule. Nothing is written twice, since the doc is the source and the
 * build bundles it. A test holds the rows, the rules and the codes the source emits to each other
 * ([tests/codes.test.ts](../tests/codes.test.ts)).
 *
 * A markz code, like `reference-link`, prints markz's own text and its rule in markz's syntax,
 * from the list markz exports. The bundled markz is the one `check` ran, so the text matches.
 * Every markz code serves one rule, the one about markz's Markdown.
 */
import { WARNINGS, type WarningCode } from "@amitkaps/markz";
import usage from "../docs/usage.md?built";

const SITE = "https://prose.amitkaps.com/docs/usage.md";
const MARKZ = "https://markz.amitkaps.com/docs/syntax.md";

/** The rule every markz code serves. */
export const MARKZ_RULE = "markz-markdown";

/** An agent rule: its group, its id, its name and its text, without the name. */
export interface AgentRule {
  group: string;
  id: string;
  name: string;
  text: string;
}

/** A code's row: a warning or style advice, when it's given, and the id of the rule it serves. */
export interface CodeRow {
  kind: string;
  when: string;
  rule?: string;
}

/** The rules under `## For agents`, in order, each from a line like `- [**Name.**]{#id} Text`
 *  under a `###` heading for its group. */
export function agentRules(text: string = usage): AgentRule[] {
  const rules: AgentRule[] = [];
  let group = "";
  for (const line of text.slice(text.indexOf("\n## For agents\n")).split("\n")) {
    if (line.startsWith("### ")) group = line.slice(4);
    const rule = /^- \[\*\*(.+?)\*\*\]\{#([a-z-]+)\} (.+)$/.exec(line);
    if (rule) rules.push({ group, id: rule[2]!, name: rule[1]!, text: rule[3]! });
  }
  return rules;
}

/** Each code's row, by code, from the tables under `## Warnings` and `## Style`. */
export function codeRules(text: string = usage): Map<string, CodeRow> {
  const rows = new Map<string, CodeRow>();
  let kind = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("## "))
      kind = { "## Warnings": "warning", "## Style": "style" }[line] ?? "";
    const row = /^\| \[`([a-z-]+)`\]\{#\1\} +\| (.+?) +\| (?:\[[^\]]+\]\(#([a-z-]+)\))? *\|$/.exec(
      line,
    );
    if (row && kind) rows.set(row[1]!, { kind, when: row[2]!, ...(row[3] && { rule: row[3] }) });
  }
  return rows;
}

// One rule, as a list item, with the codes that check it on the line below.
function printRule(rule: AgentRule, rows: Map<string, CodeRow>): string {
  const codes = [...rows].filter(([, row]) => row.rule === rule.id).map(([code]) => `\`${code}\``);
  if (rule.id === MARKZ_RULE) codes.unshift("markz's warnings");
  const by = codes.length ? `\n  Checked by ${list(codes)}.` : "";
  return `- **${rule.name}** ${rule.text}${by}\n`;
}

function list(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Every agent rule under its group's heading, each with the codes that check it, for
 *  `prose rules`. */
export function printRules(): string {
  const rows = codeRules();
  let group = "";
  let out = "";
  for (const rule of agentRules()) {
    if (rule.group !== group) out += `${out ? "\n" : ""}## ${(group = rule.group)}\n\n`;
    out += printRule(rule, rows);
  }
  return out;
}

/** `no-readme (warning): when it's given`, where the doc says more, then the rule it serves. A
 *  markz code gives what it reads and what to write instead. Any other code is an error. */
export function codeRule(code: string): string {
  const rows = codeRules();
  const serving = (id?: string) => {
    const rule = agentRules().find((r) => r.id === id);
    return rule ? `\n${printRule(rule, rows)}` : "";
  };
  const row = rows.get(code);
  if (row) return `${code} (${row.kind}): ${row.when}\n  ${SITE}#${code}\n${serving(row.rule)}`;
  if (Object.hasOwn(WARNINGS, code)) {
    const { message, instead } = WARNINGS[code as WarningCode];
    return `${code} (markz): ${message}; write ${instead}\n  ${MARKZ}#${code}\n${serving(MARKZ_RULE)}`;
  }
  throw new Error(`${code} isn't a code prose or markz gives`);
}
