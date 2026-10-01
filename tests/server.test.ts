/** @prose
 * # Server tests
 *
 * `prose serve` ([spec](../docs/spec.md#pages)): route segments, the `tests/fixtures/simple` pages, folder pages, path traversal
 * refused, and live reload. Requests go out raw so a path like `/../x` arrives as written.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { segments } from "../src/render.js";
import { serve, type Served, touches } from "../src/server.js";
import type { TreeNode } from "../src/tree.js";

/** A raw GET, so a path like `/../x` reaches the server as written instead of being normalized. */
function get(
  url: string,
  path: string,
): Promise<{ status: number; body: string; location?: string }> {
  return new Promise((done, fail) => {
    const req = request(new URL(url), { path, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () =>
        done({ status: res.statusCode ?? 0, body, location: res.headers.location }),
      );
    });
    req.on("error", fail);
    req.end();
  });
}

describe("segments", () => {
  it("lays a file out as code runs around its blocks, dropping the comment text", () => {
    const source = "/** @prose A. */\nimport x;\n\n/** @prose B. */\n\nconst b = 1;\n";
    const block = (start: number, end: number): TreeNode => ({
      name: "",
      kind: "chunk",
      path: "f.ts#x",
      summary: "",
      span: [start, end],
      children: [],
    });
    const a = source.indexOf("/** @prose A. */");
    const b = source.indexOf("/** @prose B. */");
    const parts = segments(source, [block(b, b + 16), block(a, a + 16)]);
    expect(parts.map((p) => (p.kind === "code" ? [p.text, p.line] : "block"))).toEqual([
      "block",
      ["import x;", 2],
      "block",
      ["const b = 1;", 6],
    ]);
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
    expect(body).toContain('href="main.js"');
    expect(body).toContain("holds the count, applies a step");
  });

  it("renders a source file as one document: blocks by anchor, code numbered from its file line, pending marked", async () => {
    const { status, body } = await get(served.url, "/main.js");
    expect(status).toBe(200);
    expect(body).toContain('id="file"');
    // A block that opens with a heading is named by it, and its `#` sits inside that heading.
    expect(body).toContain(
      'id="state"><div class="prose"><h1><a class="anchor" href="#state" aria-label="Link to this block">#</a>',
    );
    expect(body).not.toContain('href="#file"');
    expect(body).toContain('id="input"');
    expect(body).toMatch(/class="block pending" id="persistence"/);
    // The State chunk's code starts on line 12 of main.js, so the gutter counts on from 11.
    expect(body).toMatch(/<div class="code" style="counter-reset: line 11;/);
    expect(body).toContain('data-mode="prose"');
    expect(body).toContain('class="code-head"');
    expect(body).not.toContain("#file L");
    expect(body).not.toContain("@prose");
  });

  it("renders CSS and HTML files the same way", async () => {
    expect((await get(served.url, "/style.css")).body).toContain('class="block');
    expect((await get(served.url, "/index.html")).body).toContain('class="block');
  });

  it("renders a Markdown file with markz, the switch there but disabled", async () => {
    const { status, body } = await get(served.url, "/README.md");
    expect(status).toBe(200);
    expect(body).toContain('<div class="prose"><h1');
    expect(body).toContain('data-mode="prose" aria-pressed="false" disabled');
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

  it("lists a folder's files with their summaries, and marks the undocumented", async () => {
    const { body } = await get(served.url, "/src/");
    expect(body).toContain("The source.");
    expect(body).toContain("Does a.");
    expect(body).toMatch(/b\.ts<\/a><p><span class="undocumented">undocumented/);
  });

  it("shows a file with no prose as one run with the same header, and says so", async () => {
    const { body } = await get(served.url, "/src/b.ts");
    expect(body).toContain('<p class="no-prose">No prose in this file.</p><div class="code"');
    expect(body).toContain('class="code-head"');
    expect(body).not.toContain('data-mode="prose" aria-pressed="false" disabled');
  });

  it("shows docs/ as an ordinary folder on the project page", async () => {
    const { body } = await get(served.url, "/");
    expect(body).toContain('href="docs/"');
    expect(body).toContain('href="src/"');
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
      /<ul><li><a class="file" style="--depth: 1" href="\/src\/">README.md<\/a>/,
    );
    expect(rail).not.toContain('href="/src/README.md"');
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
