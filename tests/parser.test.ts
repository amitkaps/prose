/** @prose
 * # Parser tests
 *
 * What counts as prose in each language, and the one placement rule they share. The rules are
 * [writing](../docs/writing.md#in-each-language).
 */

import { describe, expect, it } from "vite-plus/test";
import { firstParagraph, parseFile } from "../src/parser.js";

const bodies = (source: string, ext: string) => parseFile(source, ext).map((c) => c.body);

describe("parseFile: JS/TS/CSS (/** @prose */)", () => {
  it("reads each marked comment in source order, with its span", () => {
    const source = `/** @prose\n * File summary.\n */\nimport x from "y";\n\n/** @prose\n * A later one.\n */\nconst a = 1;\n`;
    const comments = parseFile(source, "js");
    expect(comments.map((c) => c.body)).toEqual(["File summary.", "A later one."]);
    expect(source.slice(comments[1]!.start, comments[1]!.end)).toBe(
      "/** @prose\n * A later one.\n */",
    );
  });

  it("reads `*\\/` in a comment as `*/`, which would have ended the comment", () => {
    expect(bodies("/** @prose\n * Ends with *\\/ in text.\n */\nconst a = 1;\n", "ts")).toEqual([
      "Ends with */ in text.",
    ]);
  });

  it("ignores unmarked comments, and @note, which is no longer read", () => {
    const source = `// just a code comment\n/** normal jsdoc, no @prose */\n/** @note A question. */\nconst a = 1;\n`;
    expect(parseFile(source, "js")).toEqual([]);
  });

  it("strips the leading ` * ` gutter from continuation lines", () => {
    expect(bodies(`/** @prose\n * Line one.\n * Line two.\n */\n`, "js")).toEqual([
      "Line one.\nLine two.",
    ]);
  });

  it("eats a body line's own leading * when that line skips the gutter (documented landmine)", () => {
    // Every continuation line is expected to carry the ` * ` gutter. A line that skips it and
    // starts with a literal `*` of its own, like a Markdown bullet, loses that `*`.
    expect(bodies(`/** @prose\n * Intro.\n* a bullet\n */\n`, "js")).toEqual(["Intro.\na bullet"]);
  });

  it("isn't fooled by regex literals or division", () => {
    for (const line of ["const RE = /`/g;", "const ratio = a / b;", "const RE = /[a/b]/g;"]) {
      expect(bodies(`${line}\n/** @prose After. */\nconst c = 1;`, "js")).toEqual(["After."]);
    }
  });

  it("skips a `/*` inside a CSS string", () => {
    const css = `a::before { content: "/** @prose not one */"; }\n/** @prose Real. */\n`;
    expect(bodies(css, "css")).toEqual(["Real."]);
  });
});

describe("parseFile: HTML (<!-- @prose -->)", () => {
  it("takes body lines as-is, with no gutter stripping", () => {
    const source = `<!-- @prose\nLine one.\n * looks like a bullet but is not a gutter\n-->\n<h1>hi</h1>\n`;
    expect(bodies(source, "html")).toEqual([
      "Line one.\n * looks like a bullet but is not a gutter",
    ]);
  });
});

describe("parseFile: YAML, TOML and .gitignore (# @prose)", () => {
  it("reads a run of # lines from the marker, gutter stripped", () => {
    for (const ext of ["yaml", "toml", "gitignore"]) {
      expect(bodies("# @prose\n# # Run\n#\n# Starts it.\n\nname = 1\n", ext)).toEqual([
        "# Run\n\nStarts it.",
      ]);
    }
  });

  it("ends a comment at the next marker line, so two can sit back to back", () => {
    const source = "# @prose\n# File.\n# @prose\n# Next.\nport = 8080\n";
    const comments = parseFile(source, "toml");
    expect(comments.map((c) => c.body)).toEqual(["File.", "Next."]);
    expect(source.slice(comments[1]!.start, comments[1]!.end)).toBe("# @prose\n# Next.");
  });

  it("ignores unmarked # comments", () => {
    expect(parseFile("# just a comment\nname: demo\n", "yaml")).toEqual([]);
  });
});

