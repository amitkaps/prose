/** @prose
 * # Lexer tests
 *
 * The constructs that can hide a comment or fake one, and a check that the lexer finds the same
 * comments as oxc's parser in every JS and TS file in the repository. oxc comes with vite-plus, so
 * it costs no dependency.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseSync } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";
import { lexJs } from "../src/lexer.js";

const comments = (source: string) =>
  lexJs(source)
    .filter((t) => t.kind === "comment")
    .map((t) => source.slice(t.start, t.end));

describe("lexJs: what can hide a comment", () => {
  it("skips strings, including escaped quotes", () => {
    expect(comments(`const a = "/* no */", b = 'it\\'s /* no */'; /* yes */`)).toEqual([
      "/* yes */",
    ]);
  });

  it("skips template text but reads the code inside `${…}`", () => {
    const source = "const t = `/* no */ ${a /* yes */ + `/* no */ ${{ b: 1 }.b}`} /* no */`;";
    expect(comments(source)).toEqual(["/* yes */"]);
  });

  it("skips regexes, with slashes and backticks in classes and escapes", () => {
    for (const re of ["/`/g", "/[/*]/", "/\\/\\*/", "/a/ ; return /x/"]) {
      expect(comments(`x = ${re}; /* yes */`)).toEqual(["/* yes */"]);
    }
  });

  it("reads a `/` after a value as division", () => {
    expect(comments("const r = a / b / c; /* yes */")).toEqual(["/* yes */"]);
    expect(comments("const r = (a) / 2 /* yes */ / 3;")).toEqual(["/* yes */"]);
    expect(comments("i++ / 2; /* yes */")).toEqual(["/* yes */"]);
  });

  it("skips a hashbang line, and ends a line comment before `\\r\\n`", () => {
    expect(comments("#!/usr/bin/env node\r\n// yes\r\nx;")).toEqual(["// yes"]);
  });
});

describe("lexJs agrees with oxc", () => {
  const files = execFileSync("git", ["ls-files", "*.ts", "*.js"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  it.each(files)("%s", (file) => {
    const source = readFileSync(file, "utf8");
    const want = parseSync(file, source).comments.map((c) => [c.start, c.end]);
    const got = lexJs(source)
      .filter((t) => t.kind === "comment")
      .map((t) => [t.start, t.end]);
    expect(got).toEqual(want);
  });
});
