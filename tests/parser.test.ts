/** @prose
 * # Parser tests
 *
 * What counts as prose, per language (spec §3.1): a `@prose` block comment in JS, TS and CSS, an HTML comment in HTML,
 * `# @prose` runs in YAML and TOML, and a `.svelte` file's script, style and markup merged in order. Also
 * the first paragraph, anchors (§3.2), nested blocks, and that `@note` is no longer read.
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";
import { firstParagraph, parseFile } from "../src/parser.js";

describe("parseFile: JS/TS/CSS (/** @prose */)", () => {
  it("reads the first block as file prose and later blocks as chunks", () => {
    const source = `/** @prose\n * File summary.\n */\nimport x from "y";\n\n/** @prose\n * A chunk.\n */\nconst a = 1;\n`;
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBe("File summary.");
    expect(parsed.preamble).toBe('import x from "y";');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]!.chunks).toHaveLength(1);
    expect(parsed.sections[0]!.chunks[0]!.prose).toBe("A chunk.");
    expect(parsed.sections[0]!.chunks[0]!.code).toBe("const a = 1;");
    expect(parsed.sections[0]!.chunks[0]!.pending).toBe(false);
  });

  it("marks a chunk pending when no code follows before EOF", () => {
    const source = `/** @prose\n * File.\n */\n\n/** @prose\n * Plan item.\n */\n`;
    const parsed = parseFile(source, "js");
    expect(parsed.sections[0]!.chunks[0]!.pending).toBe(true);
    expect(parsed.sections[0]!.chunks[0]!.code).toBe("");
  });

  it("starts a new section on a heading line, and keeps the heading block as a chunk too", () => {
    const source = [
      "/** @prose\n * File.\n */",
      "/** @prose\n * # State\n *\n * About state.\n */\nlet count = 0;",
      "/** @prose\n * A second chunk in the same section.\n */\nlet x = 1;",
    ].join("\n\n");
    const parsed = parseFile(source, "js");
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]!.heading).toBe("State");
    expect(parsed.sections[0]!.chunks).toHaveLength(2);
    expect(parsed.sections[0]!.chunks[0]!.heading).toBe("State");
    expect(parsed.sections[0]!.chunks[1]!.heading).toBeNull();
  });

  it("ignores unmarked comments entirely, treating them as code", () => {
    const source = `// just a code comment\n/** normal jsdoc, no @prose */\nconst a = 1;\n`;
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBeNull();
    expect(parsed.preamble).toBe(source.trim());
  });

  it("strips the leading ` * ` gutter from continuation lines", () => {
    const source = `/** @prose\n * Line one.\n * Line two.\n */\n`;
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBe("Line one.\nLine two.");
  });

  it("eats a body line's own leading * when that line skips the gutter (documented landmine)", () => {
    // Every continuation line is expected to carry the ` * ` gutter (spec.md §3.1). A line
    // that skips it and starts with a literal `*` of its own (e.g. a markdown bullet) is
    // indistinguishable from a gutter line to the strip regex, and loses its marker.
    const source = `/** @prose\n * Intro.\n* a bullet\n */\n`;
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBe("Intro.\na bullet");
  });

  it("does not let a backtick inside a regex literal corrupt depth tracking for the rest of the file", () => {
    // The old hand tokenizer read a bare backtick in a regex (e.g. `/\`/g`) as a template literal
    // and miscounted depth for the rest of the file (`docs/lessons.md`). oxc reads it right.
    const source = [
      "const RE = /`/g;",
      "function useless() { const x = 1; }",
      "/** @prose A chunk after the regex. */",
      "const a = 1;",
    ].join("\n");
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBe("A chunk after the regex.");
  });

  it("still treats a bare / after a value as division, not a regex", () => {
    // `a / b` — the `/` follows an identifier, so it must stay division. If this were ever
    // misread as a regex start, it would scan forward looking for a closing `/` and could
    // swallow real code (including a later @prose block) as if it were inside the "regex".
    const source = [
      "const ratio = a / b;",
      "/** @prose A chunk after a division. */",
      "const c = 1;",
    ].join("\n");
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBe("A chunk after a division.");
  });

  it("handles a / inside a regex character class without ending the regex early", () => {
    const source = [
      "const RE = /[a/b]/g;",
      "/** @prose A chunk after a regex with a slash in a character class. */",
      "const c = 1;",
    ].join("\n");
    const parsed = parseFile(source, "js");
    expect(parsed.fileProse).toBe("A chunk after a regex with a slash in a character class.");
  });
});