describe("parseFile: .svelte (script/style as TS/CSS, markup as HTML)", () => {
  it("merges comments from all three parts in source order, at their place in the file", () => {
    const source = [
      '<script lang="ts">',
      "/** @prose\n * # Title\n * From the script.\n */",
      'import x from "y";',
      "</script>",
      "",
      "<!-- @prose From the markup. -->",
      "<h1>hi</h1>",
      "",
      "<style>",
      "/** @prose From the style. */",
      "h1 { color: red; }",
      "</style>",
      "",
    ].join("\n");
    const comments = parseFile(source, "svelte");
    expect(comments.map((c) => c.body)).toEqual([
      "# Title\nFrom the script.",
      "From the markup.",
      "From the style.",
    ]);
    expect(source.slice(comments[2]!.start, comments[2]!.end)).toBe(
      "/** @prose From the style. */",
    );
  });
});

describe("parseFile: .html reads its script and style parts too", () => {
  it("finds prose in a template's script and in a style", () => {
    const source = [
      "<!-- @prose Element. -->",
      "<template>",
      "<script>",
      "/** @prose Why the helper. */",
      "const x = 1;",
      "</script>",
      "</template>",
      "<style>",
      "/** @prose Why the selector. */",
      "h1 { color: red; }",
      "</style>",
      "",
    ].join("\n");
    expect(parseFile(source, "html").map((c) => c.body)).toEqual([
      "Element.",
      "Why the helper.",
      "Why the selector.",
    ]);
  });

  it("reads a <script> mentioned in a comment as the comment's text", () => {
    const source = [
      "<!-- @prose",
      "A slot can hold `<script>` tags.",
      "-->",
      "<p>x</p>",
      "<script>",
      "/** @prose Why the script. */",
      "go();",
      "</script>",
      "",
    ].join("\n");
    expect(parseFile(source, "html").map((c) => c.body)).toEqual([
      "A slot can hold `<script>` tags.",
      "Why the script.",
    ]);
  });
});

describe("a comment counts when it starts its own line, at any depth", () => {
  it("reads a class method by method", () => {
    const ts = [
      "/** @prose File. */",
      "export class Parser {",
      "\t/** @prose",
      "\t * Runs it.",
      "\t */",
      "\trun(): void {}",
      "",
      "\tfield = {",
      "\t\t/** @prose Deep. */",
      "\t\tb: 1,",
      "\t};",
      "}",
    ].join("\n");
    expect(bodies(ts, "ts")).toEqual(["File.", "Runs it.", "Deep."]);
  });

  it("leaves one that shares its line with code in the code", () => {
    expect(bodies("/** @prose File. */\ncall(/** @prose Inline. */ 1);\n", "ts")).toEqual([
      "File.",
    ]);
    expect(
      bodies("/** @prose File. */\n.a { /** @prose Inline. */ color: red; }\n", "css"),
    ).toEqual(["File."]);
    expect(bodies("<!-- @prose File. -->\n<p>Hi <!-- @prose Inline. --></p>\n", "html")).toEqual([
      "File.",
    ]);
    expect(bodies("# @prose\n# File.\nname: demo # @prose Inline.\n", "yaml")).toEqual(["File."]);
  });

  it("reads an indented one inside a CSS rule or a YAML mapping", () => {
    expect(bodies(".a {\n  /** @prose Inside. */\n  color: red;\n}\n", "css")).toEqual(["Inside."]);
    const yaml = "a:\n  # @prose\n  # Inside.\n  c: 2\n";
    const comments = parseFile(yaml, "yaml");
    expect(comments.map((c) => c.body)).toEqual(["Inside."]);
    expect(yaml.slice(comments[0]!.start, comments[0]!.end)).toBe("# @prose\n  # Inside.");
  });
});

describe("firstParagraph", () => {
  it("skips a leading heading and returns the first paragraph", () => {
    expect(firstParagraph("# Title\n\nFirst paragraph.\n\nSecond paragraph.")).toBe(
      "First paragraph.",
    );
  });

  it("returns the whole text when there is no heading or second paragraph", () => {
    expect(firstParagraph("Just one paragraph.")).toBe("Just one paragraph.");
  });
});
