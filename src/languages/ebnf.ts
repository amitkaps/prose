/** @prose
 * # EBNF
 *
 * The W3C's EBNF, the notation the XML spec uses for its grammar. With it, an `ebnf` fence in a
 * doc is highlighted like the code around it.
 *
 * It covers the notation's few parts and no more. Those are a rule's name before `::=`, quoted
 * terminals, character classes, `#x` code points, the operators, and both kinds of comment. A
 * name used inside a rule stays plain text, so the rule being defined is what stands out.
 */
import { type Span, rules, scan } from "./scan.js";

const EBNF = rules([
  { re: /\/\*[\s\S]*?(?:\*\/|$(?![\s\S]))|\(\*[\s\S]*?(?:\*\)|$(?![\s\S]))/, colour: "comment" },
  { re: /^([ \t]*)([A-Za-z_][\w.-]*)([ \t]*)(::=)/m, groups: [null, "function", null, "keyword"] },
  { re: /'[^']*'|"[^"]*"/, colour: "string" },
  { re: /\[\^?(?:[^\]\\]|\\.)*\]|#x[0-9A-Fa-f]+/, colour: "constant" },
  // `-` is also inside names (`line-end`), so names are skipped whole, and `-` is an operator
  // only on its own.
  { re: /[A-Za-z_][\w.-]*/, colour: null },
  { re: /[|?*+]|(?<=\s)-(?=\s)/, colour: "keyword" },
]);

export function ebnf(source: string): Span[] {
  return scan(source, EBNF);
}
