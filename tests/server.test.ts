/** @prose
 * # Server tests
 *
 * The pages `prose .` serves ([reading](../docs/reading.md#pages)), mostly for
 * `tests/fixtures/simple`. Also the links between comments, the table of contents and live
 * reload. Requests go out raw, so a path like `/../x` arrives as written and must be refused.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { type IncomingHttpHeaders, request } from "node:http";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { LIVE, SCRIPT, STYLE } from "../src/assets.js";
import { segments, sourceBody, tableOfContents } from "../src/render.js";
import { serve, type Served, touches } from "../src/server.js";
import { parseFile } from "../src/parser.js";

/** A raw GET, so a path like `/../x` reaches the server as written instead of being normalized. */
function get(
  url: string,
  path: string,
): Promise<{ status: number; body: string; location?: string; headers: IncomingHttpHeaders }> {
  return new Promise((done, fail) => {
    const req = request(new URL(url), { path, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () =>
        done({
          status: res.statusCode ?? 0,
          body,
          location: res.headers.location,
          headers: res.headers,
        }),
      );
    });
    req.on("error", fail);
    req.end();
  });
}

describe("segments", () => {
  it("lays a file out as code runs around its comments, dropping the comment text", () => {
    const source = "/** @prose A. */\nimport x;\n\n/** @prose B. */\n\nconst b = 1;\n";
    const comment = (start: number) => ({ body: "", start, end: start + 16 });
    const a = source.indexOf("/** @prose A. */");
    const b = source.indexOf("/** @prose B. */");
    const parts = segments(source, [comment(b), comment(a)]);
    expect(parts.map((p) => (p.kind === "code" ? [p.text, p.line] : "comment"))).toEqual([
      "comment",
      ["import x;", 2],
      "comment",
      ["const b = 1;", 6],
    ]);
  });
});

describe("sourceBody", () => {
  it("links each later comment by its first heading, unique on the page, and one with none not at all", async () => {
    const source = [
      "/** @prose\n * # Store\n */",
      "/** @prose\n * # Adding\n */\nconst a = 1;",
      "/** @prose\n * # Adding\n */\nconst b = 1;",
      "/** @prose\n * No heading.\n */\nconst c = 1;",
    ].join("\n");
    const comments = parseFile(source, "ts");
    const body = sourceBody({
      name: "s.ts",
      kind: "file",
      path: "s.ts",
      summary: "",
      source,
      comments,
      children: [],
    });
    expect(body).toContain('<h1 id="store">Store</h1>');
    expect(body).toContain('<h2 id="adding"><a class="anchor" href="#adding"');
    expect(body).toContain('<h2 id="adding-1"><a class="anchor" href="#adding-1"');
    expect(body.match(/class="anchor"/g)).toHaveLength(2);
  });
});

describe("tableOfContents", () => {
  it("lists a doc's second- and third-level headings by their ids, folded and beside the page", () => {
    const toc = tableOfContents(
      '<h1 id="t">T</h1><h2 id="a">A</h2><h3 id="b">B <code>x</code></h3><h4 id="c">C</h4><h2 id="d">D</h2>',
    );
    expect(toc).toContain('<details class="toc toc-top"><summary>On this page</summary>');
    expect(toc).toContain('<nav class="toc toc-side" aria-label="On this page">');
    expect(toc).toContain('<li class="toc-3"><a href="#b">B x</a></li>');
    expect(toc).not.toContain('href="#c"');
    expect(toc).not.toContain('href="#t"');
  });

  it("lists a comment's heading by its id, without its # link", () => {
    const block = (id: string) =>
      `<section class="block"><div class="prose"><h2 id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${id}</h2></div></section>`;
    const toc = tableOfContents(block("one") + block("two") + block("three"));
    expect(toc).toContain('<li class="toc-2"><a href="#two">two</a></li>');
  });

  it("has none for a page with fewer than three", () => {
    expect(tableOfContents('<h2 id="a">A</h2><h2 id="b">B</h2>')).toBe("");
  });
});

