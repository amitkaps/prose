/** @prose
 * # YAML, TOML and `.gitignore`
 *
 * The files that configure a project, each a list of keys and values with `#` comments. A YAML
 * key is coloured as a keyword and a plain value as a string, as shiki colours them. TOML's keys
 * and tables stay plain, as they did with shiki, and its values take their own colours.
 *
 * YAML's block scalars (`run: |`) carry their text on the lines below, as long as they're
 * indented further. Those lines are coloured as one string, which no single-line rule could do.
 * So YAML is read a line at a time.
 */
import { type Span, rules, scan } from "./scan.js";

// A `#` starts a comment only at a line's start or after a space, so `a#b` stays a value.
const HASH_COMMENT = { re: /(?<=^|\s)#.*/m, colour: "comment" } as const;
const SCALAR =
  /(?:true|false|null|yes|no|on|off|~|[-+]?(?:\d[\d_]*\.?[\d_]*(?:e[-+]?\d+)?|\.inf|\.nan))/;

const YAML_LINE = rules([
  HASH_COMMENT,
  { re: /"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/, colour: "string" },
  // A key that reads as a YAML 1.1 boolean, like `on`, is coloured as one, as shiki does.
  {
    re: /(?<=^[ \t]*(?:- )*)(true|false|yes|no|on|off)(:)(?=\s|$)/,
    groups: ["constant", "keyword"],
  },
  {
    re: /(?<=^[ \t]*(?:- )*)([^\s#:"'-][^:#\n]*?|"[^"\n]*"|'[^'\n]*')(:)(?=\s|$)/,
    groups: ["keyword", "keyword"],
  },
  // A flow sequence, like `[main, next]`: its items are strings, and its brackets plain.
  { re: /[[\]{},]/, colour: null },
  { re: /(?<=[[,][ \t]*)[^\s,[\]{}#"']+/, colour: "string" },
  { re: /(?<=:[ \t]+)[|>][-+]?(?=[ \t]*(?:#|$))/, colour: "keyword" },
  {
    re: new RegExp(`(?<=(?::|^[ \\t]*-)[ \\t]+)${SCALAR.source}(?=[ \\t]*(?:#|$))`),
    colour: "constant",
  },
  { re: /(?<=(?::|^[ \t]*-)[ \t]+)[^\s#"'&*!|>][^\n#]*?(?=[ \t]+#|[ \t]*$)/, colour: "string" },
  { re: /^---$|^\.\.\.$/, colour: "keyword" },
]);

export function yaml(source: string): Span[] {
  const spans: Span[] = [];
  let at = 0;
  let block = -1;
  for (const line of source.split("\n")) {
    const indent = /^[ \t]*/.exec(line)![0].length;
    const end = at + line.length;
    if (block >= 0 && (line.trim() === "" || indent > block)) {
      if (line.trim()) spans.push({ colour: "string", start: at + indent, end });
    } else {
      block = /:[ \t]+[|>][-+]?[ \t]*(?:#.*)?$/.test(line) ? indent : -1;
      // Scanned on its own, so `^` and `$` are this line's ends.
      for (const s of scan(line, YAML_LINE))
        spans.push({ ...s, start: s.start + at, end: s.end + at });
    }
    at = end + 1;
  }
  return spans;
}

const TOML = rules([
  { re: /"""[\s\S]*?(?:"""|$(?![\s\S]))|'''[\s\S]*?(?:'''|$(?![\s\S]))/, colour: "string" },
  { re: /"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/, colour: "string" },
  HASH_COMMENT,
  { re: /^[ \t]*\[\[?[^\]\n]*\]\]?/m, colour: null },
  { re: /^([ \t]*[\w.\-"' ]+?)([ \t]*=)/m, groups: [null, "keyword"] },
  { re: /\b(?:true|false)\b|[-+]?\d[\d_:.TZ+-]*(?:e[-+]?\d+)?\b/, colour: "constant" },
  { re: /,/, colour: "punctuation" },
]);

export function toml(source: string): Span[] {
  return scan(source, TOML);
}

const GITIGNORE = rules([
  { re: /^[ \t]*#.*/m, colour: "comment" },
  { re: /^!/m, colour: "keyword" },
]);

export function gitignore(source: string): Span[] {
  return scan(source, GITIGNORE);
}
