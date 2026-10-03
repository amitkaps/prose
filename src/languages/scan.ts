/** @prose
 * # Colouring by rules
 *
 * What every language here shares. It has the colours a piece of code can take, and a scanner
 * that colours source by a list of rules.
 *
 * The colours are the palette's, set in [style.css](../page/style.css). Each one stands for the
 * kinds of token shiki's CSS-variables theme gave that colour, so code looks as it did with shiki.
 * A keyword's colour also covers operators and the keys of YAML and JSON, for example.
 *
 * A rule is a sticky regex, tried in order at each position, and the first that matches wins.
 * Its whole match takes one colour, or each capture group takes its own, as TextMate's captures
 * do. A rule with no colour skips what it matches as plain text. Text no rule matches is plain.
 */

export type Colour =
  | "comment"
  | "keyword"
  | "string"
  | "constant"
  | "function"
  | "punctuation"
  | "link"
  | "strong"
  | "emphasis";

export interface Span {
  colour: Colour;
  /** Span `[start, end)` in the source. */
  start: number;
  end: number;
}

export interface Rule {
  re: RegExp;
  /** The whole match's colour, or `null` for plain text. */
  colour?: Colour | null;
  /** One colour, or `null`, for each capture group, in place of `colour`. */
  groups?: (Colour | null)[];
}

/** Makes each rule's regex sticky, with group indices where it needs them. */
export function rules(list: Rule[]): Rule[] {
  return list.map((rule) => ({
    ...rule,
    re: new RegExp(rule.re.source, `${rule.re.flags}y${rule.groups ? "d" : ""}`),
  }));
}

export function scan(source: string, list: Rule[], from = 0, to = source.length): Span[] {
  const spans: Span[] = [];
  let i = from;
  next: while (i < to) {
    for (const rule of list) {
      rule.re.lastIndex = i;
      const match = rule.re.exec(source);
      if (!match || match[0].length === 0) continue;
      const end = Math.min(i + match[0].length, to);
      if (rule.groups) {
        rule.groups.forEach((colour, g) => {
          const at = match.indices![g + 1];
          if (colour && at) spans.push({ colour, start: at[0], end: Math.min(at[1], end) });
        });
      } else if (rule.colour) {
        spans.push({ colour: rule.colour, start: i, end });
      }
      i = end;
      continue next;
    }
    i++;
  }
  return spans;
}

/** Moves spans found in a slice of a file to their place in the whole file. */
export function shift(spans: Span[], by: number): Span[] {
  return spans.map((s) => ({ ...s, start: s.start + by, end: s.end + by }));
}