describe("serve: tests/fixtures/simple", () => {
  let served: Served;
  beforeAll(async () => {
    served = await serve(resolve("tests/fixtures/simple"), { port: 0, watch: false });
  });
  afterAll(() => served.close());

  it("renders the project page: the README, then each file with its first paragraph", async () => {
    const { status, body } = await get(served.url, "/");
    expect(status).toBe(200);
    expect(body).toContain("<h1");
    expect(body).toContain('href="/main.js"');
    expect(body).toContain("holds the count, applies a step");
  });

  it("renders a source file as one document: comments linked by heading, code numbered from its file line", async () => {
    const { status, body } = await get(served.url, "/main.js");
    expect(status).toBe(200);
    // A later comment's heading keeps markz's id, one level down, with its `#` inside it.
    expect(body).toContain(
      '<h2 id="state"><a class="anchor" href="#state" aria-label="Link to this section">#</a>State</h2>',
    );
    expect(body).toContain('<h2 id="input">');
    expect(body).toContain('<h2 id="persistence">');
    // The file's own comment has no heading here, so no link.
    expect(body.match(/class="anchor"/g)).toHaveLength(3);
    // The State comment's code starts on line 12 of main.js, so the gutter counts on from 11.
    expect(body).toMatch(/<div class="code" style="counter-reset: line 11;/);
    expect(body).toContain('data-mode="prose"');
    expect(body).toContain('class="code-head"');
    expect(body).not.toContain("@prose");
  });

  it("renders CSS and HTML files the same way", async () => {
    expect((await get(served.url, "/style.css")).body).toContain('class="block');
    expect((await get(served.url, "/index.html")).body).toContain('class="block');
  });

  it("sends a folder's README.md to the folder's page, which the breadcrumb ends in", async () => {
    const res = await get(served.url, "/README.md");
    expect(res.status).toBe(301);
    expect(res.location).toBe("/");
    expect((await get(served.url, "/")).body).toMatch(
      /<span class="sep">\/<\/span><a href="\/" aria-current="page">README\.md<\/a><\/nav>/,
    );
  });

  it("links the shared files and serves them, cached for good", async () => {
    const { body } = await get(served.url, "/");
    for (const asset of [STYLE, SCRIPT, LIVE]) {
      expect(body).toContain(asset.url);
      const res = await get(served.url, asset.url);
      expect(res.body).toBe(asset.body);
      expect(res.headers["content-type"]).toBe(asset.type);
      expect(res.headers["cache-control"]).toContain("immutable");
    }
    expect(body).not.toContain("<style>");
  });

  it("refuses anything the walk doesn't list, a path outside the root included", async () => {
    expect((await get(served.url, "/nope.js")).status).toBe(404);
    // `/../x` and `/%2e%2e/x` normalize to `/x`, inside the root; an encoded slash doesn't.
    expect((await get(served.url, "/..%2F..%2Fpackage.json")).status).toBe(404);
    expect((await get(served.url, "/..%2Fsrc%2Fparser.ts")).status).toBe(404);
    expect((await get(served.url, "/node_modules/")).status).toBe(404);
  });
});

describe("serve: folders", () => {
  let root: string;
  let served: Served;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "prose-serve-test-"));
    const files: Record<string, string> = {
      "README.md": "# Demo\n\nThe project.\n",
      "app.ts": "export {};\n",
      "src/README.md": "# src\n\nThe source.\n",
      "src/a.ts": "/** @prose\n * Does a.\n */\nexport const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
      "docs/plan.md": "# Plan\n\nWhat's next.\n",
      "docs/grammar.md": "# Grammar\n\n```ebnf\ndigit ::= [0-9] | 'x'\n```\n",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    execFileSync("git", ["init", "-q"], { cwd: root });
    served = await serve(root, { port: 0, watch: false });
  });
  afterAll(async () => {
    await served.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("lists a folder's files in groups with their summaries, and names the undocumented on one line", async () => {
    const { body } = await get(served.url, "/src/");
    expect(body).toContain("The source.");
    expect(body).toMatch(
      /<p class="group-label">Code<\/p><ul class="listing"><li class="file"><a href="\/src\/a\.ts">a\.ts<\/a><p>Does a\.<\/p>/,
    );
    expect(body).toContain(
      '<p class="group-label">No prose yet</p><p class="names"><a href="/src/b.ts">b.ts</a></p>',
    );
    const root = (await get(served.url, "/")).body;
    expect(root.indexOf(">Folders<")).toBeLessThan(root.indexOf(">No prose yet<"));
  });

  it("shows a file with no prose as one run with the same header, and says so", async () => {
    const { body } = await get(served.url, "/src/b.ts");
    expect(body).toContain('<p class="no-prose">No prose in this file.</p><div class="code"');
    expect(body).toContain('class="code-head"');
    expect(body).not.toContain('data-mode="prose" aria-pressed="false" disabled');
  });

  it("shows docs/ as an ordinary folder on the project page", async () => {
    const { body } = await get(served.url, "/");
    expect(body).toContain('href="/docs/"');
    expect(body).toContain('href="/src/"');
  });

  it("shows the file tree on every page: folders first, the current page's folders open", async () => {
    const { body } = await get(served.url, "/src/a.ts");
    const start = body.indexOf('<nav class="rail"');
    const rail = body.slice(start, body.indexOf("</nav>", start) + 6);
    // `app.ts` sorts before both folders, and still comes after them.
    expect(rail.indexOf('data-folder="src"')).toBeLessThan(rail.indexOf('href="/app.ts"'));
    expect(rail).toContain('<details data-folder="src" open>');
    expect(rail).toContain('<details data-folder="docs">');
    expect(rail).toContain(
      '<a class="file" style="--depth: 1" href="/src/a.ts" aria-current="page">a.ts</a>',
    );
    // A folder's README.md is listed first in it, and goes to the folder's page.
    expect(rail).toMatch(
      /<ul style="--depth: 0"><li><a class="file" style="--depth: 1" href="\/src\/">README.md<\/a>/,
    );
    expect(rail).not.toContain('href="/src/README.md"');
  });

  it("renders a Markdown file with markz, the switch there but disabled", async () => {
    const { status, body } = await get(served.url, "/docs/plan.md");
    expect(status).toBe(200);
    expect(body).toContain('<div class="prose"><h1');
    expect(body).toContain('data-mode="prose" aria-pressed="false" disabled');
  });

  it("starts every breadcrumb at the project, and ends a folder's page with its README", async () => {
    const crumbs = (body: string) =>
      body.slice(
        body.indexOf('<nav class="crumbs">'),
        body.indexOf("</nav>", body.indexOf('<nav class="crumbs">')),
      );
    const sep = '<span class="sep">/</span>';
    const name = basename(root);
    expect(crumbs((await get(served.url, "/")).body)).toBe(
      `<nav class="crumbs"><a href="/">${name}</a>${sep}<a href="/" aria-current="page">README.md</a>`,
    );
    expect(crumbs((await get(served.url, "/src/")).body)).toBe(
      `<nav class="crumbs"><a href="/">${name}</a>${sep}<a href="/src/">src</a>${sep}<a href="/src/" aria-current="page">README.md</a>`,
    );
    expect(crumbs((await get(served.url, "/src/a.ts")).body)).toBe(
      `<nav class="crumbs"><a href="/">${name}</a>${sep}<a href="/src/">src</a>${sep}<a href="/src/a.ts" aria-current="page">a.ts</a>`,
    );
  });

  it("titles a tab by a doc's heading, a file's name or a folder's, then the project", async () => {
    const title = async (path: string) =>
      /<title>(.*)<\/title>/.exec((await get(served.url, path)).body)?.[1];
    const name = basename(root);
    expect(await title("/")).toBe(name);
    expect(await title("/src/")).toBe(`src/ · ${name}`);
    expect(await title("/src/a.ts")).toBe(`a.ts · ${name}`);
    expect(await title("/docs/plan.md")).toBe(`Plan · ${name}`);
  });

  it("highlights an EBNF fence: the rule's name, its terminals and character classes", async () => {
    const { body } = await get(served.url, "/docs/grammar.md");
    expect(body).toContain('<span class="function">digit</span>');
    expect(body).toContain('<span class="constant">[0-9]</span>');
    expect(body).toContain(`<span class="string">'x'</span>`);
  });

  it("redirects a folder asked for without its slash", async () => {
    const res = await get(served.url, "/src");
    expect(res.status).toBe(301);
    expect(res.location).toBe("/src/");
  });

  it("refuses to write", async () => {
    const status = await new Promise<number>((done) => {
      const req = request(new URL(served.url), { method: "POST", path: "/src/a.ts" }, (res) =>
        done(res.statusCode ?? 0),
      );
      req.end();
    });
    expect(status).toBe(405);
  });
});

