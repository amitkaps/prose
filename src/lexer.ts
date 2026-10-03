/** @prose
 * # Reading JS and TS as tokens
 *
 * Splits JS or TS source into comments, strings, regexes, numbers, names and punctuation, each
 * with its span. The parser takes the comments from it. Whitespace sits in the gaps between
 * tokens.
 *
 * A comment is only found reliably if everything that could hide one is skipped whole. That
 * means strings, template literals with their `${…}` parts, and regex literals. A tokenizer that
 * got regexes wrong once lost every comment after a `/\`/g` ([lessons](../docs/lessons.md#the-parser-and-scanner)).
 * So `tests/lexer.test.ts` checks this one against oxc's parser, on every JS and TS file in the
 * repository.
 *
 * JSX is out. Its text is neither code nor a string, so an apostrophe in `<p>it's</p>` would
 * open a string. No repository prose reads uses it.
 */

export type TokenKind = "comment" | "string" | "regex" | "number" | "name" | "punct";

export interface Token {
  kind: TokenKind;
  /** Span `[start, end)` in the source. */
  start: number;
  end: number;
}

/** @prose
 * # A regex or a division
 *
 * A `/` can start a regex or divide, and only the token before it tells which. After a value,
 * like a name, a number, a string, `)` or `]`, it divides. After an operator, an opening bracket
 * or a keyword like `return`, it starts a regex. A `}` counts as the end of a block, so a regex
 * may follow it. An object literal divided by something is rarer than a statement that starts
 * with a regex.
 */
const REGEX_AFTER_WORD = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
  "extends",
]);

// Plain comparisons, not regexes. They run once for every character in the file.
const isSpace = (c: string): boolean =>
  c === " " || c === "\n" || c === "\t" || c === "\r" || (c > "~" && /\s/.test(c));
const isDigit = (c: string): boolean => c >= "0" && c <= "9";
const isNameStart = (c: string): boolean =>
  (c >= "a" && c <= "z") ||
  (c >= "A" && c <= "Z") ||
  c === "_" ||
  c === "$" ||
  (c > "~" && !isSpace(c));
const isNamePart = (c: string): boolean => isNameStart(c) || isDigit(c);

/** Where the line that `from` is on ends, before its `\r\n` or `\n`. */
function lineEnd(source: string, from: number): number {
  const end = source.indexOf("\n", from);
  if (end === -1) return source.length;
  return source[end - 1] === "\r" ? end - 1 : end;
}

/** The end of a quoted string that opens at `from`. A line break ends an unclosed one. */
function skipQuoted(source: string, from: number): number {
  const quote = source[from];
  let i = from + 1;
  while (i < source.length && source[i] !== quote && source[i] !== "\n") {
    i += source[i] === "\\" ? 2 : 1;
  }
  return Math.min(i + 1, source.length);
}

/** The end of a regex that opens at `from`, with its flags, or `-1` if the line ends first. */
function skipRegex(source: string, from: number): number {
  let i = from + 1;
  let inClass = false;
  while (i < source.length) {
    const c = source[i];
    if (c === "\n") return -1;
    if (c === "\\") i++;
    else if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) break;
    i++;
  }
  if (i >= source.length) return -1;
  i++;
  while (i < source.length && isNamePart(source[i]!)) i++;
  return i;
}

/** @prose
 * # Template literals
 *
 * A template's text is a string, and each `${…}` in it is code again, which may hold its own
 * strings, braces and templates. So the lexer keeps a stack of open braces. One that opened a
 * `${` sends its closing `}` back into the template's text.
 */
function skipTemplateText(source: string, from: number): { end: number; opensCode: boolean } {
  let i = from;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") i += 2;
    else if (c === "`") return { end: i + 1, opensCode: false };
    else if (c === "$" && source[i + 1] === "{") return { end: i + 2, opensCode: true };
    else i++;
  }
  return { end: source.length, opensCode: false };
}

export function lexJs(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  // One entry per open `{`, true for a template's `${`.
  const braces: boolean[] = [];
  let regexAllowed = true;
  // A hashbang line (`#!/usr/bin/env node`) is neither code nor a comment.
  let i = source.startsWith("#!") ? lineEnd(source, 0) : 0;

  const template = (start: number, from: number): void => {
    const { end, opensCode } = skipTemplateText(source, from);
    tokens.push({ kind: "string", start, end });
    if (opensCode) braces.push(true);
    regexAllowed = opensCode;
    i = end;
  };

  while (i < n) {
    const c = source[i]!;
    const next = source[i + 1];
    const start = i;
    if (isSpace(c)) {
      i++;
    } else if (c === "/" && next === "/") {
      i = lineEnd(source, i);
      tokens.push({ kind: "comment", start, end: i });
    } else if (c === "/" && next === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close === -1 ? n : close + 2;
      tokens.push({ kind: "comment", start, end: i });
    } else if (c === '"' || c === "'") {
      i = skipQuoted(source, i);
      tokens.push({ kind: "string", start, end: i });
      regexAllowed = false;
    } else if (c === "`") {
      template(start, i + 1);
    } else if (c === "}" && braces.at(-1) === true) {
      braces.pop();
      template(start, i + 1);
    } else if (c === "/" && regexAllowed && skipRegex(source, i) !== -1) {
      i = skipRegex(source, i);
      tokens.push({ kind: "regex", start, end: i });
      regexAllowed = false;
    } else if (isDigit(c) || (c === "." && next !== undefined && isDigit(next))) {
      i++;
      while (i < n) {
        const d = source[i]!;
        const signed =
          (d === "+" || d === "-") &&
          /[eE]/.test(source[i - 1]!) &&
          !/^0[xX]/.test(source.slice(start, i));
        if (!isNamePart(d) && d !== "." && !signed) break;
        i++;
      }
      tokens.push({ kind: "number", start, end: i });
      regexAllowed = false;
    } else if (isNameStart(c) || (c === "#" && next !== undefined && isNameStart(next))) {
      i++;
      while (i < n && isNamePart(source[i]!)) i++;
      tokens.push({ kind: "name", start, end: i });
      regexAllowed = REGEX_AFTER_WORD.has(source.slice(start, i));
    } else {
      // `++` and `--` are read whole, since after either one a `/` divides.
      const pair = (c === "+" || c === "-") && next === c;
      i += pair ? 2 : 1;
      tokens.push({ kind: "punct", start, end: i });
      if (c === "{") braces.push(false);
      else if (c === "}") braces.pop();
      regexAllowed = !pair && c !== ")" && c !== "]";
    }
  }
  return tokens;
}