describe("parseFile: HTML (<!-- @prose -->)", () => {
  it("takes body lines as-is, with no gutter stripping", () => {
    const source = `<!-- @prose\nLine one.\n * looks like a bullet but is not a gutter\n-->\n<h1>hi</h1>\n`;
    const parsed = parseFile(source, "html");
    expect(parsed.fileProse).toBe("Line one.\n * looks like a bullet but is not a gutter");
  });

  it("chunks code between comments", () => {
    const source = `<!-- @prose\nFile.\n-->\n<!-- @prose\nA chunk.\n-->\n<h1>hi</h1>\n`;
    const parsed = parseFile(source, "html");
    expect(parsed.sections[0]!.chunks[0]!.code).toBe("<h1>hi</h1>");
  });
});

describe("parseFile: YAML/TOML (# @prose)", () => {
  it("reads a top-level # comment block as file prose, gutter stripped", () => {
    const source = "# @prose\n# File summary.\nname: demo\n";
    const parsed = parseFile(source, "yaml");
    expect(parsed.fileProse).toBe("File summary.");
    expect(parsed.preamble).toBe("name: demo");
  });

  it("chunks code between # comment blocks, in a .toml file", () => {
    const source = "# @prose\n# File.\n\n# @prose\n# A chunk.\nport = 8080\n";
    const parsed = parseFile(source, "toml");
    expect(parsed.sections[0]!.chunks[0]!.prose).toBe("A chunk.");
    expect(parsed.sections[0]!.chunks[0]!.code).toBe("port = 8080");
    expect(parsed.sections[0]!.chunks[0]!.codeLang).toBe("toml");
  });

  it("does not treat an indented # comment (nested inside a mapping) as a prose block", () => {
    const source = "top:\n  # not top-level, just a code comment\n  child: 1\n";
    const parsed = parseFile(source, "yaml");
    expect(parsed.fileProse).toBeNull();
  });

  it("ignores unmarked # comments, treating them as ordinary code", () => {
    const source = "# just a comment\nname: demo\n";
    const parsed = parseFile(source, "yaml");
    expect(parsed.fileProse).toBeNull();
  });
});

