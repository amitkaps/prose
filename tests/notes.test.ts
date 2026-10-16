/** @prose
 * # Notes tests
 *
 * Where a text's style breaks the plain-sentence rules, and the forms that look like a break but
 * aren't, like a list item's label, an abbreviation or a short gloss.
 */
import { parse } from "@amitkaps/markz";
import { describe, expect, it } from "vite-plus/test";
import { textNotes } from "../src/notes.js";

const codes = (text: string) => textNotes(parse(text)).map((n) => n.code);
const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("textNotes", () => {
  it("notes a first paragraph past about three lines, and only the first", () => {
    expect(codes(`# A\n\n${words(30)}. ${words(31)}.\n`)).toEqual(["long-summary"]);
    expect(codes(`# A\n\nShort.\n\n${words(30)}. ${words(31)}.\n`)).toEqual([]);
    expect(codes(`- ${words(30)}. ${words(31)}.\n`)).toEqual([]);
  });

  it("notes a long sentence at its start, and splits before a lowercase name", () => {
    const text = `Short one. ${words(36)}.\n`;
    expect(textNotes(parse(text))).toMatchObject([{ code: "long-sentence", start: 11 }]);
    expect(codes(`${words(20)}. prose ${words(20)}.\n`)).toEqual([]);
    expect(codes(`${words(20)}, e.g. ${words(20)}.\n`)).toEqual(["long-sentence"]);
  });

  it("counts inline code as one word and a link's text as its words", () => {
    expect(codes(`\`${words(40)}\` is fine.\n`)).toEqual([]);
    expect(codes(`[${words(36)}](x.md).\n`)).toEqual(["long-sentence"]);
  });

  it("notes a semicolon, and a colon only before a lowercase clause", () => {
    expect(codes("One idea; another.\n")).toEqual(["semicolon"]);
    expect(codes("It means one thing: the other follows.\n")).toEqual(["colon"]);
    expect(codes("It does this:\n\n- a list\n")).toEqual([]);
    expect(codes("- [a.ts](a.ts): what it does.\n- `b`: what it holds.\n")).toEqual([]);
    expect(codes("- **Stories:** one page, its own design.\n")).toEqual([]);
  });

  it("notes an aside in parentheses, but not a link, an example or a short gloss", () => {
    expect(codes("It builds (which takes a while to finish) first.\n")).toEqual(["parenthetical"]);
    expect(codes("It builds ([usage](usage.md)) first.\n")).toEqual([]);
    expect(codes("Some tools (like the formatter and the linter) keep working.\n")).toEqual([]);
    expect(codes("The port (default 1234) is tried first.\n")).toEqual([]);
  });

  it("reads paragraphs only, not headings, code or tables", () => {
    const text = `# One; two\n\n\`\`\`\none; two\n\`\`\`\n\n| a; b |\n| --- |\n| c; d |\n`;
    expect(codes(text)).toEqual([]);
  });
});
