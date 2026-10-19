/** @prose
 * # Style tests
 *
 * Where a text's style breaks the plain-sentence rules, and the forms that look like a break but
 * aren't, like a list item's label, an abbreviation or a short gloss. Then the advice on a
 * repository's files, at each one's own line, leaving out what isn't checked.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { styleAdvice, textStyle } from "../src/style.js";
import { projectFiles } from "../src/tree.js";

const codes = (text: string) => textStyle(parse(text)).map((n) => n.code);
const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("textStyle", () => {
  it("notes a first paragraph past about three lines, and only the first", () => {
    expect(codes(`# A\n\n${words(30)}. ${words(31)}.\n`)).toEqual(["long-summary"]);
    expect(codes(`# A\n\nShort.\n\n${words(30)}. ${words(31)}.\n`)).toEqual([]);
    expect(codes(`- ${words(30)}. ${words(31)}.\n`)).toEqual([]);
  });

  it("notes a long sentence at its start, and splits before a lowercase name", () => {
    const text = `Short one. ${words(36)}.\n`;
    expect(textStyle(parse(text))).toMatchObject([{ code: "long-sentence", start: 11 }]);
    expect(codes(`${words(20)}. prose ${words(20)}.\n`)).toEqual([]);
    expect(codes(`${words(20)}, e.g. ${words(20)}.\n`)).toEqual(["long-sentence"]);
  });

  it("counts inline code as one word and a link's text as its words", () => {
    expect(codes(`\`${words(40)}\` is fine.\n`)).toEqual([]);
    expect(codes(`[${words(36)}](x.md).\n`)).toEqual(["long-sentence"]);
  });

  it("notes a semicolon, and a colon only before a lowercase clause", () => {
    expect(codes("One idea; another.\n")).toEqual(["joining-semicolon"]);
    expect(codes("It means one thing: the other is true.\n")).toEqual(["joining-colon"]);
    expect(codes("It does this:\n\n- a list\n")).toEqual([]);
    expect(codes("- [a.ts](a.ts): what it does.\n- `b`: what it holds.\n")).toEqual([]);
    expect(codes("- **Stories:** one page, its own design.\n")).toEqual([]);
    expect(codes("- **spec**: the spec's own text.\n")).toEqual([]);
    expect(codes("Origin: markz.\n")).toEqual([]);
  });

  it("notes a colon only when a subject or a verb plainly opens a clause after it", () => {
    expect(codes("Nothing is rendered: it's the files it wrote, and only them.\n")).toEqual([
      "joining-colon",
    ]);
    expect(codes("It is yours to decide: markz doesn't style it.\n")).toEqual(["joining-colon"]);
    expect(codes("It reads one way: the parser keeps every line it was given.\n")).toEqual([
      "joining-colon",
    ]);
    expect(codes("It carries attributes: an id, classes and key-value pairs.\n")).toEqual([]);
    expect(codes("It costs a lot: headings +12%, tables +10%.\n")).toEqual([]);
    expect(codes("How markz is built: the tree it produces, and how it reads.\n")).toEqual([]);
    expect(codes("It is safe: no element that runs script, and no handler.\n")).toEqual([]);
    expect(codes("It is the file: what markz is held to, and what it costs.\n")).toEqual([]);
  });

  it("doesn't note a semicolon in a list of clauses or in a parenthesis", () => {
    expect(codes("It reads noise, at random; examples, edited; and documents.\n")).toEqual([]);
    expect(codes("It reads noise, at random; and examples, edited.\n")).toEqual([]);
    expect(codes("The rule holds (grammar: table; `table-columns`).\n")).toEqual([]);
  });

  it("notes an aside in parentheses, but not a link, an example or a short gloss", () => {
    expect(codes("It builds (which takes a while to finish) first.\n")).toEqual([
      "parenthetical-aside",
    ]);
    expect(codes("It builds ([usage](usage.md)) first.\n")).toEqual([]);
    expect(codes("Some tools (like the formatter and the linter) keep working.\n")).toEqual([]);
    expect(codes("The port (default 1234) is tried first.\n")).toEqual([]);
  });

  it("doesn't note a citation, a series or code in parentheses", () => {
    expect(codes("The block is read once (design: Parser foundation, in full).\n")).toEqual([]);
    expect(codes("Leaves (paragraphs, headings, table cells) go on.\n")).toEqual([]);
    expect(codes("It's decoded (`&#169;` → `©`, `\\*` → `*`) first.\n")).toEqual([]);
  });

  it("reads paragraphs only, not headings, code or tables", () => {
    const text = `# One; two\n\n\`\`\`\none; two\n\`\`\`\n\n| a; b |\n| --- |\n| c; d |\n`;
    expect(codes(text)).toEqual([]);
  });
});

describe("styleAdvice", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "prose-style-"));
    const files: Record<string, string> = {
      "README.md": "# Demo\n\nOne idea; another.\n",
      "src/a.ts": "/** @prose\n * # A\n *\n * One idea; another.\n */\nexport const a = 1;\n",
      "fixtures/b.md": "# B\n\nOne idea; another.\n",
      ".gitattributes": "fixtures/** prose-unchecked\n",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    execFileSync("git", ["init", "-q"], { cwd: root });
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("places advice at the file's own line and column, and skips files .gitattributes marks prose-unchecked", () => {
    expect(styleAdvice(root, projectFiles(root))).toMatchObject([
      { path: "README.md", code: "joining-semicolon", line: 3, column: 9 },
      { path: "src/a.ts", code: "joining-semicolon", line: 4, column: 12 },
    ]);
  });
});
