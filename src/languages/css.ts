/** @prose
 * # CSS
 *
 * The same word takes a different colour in a selector, a property and a value, so CSS is read
 * one statement at a time. Inside a block, a statement that reaches `;` or `}` before any `{` is
 * a declaration, and anything else is a nested rule's selector. An `@` starts an at-rule.
 *
 * The colours follow shiki's CSS grammar. In a selector, a tag is coloured as a string, and a
 * class, an id or a pseudo-class as a function. A property is a constant, and so is most of a
 * value, except its functions, strings and commas.
 */
import { type Span, rules, scan } from "./scan.js";

const COMMENT = { re: /\/\*[\s\S]*?(?:\*\/|$)/, colour: "comment" } as const;
const STRING = { re: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, colour: "string" } as const;

const SELECTOR = rules([
  COMMENT,
  STRING,
  {
    re: /\[([\w-]+)(?:([~|^$*]?=)("[^"\n]*"|'[^'\n]*'|[^\]\s]*))?\]?/,
    groups: ["function", "keyword", "string"],
  },
  { re: /[.#][\w-]+|::?[\w-]+/, colour: "function" },
  { re: /[>+~]/, colour: "keyword" },
  { re: /,/, colour: "punctuation" },
  { re: /[a-zA-Z][\w-]*|\*|&/, colour: "string" },
]);

const VALUE = rules([
  COMMENT,
  STRING,
  { re: /!important\b/, colour: "keyword" },
  { re: /\b(?:and|not|only|or)\b/, colour: "keyword" },
  { re: /[\w-]+(?=\()/, colour: "function" },
  { re: /,/, colour: "punctuation" },
  // A number's unit is a keyword, as shiki colours it.
  { re: /([-+]?(?:\d*\.)?\d+)(%|[a-zA-Z]+)?/, groups: ["constant", "keyword"] },
  { re: /(?<=\s)[-+*](?=\s)/, colour: "keyword" },
  { re: /[()/]/, colour: "constant" },
  { re: /[^\s,;:{}()/"']+/, colour: "constant" },
]);

/** An at-rule's prelude, like `(max-width: 62rem)`, colours its features and numbers. */
const PRELUDE = rules([
  COMMENT,
  STRING,
  { re: /\b(?:and|not|only|or)\b/, colour: "keyword" },
  { re: /([-+]?(?:\d*\.)?\d+)(%|[a-zA-Z]+)?/, groups: ["constant", "keyword"] },
  { re: /([\w-]+)(\s*:)/, groups: ["constant", "keyword"] },
  { re: /[\w-]+/, colour: null },
]);

/** Where the statement at `from` ends: the index of its `{`, `;` or `}`, skipping strings,
 *  comments and parentheses. */
function statementEnd(source: string, from: number, to: number): number {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = source[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < to && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
    } else if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close === -1 ? to : close + 1;
    } else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth <= 0 && (c === "{" || c === ";" || c === "}")) return i;
  }
  return to;
}

export function css(source: string, from = 0, to = source.length): Span[] {
  const spans: Span[] = [];
  let depth = 0;
  let i = from;
  while (i < to) {
    const c = source[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      const end = close === -1 || close + 2 > to ? to : close + 2;
      spans.push({ colour: "comment", start: i, end });
      i = end;
    } else if (c === "{") {
      depth++;
      i++;
    } else if (c === "}") {
      depth = Math.max(0, depth - 1);
      i++;
    } else if (c === ";") {
      i++;
    } else {
      const end = statementEnd(source, i, to);
      const declaration = depth > 0 && source[end] !== "{" && c !== "@";
      if (c === "@") {
        const name = /^@[\w-]+/.exec(source.slice(i, end))?.[0] ?? "@";
        spans.push({ colour: "keyword", start: i, end: i + name.length });
        spans.push(...scan(source, PRELUDE, i + name.length, end));
      } else if (declaration) {
        const colon = source.indexOf(":", i);
        if (colon === -1 || colon > end) {
          spans.push(...scan(source, VALUE, i, end));
        } else {
          // A custom property's name stays plain, as shiki leaves it.
          if (!source.startsWith("--", i)) spans.push({ colour: "constant", start: i, end: colon });
          spans.push({ colour: "keyword", start: colon, end: colon + 1 });
          spans.push(...scan(source, VALUE, colon + 1, end));
        }
      } else {
        spans.push(...scan(source, SELECTOR, i, end));
      }
      i = end;
    }
  }
  return spans;
}
