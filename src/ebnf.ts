/** @prose
 * # EBNF
 *
 * A grammar for the W3C's EBNF, the notation the XML spec uses for its grammar. With it, an
 * `ebnf` fence in a doc is highlighted like the code around it. Shiki ships none.
 *
 * It covers the notation's few parts and no more. Those are a rule's name before `::=`, quoted
 * terminals, character classes, `#x` code points, the operators, and both kinds of comment. A
 * name used inside a rule stays plain text, so the rule being defined is what stands out.
 */
import type { LanguageRegistration } from "shiki/core";

export const ebnf: LanguageRegistration = {
  name: "ebnf",
  scopeName: "source.ebnf",
  patterns: [
    { include: "#comment" },
    {
      match: "^\\s*([A-Za-z_][\\w.-]*)\\s*(::=)",
      captures: {
        1: { name: "entity.name.function.ebnf" },
        2: { name: "keyword.operator.definition.ebnf" },
      },
    },
    { name: "string.quoted.single.ebnf", match: "'[^']*'" },
    { name: "string.quoted.double.ebnf", match: '"[^"]*"' },
    { name: "constant.numeric.class.ebnf", match: "\\[\\^?(?:[^\\]\\\\]|\\\\.)*\\]" },
    { name: "constant.numeric.code-point.ebnf", match: "#x[0-9A-Fa-f]+" },
    // `-` is also inside names (`line-end`), so it's an operator only on its own.
    { name: "keyword.operator.ebnf", match: "[|?*+]|(?<=\\s)-(?=\\s)" },
  ],
  repository: {
    comment: {
      patterns: [
        { name: "comment.block.ebnf", begin: "/\\*", end: "\\*/" },
        { name: "comment.block.ebnf", begin: "\\(\\*", end: "\\*\\)" },
      ],
    },
  },
};
