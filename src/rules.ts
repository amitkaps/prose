/** @prose
 * # `prose rules`
 *
 * The rules an agent writes prose to, read from [usage](../docs/usage.md) as it shipped with this
 * version. The command prints them as raw text, so an agent needs no fetch, and a fetched page
 * goes through a smaller model that drops specifics ([lessons](../docs/lessons.md#working-style)).
 *
 * The doc drives both halves, read with markz's reader, as every tool built on markz reads its
 * rules. Each of [the agent rules](../docs/usage.md#for-agents) is a list item that opens with its
 * name as a span, under a heading for its group. Each code's row opens with the code as a span,
 * and links to the rule it serves. That link joins the rule's links, so markz finds a rule's codes
 * the way it finds its own. Nothing is written twice, since the doc is the source and the build
 * bundles it. A test holds the rows, the rules and the codes the source emits to each other
 * ([tests/codes.test.ts](../tests/codes.test.ts)).
 *
 * The commands are in the same doc, each the list item that opens its section, so the rules are
 * read only from under For agents, and the commands from the rest. `prose help` prints them.
 *
 * markz's rules print after prose's, from the markz prose bundles, which is the one `check` ran.
 * So `prose rules reference-link` prints markz's own text, and the markz rule it serves.
 */
import { headings, ids, parse, walk, type NodeId } from "@amitkaps/markz";
import {
  compose,
  markz,
  readCommands,
  readRules,
  type Code,
  type Commands,
  type Rules,
} from "@amitkaps/markz/rules";
import usage from "../docs/usage.md?built";

const SITE = "https://prose.amitkaps.com/docs/usage.md";

/** The level of each table's codes: `check`'s warnings, and `style`'s notes. */
const LEVELS: Record<string, Code["level"]> = { Warnings: "warning", "Advice on style": "note" };

/** prose's rules and codes, from a usage doc. Each code row's link to its rule is added to that
 *  rule's links, so `codesOf` finds it. */
export function proseRules(source: string = usage): Rules {
  const doc = parse(source);
  const outline = headings(doc);
  const rules = readRules(source, SITE, "for-agents");
  const codes: Code[] = [];
  const text = (node: NodeId) => source.slice(doc.start(node), doc.end(node)).trim();
  for (const { id, node, written } of ids(doc)) {
    const cell = doc.parent(node);
    if (!written || doc.type(node) !== "element" || doc.type(cell) !== "tableCell") continue;
    const table = outline.findLast((h) => h.depth === 2 && doc.start(h.node) < doc.start(node));
    const level = table && LEVELS[table.label];
    if (!level) continue;
    const [, when, instead, serves] = [...doc.children(doc.parent(cell))];
    const url = `${SITE}#${id}`;
    codes.push({ code: id, level, message: text(when!), instead: text(instead!), url });
    walk(
      doc,
      {
        enter(child) {
          if (doc.type(child) !== "link") return true;
          const to = new URL(doc.data(child, "link").destination, SITE).href;
          const rule = rules.find((r) => r.url === to);
          if (rule && !rule.links.includes(url)) rule.links.push(url);
          return false;
        },
      },
      serves,
    );
  }
  return { tool: "prose", rules, codes };
}

/** prose's rules, then markz's, as `prose rules` prints them. */
export const sets: Rules[] = compose(proseRules(), markz);

/** prose's commands, from a usage doc: the list items that open with an id, outside For agents. */
export function proseCommands(source: string = usage): Commands {
  const rules = new Set(readRules(source, SITE, "for-agents").map((r) => r.id));
  const all = readCommands("prose", source, SITE);
  return { ...all, commands: all.commands.filter((c) => !rules.has(c.id)) };
}