describe("parseFile: .svelte (script/style as JS/CSS, markup as HTML, merged in order)", () => {
  it("merges blocks from all three parts in source order", () => {
    const source = [
      '<script lang="ts">',
      "/** @prose\n * # Title\n * File-level prose from the script part.\n */",
      'import x from "y";',
      "",
      "/** @prose A chunk in the script. */",
      "let a = 1;",
      "</script>",
      "",
      "<!-- @prose Markup chunk. -->",
      "<h1>hi</h1>",
      "",
      "<style>",
      "/** @prose A style chunk. */",
      "h1 { color: red; }",
      "</style>",
      "",
    ].join("\n");
    const parsed = parseFile(source, "svelte");
    expect(parsed.fileProse).toBe("# Title\nFile-level prose from the script part.");
    expect(parsed.preamble).toBe('import x from "y";');
    const chunks = parsed.sections.flatMap((s) => s.chunks);
    expect(chunks.map((c) => c.prose)).toEqual([
      "A chunk in the script.",
      "Markup chunk.",
      "A style chunk.",
    ]);
  });

  it("clips each chunk's code at its own part boundary — no bleed across </script>/<style>", () => {
    const source = [
      '<script lang="ts">',
      "/** @prose File prose — the first block, so it is not a chunk. */",
      "",
      "/** @prose A chunk. */",
      "let a = 1;",
      "</script>",
      "",
      "<!-- @prose Markup. -->",
      "<h1>hi</h1>",
      "",
      "<style>",
      "/** @prose Style. */",
      "h1 { color: red; }",
      "</style>",
    ].join("\n");
    const parsed = parseFile(source, "svelte");
    const chunks = parsed.sections.flatMap((s) => s.chunks);
    expect(chunks[0]!.code).toBe("let a = 1;");
    expect(chunks[0]!.code).not.toContain("</script>");
    expect(chunks[1]!.code).toBe("<h1>hi</h1>");
    expect(chunks[1]!.code).not.toContain("<style>");
    expect(chunks[2]!.code).toBe("h1 { color: red; }");
    expect(chunks[2]!.code).not.toContain("</style>");
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

const anchorsOf = (source: string, ext = "ts") =>
  parseFile(source, ext).sections.flatMap((s) => s.chunks.map((c) => c.anchor));

describe("anchors (spec §3.2)", () => {
  it("names a chunk by its heading, then its first declared name, then its position", () => {
    const source = [
      "/** @prose File. */",
      "/** @prose Adds. */\nexport function addTodo() {}",
      "/** @prose\n * # Filtering\n */",
      "/** @prose\n * ## Table rows\n */\nfunction cells() {}",
      "/** @prose Loose. */\nconsole.log(1);",
    ].join("\n\n");
    expect(anchorsOf(source)).toEqual(["addTodo", "filtering", "table-rows", "chunk-4"]);
  });

  it("suffixes repeats in source order, and keeps `file` for the file prose", () => {
    const source = [
      "/** @prose File. */",
      "/** @prose One. */\nconst file = 1;",
      "/** @prose Two. */\nfunction a() {}",
      "/** @prose Three. */\nfunction a(x) {}",
    ].join("\n\n");
    expect(anchorsOf(source)).toEqual(["file-2", "a", "a-2"]);
    expect(parseFile(source, "ts").fileBlock?.anchor).toBe("file");
  });

  it("gives a heading in a non-JS file its slug", () => {
    expect(
      anchorsOf("/** @prose File. */\n\n/** @prose\n * # Layout\n */\nmain { }", "css"),
    ).toEqual(["layout"]);
  });

  it("property: inserting a block anywhere never changes what an existing anchor names", () => {
    const names = ["alpha", "beta", "gamma", "delta"];
    const chunk = (n: string) => `/** @prose ${n}. */\nexport const ${n} = 1;`;
    const heading = "/** @prose\n * # Notes\n */";
    fc.assert(
      fc.property(
        fc.subarray(names, { minLength: 1 }),
        fc.nat(),
        fc.constantFrom(chunk("epsilon"), heading, "/** @prose Bare. */"),
        (present, at, inserted) => {
          const blocks = present.map(chunk);
          const before = ["/** @prose File. */", ...blocks].join("\n\n");
          const i = at % (blocks.length + 1);
          const after = [
            "/** @prose File. */",
            ...blocks.slice(0, i),
            inserted,
            ...blocks.slice(i),
          ].join("\n\n");
          const beforeChunks = parseFile(before, "ts").sections.flatMap((s) => s.chunks);
          const afterByCode = new Map(
            parseFile(after, "ts")
              .sections.flatMap((s) => s.chunks)
              .map((c) => [c.anchor, c.code]),
          );
          for (const c of beforeChunks) expect(afterByCode.get(c.anchor)).toBe(c.code);
        },
      ),
    );
  });
});

describe("nested blocks (spec §3.1)", () => {
  it("reads a class method by method, each block named by the member below it", () => {
    const ts = [
      "/** @prose File. */",
      "export class Parser {",
      "\t/** @prose",
      "\t * Runs it.",
      "\t */",
      "\trun(start: number): void {",
      "\t\tconst at = start;",
      "\t}",
      "",
      "\t/** @prose",
      "\t * ## Metadata",
      "\t */",
      "\tmetadata(start: number): number {",
      "\t\treturn start;",
      "\t}",
      "",
      "\t/** @prose",
      "\t * The field.",
      "\t */",
      "\t#depth = 0;",
      "}",
      "",
    ].join("\n");
    const chunks = parseFile(ts, "ts").sections.flatMap((s) => s.chunks);
    expect(chunks.map((c) => c.anchor)).toEqual(["run", "metadata", "depth"]);
    expect(chunks[0]!.code).toBe("run(start: number): void {\n\t\tconst at = start;\n\t}");
    expect(chunks[2]!.code).toBe("#depth = 0;\n}");
  });

  it("splits a function at a block inside it, and names it by the first declaration below", () => {
    const js =
      "/** @prose File. */\nfunction f() {\n  g();\n  /** @prose Then. */\n  const h = 1;\n}\n";
    const [chunk] = parseFile(js, "ts").sections.flatMap((s) => s.chunks);
    expect(chunk!.anchor).toBe("h");
    expect(chunk!.code).toBe("const h = 1;\n}");
  });

  it("names a block with nothing declared below it in its chunk by position", () => {
    const js = "/** @prose File. */\nfunction f() {\n  /** @prose Then. */\n  g();\n}\n";
    expect(parseFile(js, "ts").sections[0]!.chunks[0]!.anchor).toBe("chunk-1");
  });

  it("leaves a @prose comment that shares its line with code, inside a statement, in the code", () => {
    const js = "/** @prose File. */\ncall(/** @prose Inline. */ 1);\n";
    const parsed = parseFile(js, "ts");
    expect(parsed.sections.flatMap((s) => s.chunks)).toEqual([]);
    expect(parsed.preamble).toContain("/** @prose Inline. */");
  });

  it("reads a CSS block inside a rule when it starts its own line", () => {
    const css = "/** @prose File. */\n.a {\n  /** @prose Inside. */\n  color: red;\n}\n";
    const chunks = parseFile(css, "css").sections.flatMap((s) => s.chunks);
    expect(chunks.map((c) => c.code)).toEqual(["color: red;\n}"]);
    const inline = "/** @prose File. */\n.a { /** @prose Inline. */ color: red; }\n";
    expect(parseFile(inline, "css").preamble).toContain("/** @prose Inline. */");
  });

  it("names a block inside a .svelte script by the member below it", () => {
    const svelte =
      "<script>\n/** @prose File. */\nconst api = {\n  /** @prose Loads. */\n  load() {},\n};\n</script>\n";
    expect(parseFile(svelte, "svelte").sections[0]!.chunks[0]!.anchor).toBe("load");
  });

  it("still finds a top-level block after a function, and ignores an object literal's plain doc comment", () => {
    const s =
      "/** @prose File. */\nfunction f() {}\n/** @prose Next. */\nconst a = { /** doc */ b: 1 };\n";
    expect(parseFile(s, "ts").sections[0]!.chunks).toHaveLength(1);
  });

  it("leaves an indented YAML @prose in the code", () => {
    const s = "# @prose\n# File.\na:\n  # @prose\n  # Ignored.\n  c: 2\n";
    const parsed = parseFile(s, "yaml");
    expect(parsed.sections.flatMap((s) => s.chunks)).toEqual([]);
    expect(parsed.preamble).toContain("# Ignored.");
  });
});

describe("@note (dropped in 0.2.0)", () => {
  it("is an ordinary comment, left in the chunk's code", () => {
    const source =
      "/** @prose File. */\n\n/** @prose A chunk. */\n/** @note A question. */\nconst a = 1;";
    const chunk = parseFile(source, "js").sections[0]!.chunks[0]!;
    expect(chunk.prose).toBe("A chunk.");
    expect(chunk.code).toBe("/** @note A question. */\nconst a = 1;");
  });
});
