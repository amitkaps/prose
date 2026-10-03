/** @prose
 * # JS, TS and JSON
 *
 * Colours the tokens [lexer.ts](../lexer.ts) finds. The parser trusts the same tokens for its
 * comments, so a string or a regex is never coloured as code, nor code as a string.
 *
 * A name's colour comes from the tokens beside it, as shiki's grammar would give it.
 *
 * - A name before `(` is a function, and one before `.` is an object, coloured as a constant.
 * - A name declared with `const`, or written in capitals, is a constant.
 * - A capitalised name is a type or a class, coloured as a function.
 * - A name after `.` is a property. So `map.get(x)` reads `get` as a call, not a keyword.
 *
 * What it can't see is what only the grammar knows. A `<` in a generic type is read as an
 * operator, for example.
 */
import { lexJs } from "../lexer.js";
import type { Span } from "./scan.js";

const KEYWORDS = new Set(
  (
    "abstract accessor as async await break case catch class const continue debugger declare " +
    "default delete do else enum export extends finally for from function get if implements " +
    "import in infer instanceof interface is keyof let namespace new of override private " +
    "protected public readonly return satisfies set static switch throw try type typeof var void " +
    "while with yield"
  ).split(" "),
);
const CONSTANTS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "this"]);
/** The built-in objects and classes, which shiki colours as constants, as it does `length`. */
const BUILTINS = new Set(
  (
    "Array Boolean Date Error JSON Map Math Number Object Promise Proxy Reflect RegExp Set String " +
    "Symbol WeakMap WeakSet console document globalThis process window length"
  ).split(" "),
);
const PRIMITIVES = new Set(
  "any bigint boolean never number object string symbol unknown".split(" "),
);
const OPERATORS = new Set([..."=+-*/%<>!&|^~?:".split(""), "++", "--"]);
/** Names that can be a keyword in one place and a property or a variable in another. */
const CONTEXTUAL = new Set(["as", "from", "get", "of", "set", "type", "is", "infer", "keyof"]);