describe("serve: live reload", () => {
  /** Opens the event stream for a page and collects what arrives within `ms`. */
  function listen(url: string, page: string, since: number, ms: number): Promise<string> {
    return new Promise((done) => {
      let text = "";
      const path = `/.prose/events?path=${encodeURIComponent(page)}&since=${since}`;
      const req = request(new URL(url), { path }, (res) => {
        res.setEncoding("utf-8");
        res.on("data", (chunk: string) => (text += chunk));
      });
      req.end();
      setTimeout(() => {
        req.destroy();
        done(text);
      }, ms);
    });
  }

  it("tells a page when something it shows changes, and not otherwise", () => {
    expect(touches("src/a.ts", "src/a.ts")).toBe(true);
    expect(touches("src/a.ts", "src/")).toBe(true);
    expect(touches("src/a.ts", "")).toBe(true);
    expect(touches("src/b.ts", "src/a.ts")).toBe(false);
    expect(touches("docs/plan.md", "src/")).toBe(false);
  });

  it("catches a page up on a change it missed while it wasn't listening", async () => {
    const root = mkdtempSync(join(tmpdir(), "prose-reload-test-"));
    writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "b.ts"), "export const b = 1;\n");
    const served = await serve(root, { port: 0 });
    try {
      // macOS can report the two files' creation late; let that settle before the page renders.
      await new Promise((r) => setTimeout(r, 500));
      const renderedAt = Date.now();
      await new Promise((r) => setTimeout(r, 50));
      writeFileSync(join(root, "a.ts"), "export const a = 2;\n");
      await new Promise((r) => setTimeout(r, 300));
      expect(await listen(served.url, "a.ts", renderedAt, 200)).toContain("data: reload");
      expect(await listen(served.url, "b.ts", renderedAt, 200)).not.toContain("data: reload");
      expect(await listen(served.url, "a.ts", Date.now(), 200)).not.toContain("data: reload");
    } finally {
      await served.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
