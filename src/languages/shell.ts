/** @prose
 * # Shell
 *
 * Scripts that sit beside a project's code. prose shows them as highlighted text, without reading
 * their comments as prose ([writing](../../docs/writing.md#in-each-language)).
 *
 * Python was here too, and went. No repository prose reads has any, and its f-strings and
 * docstrings needed rules nobody would check. A `.py` file shows as plain text.
 */
import { type Span, rules, scan } from "./scan.js";

const SHELL_KEYWORDS = new Set(
  "if then else elif fi for while until do done case esac in function return export local readonly select time".split(
    " ",
  ),
);

/** @prose
 * # Shell commands
 *
 * Shell is read a word at a time, since a word's colour depends on where it stands. The first word
 * of a command is coloured as a function, and the words after it as strings, as shiki colours a
 * command and its arguments. A command starts a line, or follows `;`, `|`, `&&`, `||`, `(` or a
 * keyword like `then`.
 */
const SHELL = rules([
  { re: /(?<=^|[\s;|&(])#.*/m, colour: "comment" },
  { re: /'[^']*'?|"(?:[^"\\]|\\.)*"?/, colour: "string" },
  { re: /\$\{[^}\n]*\}?|\$\(|\$[\w@#?$!*-]/, colour: null },
  { re: /\d*(?:>>?|<)&?\d*|&&|\|\||[|&()]/, colour: "keyword" },
  { re: /;/, colour: null },
  { re: /\d+(?=[\s;|&)]|$)/, colour: "constant" },
  { re: /[\w]+(?==)/, colour: null },
  { re: /=/, colour: "keyword" },
  { re: /[^\s;|&()<>'"=$]+/, colour: "string" },
]);

export function shell(source: string): Span[] {
  const spans: Span[] = [];
  let command = true;
  let variable = false;
  let at = 0;
  for (const span of scan(source, SHELL)) {
    const word = source.slice(span.start, span.end);
    // A new line or a `;` starts a new command, unless the line ended in `\`.
    if (/(?<!\\)\n|;/.test(source.slice(at, span.start))) command = true;
    at = span.end;
    if (span.colour === "string" && !/^['"]/.test(word)) {
      if (SHELL_KEYWORDS.has(word)) {
        spans.push({ ...span, colour: "keyword" });
        command = word !== "in" && word !== "for" && word !== "case";
        variable = word === "for" || word === "select";
        continue;
      }
      // The loop's variable, as in `for f in`, is a name, not a command or an argument.
      if (variable) {
        variable = false;
        continue;
      }
      // `[` and `]` around a test stay plain, and the test isn't a command.
      if (word === "[" || word === "]" || word === "[[" || word === "]]") {
        command = false;
        continue;
      }
      // `[ -f x ]` is a test, and its flag an operator.
      const test = /^-[a-z]$/.test(word) && /\[\s*$/.test(source.slice(0, span.start));
      spans.push({ ...span, colour: command ? "function" : test ? "keyword" : "string" });
      command = false;
      continue;
    }
    spans.push(span);
    if (/^(?:\||&&|\|\||\(|\$\()$/.test(word)) command = true;
  }
  return spans;
}
