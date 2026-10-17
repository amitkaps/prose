/** @prose
 * # Style
 *
 * Advice on where a text's sentences break the agent rules' plain style, for `prose style`
 * ([usage](../docs/usage.md#style)). It's advice for the writer of a file, not a fault, so it never
 * fails and never shows on a page.
 *
 * A count of words is only a guess at what's hard to read. In CI or on every page, it would teach
 * an agent to dodge the count, which is the cramming the rules are there to stop. So `prose check`
 * leaves it out, and the writer asks for it on the files they just wrote.
 *
 * Only paragraphs are read, wherever they sit, like in a list or a quote. Headings, code, tables
 * and metadata aren't sentences. Inline code counts as one word, and a link's text counts as its
 * words.
 */
import { NONE, type Document, type NodeId } from "@amitkaps/markz";
import { findInFile, unchecked, type Found, type Warning } from "./warnings.js";

export type StyleCode = "long-summary" | "long-sentence" | "semicolon" | "colon" | "parenthetical";

/** Advice at an offset in the text it was found in. */
type Advice = Found<StyleCode> & { instead: string };

/** @prose
 * # The limits
 *
 * The rules ask for about three lines of summary and about 25 words a sentence. Advice comes a
 * little past each, so "about" keeps its room. Three lines of the page's measure hold about 40
 * words.
 */
const SUMMARY_WORDS = 60;
const SENTENCE_WORDS = 35;
/** A parenthesis this short names or glosses something, like `(default 1234)`, and isn't an aside. */
const GLOSS_WORDS = 3;
/** Items this short, in a run, are a list's, like "an id, classes and key-value pairs". */
const SERIES_WORDS = 5;

// Stand-ins in a paragraph's flat text: inline code, where a link opens and closes, and where
// emphasis closes, so a bold label's colon (`**Stories:** one page`) sits apart from what follows.
const CODE = "\uE000";
const LINK_OPEN = "\uE001";
const LINK_CLOSE = "\uE002";
const EMPHASIS_CLOSE = "\uE003";

/** A paragraph as one string, with each character's offset in the source. */
interface Flat {
  text: string;
  at: number[];
}

function flatten(doc: Document, node: NodeId, flat: Flat): void {
  for (const child of doc.children(node)) {
    const type = doc.type(child);
    const start = doc.start(child);
    if (type === "text") {
      const { value } = doc.data(child, "text");
      const end = doc.end(child);
      for (let i = 0; i < value.length; i++) {
        flat.text += value[i];
        flat.at.push(Math.min(start + i, end - 1));
      }
    } else if (type === "link") {
      flat.text += LINK_OPEN;
      flat.at.push(start);
      flatten(doc, child, flat);
      flat.text += LINK_CLOSE;
      flat.at.push(doc.end(child) - 1);
    } else if (type === "emphasis" || type === "strong" || type === "delete") {
      flatten(doc, child, flat);
      flat.text += EMPHASIS_CLOSE;
      flat.at.push(doc.end(child) - 1);
    } else if (type === "break") {
      flat.text += " ";
      flat.at.push(start);
    } else if (doc.firstChild(child) !== NONE && type !== "image") {
      flatten(doc, child, flat);
    } else {
      // Inline code, an image, math or an expression: one word, with no punctuation of its own.
      flat.text += CODE;
      flat.at.push(start);
    }
  }
}

/** Words, counting inline code as one, and not a dash or a bare stand-in. */
function words(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}\uE000]/u.test(w)).length;
}

/** @prose
 * # Sentences
 *
 * A sentence ends at `.`, `!` or `?` before a space. It needn't be a capital that follows, since
 * names like prose's own are written lowercase. So `prose.amitkaps.com` doesn't end one, and
 * neither does an abbreviation like `e.g.`.
 */
const SENTENCE_END = /[.!?]["'”’)\uE002\uE003]*\s+/gu;
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf)\.$/i;

function sentences(text: string): { start: number; text: string }[] {
  const found: { start: number; text: string }[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    if (ABBREVIATION.test(text.slice(start, match.index + 1))) continue;
    found.push({ start, text: text.slice(start, end) });
    start = end;
  }
  if (start < text.length) found.push({ start, text: text.slice(start) });
  return found;
}

/** @prose
 * # Joined ideas
 *
 * A semicolon or a colon in a paragraph can join two ideas, and gets advice unless it does
 * something else. A colon gets it only when a lowercase clause follows it in the same paragraph. A
 * colon that leads into a list or a code block ends its paragraph.
 *
 * - A list item's label. A colon right after a link, code or bold, as in
 *   `- [a.ts](a.ts): what it does` or `- **spec**: its text`, labels what follows. So does one
 *   after a sentence's first word, like `Origin: markz.`
 * - A series. A colon before a run of short items, joined by commas, "and" or "or", leads into a
 *   list, as in "three settings: the cooldown, `allowBuilds` and the override". A run that opens
 *   with a subject like "it" or "they" is a clause, however short.
 * - A list of clauses. A sentence with two or more semicolons, or one with "and" or "or" after it,
 *   separates items that hold commas of their own.
 * - A citation. A colon or semicolon inside a parenthesis is part of it, as in
 *   ``(grammar: table; `table-columns`)``.
 *
 * A parenthesis gets advice unless it holds a link, opens with an example word like "like", or is a
 * short gloss. A citation like `(grammar: link)`, a series, or one that is mostly inline code is an
 * example or a gloss too.
 *
 * A colon that explains still gets advice, as in "How it's built: the tree, and how it's read". Most
 * of what's left after these is that kind, and only some join two clauses. Telling them apart needs
 * to know if a verb follows, which counting words can't.
 */