export function js(source: string): Span[] {
  const tokens = lexJs(source);
  const text = (k: number): string => {
    const t = tokens[k];
    return t ? source.slice(t.start, t.end) : "";
  };
  const spans: Span[] = [];
  const add = (colour: Span["colour"], start: number, end: number): void => {
    spans.push({ colour, start, end });
  };
  /** Whether `=` at `k` and `>` after it make one `=>`. */
  const arrowAt = (k: number): boolean =>
    text(k) === "=" && text(k + 1) === ">" && tokens[k]!.end === tokens[k + 1]!.start;
  /** Whether the value starting at `k` is a function: `function`, or an arrow's parameters. */
  const functionAt = (k: number): boolean => {
    if (text(k) === "async") k++;
    if (text(k) === "function") return true;
    if (tokens[k]?.kind === "name") return arrowAt(k + 1);
    if (text(k) !== "(") return false;
    let depth = 0;
    for (let j = k; j < tokens.length && j < k + 200; j++) {
      const t = text(j);
      if (t === "(") depth++;
      else if (t === ")" && --depth === 0) {
        // A return type may sit between the parameters and the arrow.
        for (let a = j + 1; a < j + 30 && a < tokens.length; a++) {
          if (arrowAt(a)) return true;
          if (text(a) === ";" || text(a) === "{") return false;
        }
        return false;
      }
    }
    return false;
  };

  /** Whether the chain of names starting at `k`, like `log.push`, ends in a call. */
  const callsAt = (k: number): boolean => {
    while (tokens[k]?.kind === "name") {
      if (text(k + 1) === "(") return true;
      if (text(k + 1) === "?" && text(k + 2) === ".") k += 3;
      else if (text(k + 1) === ".") k += 2;
      else return false;
    }
    return false;
  };

  // Names inside `import { … }` stay plain, and so do those in a `const { … }` pattern's
  // defaults. `pattern` is the depth of the brackets a `const` pattern opened.
  let importing = false;
  let pattern = 0;
  let generics = 0;
  tokens.forEach((token, i) => {
    const word = text(i);
    const before = text(i - 1);
    const after = text(i + 1);
    const { start, end } = token;
    switch (token.kind) {
      case "comment": {
        // A doc comment's tags, like `@param` or `@prose`, are keywords, as shiki colours them.
        let at = start;
        if (word.startsWith("/**")) {
          for (const tag of word.matchAll(/(?<=^|[\s*{])@[\w-]+/g)) {
            add("comment", at, start + tag.index);
            add("keyword", start + tag.index, start + tag.index + tag[0].length);
            at = start + tag.index + tag[0].length;
          }
        }
        add("comment", at, end);
        break;
      }
      case "number":
        add("constant", start, end);
        break;
      case "regex": {
        // A regex is a string, but its operators, anchors and flags are keywords, as shiki
        // colours them. `\b` is an anchor too.
        const close = word.lastIndexOf("/");
        let inClass = false;
        let at = start;
        const keyword = (from: number, to: number): void => {
          if (from > at) add("string", at, from);
          add("keyword", from, to);
          at = to;
        };
        for (let k = 1; k < close; k++) {
          const c = word[k]!;
          if (c === "\\") {
            if (!inClass && /[bB]/.test(word[k + 1] ?? "")) keyword(start + k, start + k + 2);
            k++;
          } else if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (!inClass && "^$*+?|".includes(c)) keyword(start + k, start + k + 1);
          else if (!inClass && c === "{") {
            const quantifier = /^\{\d+(?:,\d*)?\}/.exec(word.slice(k))?.[0];
            if (quantifier) {
              keyword(start + k, start + k + quantifier.length);
              k += quantifier.length - 1;
            }
          }
        }
        add("string", at, start + close + 1);
        if (close + 1 < word.length) add("keyword", start + close + 1, end);
        break;
      }
      case "string": {
        // A template's `${` and the `}` that closes it are coloured as keywords, as shiki does.
        const open = word.startsWith("}") ? 1 : 0;
        const close = word.endsWith("${") ? 2 : 0;
        if (open) add("keyword", start, start + 1);
        add("string", start + open, end - close);
        if (close) add("keyword", end - 2, end);
        break;
      }
      case "punct": {
        const touching = tokens[i - 1]?.end === start;
        // A `<` right after a name opens type arguments, like `Set<string>`. Those brackets stay
        // plain, as shiki leaves them, where a comparison's `<` is an operator.
        if (word === "<" && touching && tokens[i - 1]!.kind === "name") {
          generics++;
          break;
        }
        if (word === ">" && generics > 0 && !arrowAt(i - 1)) {
          generics--;
          break;
        }
        const spread =
          word === "." &&
          [i - 2, i - 1, i].some(
            (k) => text(k) === "." && text(k + 1) === "." && text(k + 2) === ".",
          );
        if (spread) {
          add("keyword", start, end);
          break;
        }
        // The `?` of `?.` is part of the access, not an operator.
        if (word === "?" && text(i + 1) === "." && tokens[i + 1]!.start === end) {
          if (callsAt(i + 2)) add("function", start, end);
          break;
        }
        if (pattern && (word === "{" || word === "[")) pattern++;
        else if (pattern && (word === "}" || word === "]")) pattern--;
        else if ((word === "{" || word === "[") && before === "const") pattern = 1;
        if (word === ";" || word === "}") importing &&= word !== ";";
        if (OPERATORS.has(word)) add("keyword", start, end);
        else if (word === ",") add("punctuation", start, end);
        // Each `.` of a chain that ends in a call is part of the call, as shiki colours it.
        else if (word === "." && callsAt(i + 1)) add("function", start, end);
        break;
      }
      case "name": {
        if (word === "import" && before !== ".") importing = true;
        if (word === "from") importing = false;
        const property = before === "." && text(i - 2) !== ".";
        const declared = before === "const" || before === "let" || before === "var";
        if (property) {
          if (after === "(") add("function", start, end);
          else if (after === "." || BUILTINS.has(word)) add("constant", start, end);
        } else if (word === "void" && /^[:<|]$/.test(before)) {
          add("constant", start, end);
        } else if (
          KEYWORDS.has(word) &&
          !(CONTEXTUAL.has(word) && /^[.:,)=(]$/.test(after)) &&
          !(word === "from" && tokens[i + 1]?.kind !== "string")
        ) {
          add("keyword", start, end);
        } else if (importing) {
          break;
        } else if (
          after === "(" ||
          before === "function" ||
          ((declared || after === ":" || after === "=") && !arrowAt(i + 1) && functionAt(i + 2))
        ) {
          add("function", start, end);
        } else if (BUILTINS.has(word) && after === "<") {
          // A built-in given type arguments, like `Set<string>`, is a type.
          add("function", start, end);
        } else if (
          CONSTANTS.has(word) ||
          BUILTINS.has(word) ||
          before === "const" ||
          (pattern === 1 && before !== "=" && before !== ":") ||
          /^[A-Z][A-Z0-9_]+$/.test(word) ||
          after === "." ||
          (after === "?" && text(i + 2) === ".") ||
          (PRIMITIVES.has(word) && /^[:<|&,]$/.test(before))
        ) {
          add("constant", start, end);
        } else if (/^[A-Z]/.test(word)) {
          add("function", start, end);
        }
        break;
      }
    }
  });
  return spans;
}

/** JSON and JSONC: a key is coloured as a keyword, as shiki does, and other strings as strings. */
export function json(source: string): Span[] {
  const tokens = lexJs(source);
  return tokens.flatMap((token, i): Span[] => {
    const word = source.slice(token.start, token.end);
    const next = tokens[i + 1];
    const isKey = next && source.slice(next.start, next.end) === ":";
    const colour =
      token.kind === "comment"
        ? "comment"
        : token.kind === "string"
          ? isKey
            ? "keyword"
            : "string"
          : token.kind === "number" || token.kind === "name"
            ? "constant"
            : word === ":" || word === ","
              ? "punctuation"
              : null;
    return colour ? [{ colour, start: token.start, end: token.end }] : [];
  });
}
