/** @prose
 * # Notes
 *
 * Where a text's sentences break the agent rules' plain style
 * ([usage](../docs/usage.md#for-agents)). A note is advice, not a fault. `prose check` prints it
 * but still passes, because a count of words is only a guess at what's hard to read. Failing on it
 * would teach an agent to dodge the count, which is the cramming the rules are there to stop.
 *
 * Only paragraphs are read, wherever they sit, like in a list or a quote. Headings, code, tables
 * and metadata aren't sentences. Inline code counts as one word, and a link's text counts as its
 * words.
 */
import { NONE, type Document, type NodeId } from "@amitkaps/markz";

export type NoteCode = "long-summary" | "long-sentence" | "semicolon" | "colon" | "parenthetical";

/** A note at an offset in the text it was found in. */
export interface Note {
  code: NoteCode;
  message: string;
  instead: string;
  start: number;
}

/** @prose
 * ## The limits
 *
 * The rules ask for about three lines of summary and about 25 words a sentence. A note fires a
 * little past each, so "about" keeps its room. Three lines of the page's measure hold about 40
 * words.
 */
const SUMMARY_WORDS = 60;
const SENTENCE_WORDS = 35;
/** A parenthesis this short names or glosses something, like `(default 1234)`, and isn't an aside. */
const GLOSS_WORDS = 3;

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
 * ## Sentences
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
 * ## Joined ideas
 *
 * A semicolon in a paragraph joins two ideas, so it's always a note. A colon is a note only when
 * a lowercase clause follows it in the same paragraph. A colon that leads into a list or a code
 * block ends its paragraph. One right after a link or code, as in `- [a.ts](a.ts): what it does`,
 * is a list item's label.
 *
 * A parenthesis is a note unless it holds a link, opens with an example word like "like", or is a
 * short gloss.
 */
const EXAMPLE = /^(?:like|e\.g\.|for example|such as|as in|say)\b/i;

function parentheticals(text: string): number[] {
  const found: number[] = [];
  let open = -1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") {
      if (depth++ === 0) open = i;
    } else if (text[i] === ")" && depth > 0 && --depth === 0) {
      const inside = text.slice(open + 1, i).trim();
      if (!inside.includes(LINK_OPEN) && !EXAMPLE.test(inside) && words(inside) > GLOSS_WORDS) {
        found.push(open);
      }
    }
  }
  return found;
}

function paragraphNotes(flat: Flat): Note[] {
  const notes: Note[] = [];
  const { text, at } = flat;
  for (const sentence of sentences(text)) {
    const count = words(sentence.text);
    if (count > SENTENCE_WORDS) {
      notes.push({
        code: "long-sentence",
        message: `sentence of ${count} words`,
        instead: "one idea a sentence, in about 25 words",
        start: at[sentence.start + sentence.text.search(/\S/)]!,
      });
    }
  }
  for (const match of text.matchAll(/;/g)) {
    notes.push({
      code: "semicolon",
      message: "semicolon joining two ideas",
      instead: "two sentences",
      start: at[match.index]!,
    });
  }
  for (const match of text.matchAll(/(?<![\uE000\uE002]):\s+(?=\p{Ll})/gu)) {
    notes.push({
      code: "colon",
      message: "colon joining two ideas",
      instead: "two sentences",
      start: at[match.index]!,
    });
  }
  for (const open of parentheticals(text)) {
    notes.push({
      code: "parenthetical",
      message: "aside in parentheses",
      instead: "its own sentence, or cut it",
      start: at[open]!,
    });
  }
  return notes;
}

/** @prose
 * ## The summary
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

/** Every note in a parsed text, in the order they occur. */
export function textNotes(doc: Document): Note[] {
  const notes: Note[] = [];
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
            notes.push({
              code: "long-summary",
              message: `first paragraph of ${count} words`,
              instead: "a summary of about three lines, with detail below it",
              start: doc.start(child),
            });
          }
        }
        notes.push(...paragraphNotes(flat));
      } else if (type !== "heading" && type !== "code" && type !== "table") visit(child);
    }
  };
  visit(doc.root);
  return notes.sort((a, b) => a.start - b.start);
}