const EXAMPLE = /^(?:like|e\.g\.|for example|such as|as in|say)\b/i;
/** A label and its colon, like `grammar:` in `(grammar: link)`. */
const LABEL = /^[\p{L}\p{N}-]+:\s/u;
/** A subject that opens a clause, so the words after a colon aren't a list. */
const SUBJECT = /^(?:it|it['’]s|they|they['’]re|there['’]s|we|you|I)\b/u;

/** A run of short items, joined by commas, "and" or "or", and not a clause. */
function isSeries(text: string): boolean {
  const items = text
    .trim()
    .replace(/[.!?]$/, "")
    .split(/,\s*|\s+(?:and|or)\s+/)
    .filter((item) => item.trim());
  return (
    items.length >= 2 &&
    !SUBJECT.test(text.trim()) &&
    items.every((item) => words(item) <= SERIES_WORDS)
  );
}

/** At least half inline code, like ``(`&#169;` → `©`, `\*` → `*`)``. */
function isCode(text: string): boolean {
  const count = words(text);
  return count > 0 && (text.match(//g)?.length ?? 0) * 2 >= count;
}

/** Whether each offset is inside a parenthesis, at any depth. */
function inParentheses(text: string): boolean[] {
  const inside: boolean[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ")" && depth > 0) depth--;
    inside.push(depth > 0);
    if (text[i] === "(") depth++;
  }
  return inside;
}

function isAside(inside: string): boolean {
  return (
    !inside.includes(LINK_OPEN) &&
    !EXAMPLE.test(inside) &&
    words(inside) > GLOSS_WORDS &&
    !LABEL.test(inside) &&
    !isCode(inside) &&
    !isSeries(inside)
  );
}

function parentheticals(text: string): number[] {
  const found: number[] = [];
  let open = -1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") {
      if (depth++ === 0) open = i;
    } else if (text[i] === ")" && depth > 0 && --depth === 0) {
      if (isAside(text.slice(open + 1, i).trim())) found.push(open);
    }
  }
  return found;
}

function paragraphAdvice(flat: Flat): Advice[] {
  const advice: Advice[] = [];
  const { text, at } = flat;
  const spans = sentences(text);
  const sentenceAt = (i: number) => spans.findLast((sentence) => sentence.start <= i)!;
  const parenthesized = inParentheses(text);
  for (const sentence of spans) {
    const count = words(sentence.text);
    if (count > SENTENCE_WORDS) {
      advice.push({
        code: "long-sentence",
        message: `sentence of ${count} words`,
        instead: "one idea a sentence, in about 25 words",
        start: at[sentence.start + sentence.text.search(/\S/)]!,
      });
    }
  }
  for (const match of text.matchAll(/;/g)) {
    if (parenthesized[match.index]) continue;
    const sentence = sentenceAt(match.index);
    const listed = (sentence.text.match(/;/g)?.length ?? 0) >= 2;
    if (listed || /^\s+(?:and|or)\s/.test(text.slice(match.index + 1))) continue;
    advice.push({
      code: "semicolon",
      message: "semicolon joining two ideas",
      instead: "two sentences",
      start: at[match.index]!,
    });
  }
  for (const match of text.matchAll(/(?<![\uE000\uE002\uE003]):\s+(?=\p{Ll})/gu)) {
    if (parenthesized[match.index]) continue;
    const sentence = sentenceAt(match.index);
    if (words(text.slice(sentence.start, match.index)) <= 1) continue;
    if (isSeries(sentence.text.slice(match.index - sentence.start + 1))) continue;
    advice.push({
      code: "colon",
      message: "colon joining two ideas",
      instead: "two sentences",
      start: at[match.index]!,
    });
  }
  for (const open of parentheticals(text)) {
    advice.push({
      code: "parenthetical",
      message: "aside in parentheses",
      instead: "its own sentence, or cut it",
      start: at[open]!,
    });
  }
  return advice;
}

/** @prose
 * # The summary
 *
 * A text's first paragraph is its summary, when nothing but headings comes before it. That's a
 * doc's, a README's or a prose comment's. A text that opens with a list or code has no summary to
 * measure.
 */
function summary(doc: Document): NodeId | undefined {
  for (const block of doc.children(doc.root)) {
    const type = doc.type(block);
    if (type === "paragraph") return block;
    if (type !== "heading" && type !== "metadata" && type !== "comment") return undefined;
  }
  return undefined;
}

/** Every piece of advice on a parsed text, in the order it occurs. */
export function textStyle(doc: Document): Advice[] {
  const advice: Advice[] = [];
  const first = summary(doc);
  const visit = (node: NodeId): void => {
    for (const child of doc.children(node)) {
      const type = doc.type(child);
      if (type === "paragraph") {
        const flat: Flat = { text: "", at: [] };
        flatten(doc, child, flat);
        if (child === first) {
          const count = words(flat.text);
          if (count > SUMMARY_WORDS) {
            advice.push({
              code: "long-summary",
              message: `first paragraph of ${count} words`,
              instead: "a summary of about three lines, with detail below it",
              start: doc.start(child),
            });
          }
        }
        advice.push(...paragraphAdvice(flat));
      } else if (type !== "heading" && type !== "code" && type !== "table") visit(child);
    }
  };
  visit(doc.root);
  return advice.sort((a, b) => a.start - b.start);
}

/** Advice on each of `files`, in file order, leaving out what isn't checked
 *  ([warnings.ts](warnings.ts)). */
export function styleAdvice(root: string, files: string[]): Warning<StyleCode>[] {
  const skipped = unchecked(root, files);
  return files
    .filter((path) => !skipped.has(path))
    .flatMap((path) => findInFile(root, path, textStyle));
}
