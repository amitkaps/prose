/** @prose
 * # Highlighter tests
 *
 * The HTML the highlighter writes, and cases in each language with the colours shiki gave them.
 *
 * The cases were taken from a comparison with shiki, before shiki went
 * ([lessons](../docs/lessons.md#rendering)). Each lists its coloured runs, one per line as
 * `colour text`, and everything else is plain. So the highlighter keeps colouring code as shiki
 * did, without shiki. A change that breaks one should be a deliberate choice, made here.
 */

import { describe, expect, it } from "vite-plus/test";
import { parse } from "@amitkaps/markz";
import { highlight, langFor, markdownHtml } from "../src/highlight.js";

function unescape(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** The coloured runs of `code` as highlighted: each stretch of one colour, split at whitespace. */
function colours(code: string, lang: string): string {
  const html = highlight(code, lang).replace(/^<pre[^>]*><code>|<\/code><\/pre>$/g, "");
  const runs: string[] = [];
  for (const line of html.split("\n")) {
    const inner = line.replace(/^<span class="line">|<\/span>$/g, "");
    for (const [, colour, text, plain] of inner.matchAll(
      /<span class="(\w+)">([^<]*)<\/span>|([^<]+)/g,
    )) {
      if (plain !== undefined) {
        runs.push(" ");
        continue;
      }
      for (const word of unescape(text!).split(/(\s+)/)) {
        if (/^\s+$/.test(word)) runs.push(" ");
        else if (word && runs.at(-1)?.startsWith(`${colour} `) && runs.at(-1) !== " ") {
          runs[runs.length - 1] += word;
        } else if (word) runs.push(`${colour} ${word}`);
      }
    }
    runs.push(" ");
  }
  return "\n" + runs.filter((r) => r !== " ").join("\n") + "\n";
}

const CASES: { name: string; lang: string; code: string; colours: string }[] = [
  {
    name: "imports, constants and a doc comment",
    lang: "ts",
    code: `/** @prose
 * # Assets
 */
import { createHash } from "node:crypto";
import type { Site } from "./server.js";

const LIMIT = 2000;
export const STYLE = asset("style", "css");`,
    colours: `
comment /**
keyword @prose
comment *
comment #
comment Assets
comment */
keyword import
keyword from
string "node:crypto"
keyword import
keyword type
keyword from
string "./server.js"
keyword const
constant LIMIT
keyword =
constant 2000
keyword export
keyword const
constant STYLE
keyword =
function asset
string "style"
punctuation ,
string "css"
`,
  },
  {
    name: "functions, arrows and destructuring",
    lang: "ts",
    code: `export function render(node: TreeNode, depth = 0): string {
  const { path, children } = node;
  const label = (name: string): string => name.trim();
  if (!children.length) return label(path);
  return children.map((child) => render(child, depth + 1)).join("\\n");
}`,
    colours: `
keyword export
keyword function
function render
keyword :
function TreeNode
punctuation ,
keyword =
constant 0
keyword :
constant string
keyword const
constant path
punctuation ,
constant children
keyword =
keyword const
function label
keyword =
keyword :
constant string
keyword :
constant string
keyword =>
constant name
function .trim
keyword if
keyword !
constant children
constant length
keyword return
function label
keyword return
constant children
function .map
keyword =>
function render
punctuation ,
keyword +
constant 1
function .join
string "\\n"
`,
  },
  {
    name: "classes, generics and optional access",
    lang: "ts",
    code: `class Changes {
  readonly listeners = new Set<Listener>();
  private log: { path: string; at: number }[] = [];

  add(path: string): void {
    this.log.push({ path, at: Date.now() });
    for (const listener of this.listeners) listener?.res.write("data: reload\\n\\n");
  }
}`,
    colours: `
keyword class
function Changes
keyword readonly
keyword =
keyword new
function Set
function Listener
keyword private
keyword :
keyword :
constant string
keyword :
constant number
keyword =
function add
keyword :
constant string
keyword :
constant void
constant this
function .
constant log
function .push
punctuation ,
keyword :
constant Date
function .now
keyword for
keyword const
constant listener
keyword of
constant this
constant listener
function ?.
constant res
function .write
string "data:
string reload\\n\\n"
`,
  },
  {
    name: "templates and regexes",
    lang: "ts",
    code: `const html = \`<a href="\${href}">\${escapeHtml(name)}</a>\`;
const id = text.replace(/^#{1,6}\\s+/, "").toLowerCase();
const parts = [...items, ...more];`,
    colours: `
keyword const
constant html
keyword =
string \`<a
string href="
keyword \${
keyword }
string ">
keyword \${
function escapeHtml
keyword }
string </a>\`
keyword const
constant id
keyword =
constant text
function .replace
string /
keyword ^
string #
keyword {1,6}
string \\s
keyword +
string /
punctuation ,
string ""
function .toLowerCase
keyword const
constant parts
keyword =
keyword ...
punctuation ,
keyword ...
`,
  },
  {
    name: "a browser script",
    lang: "js",
    code: `{
  const root = document.documentElement;
  const runs = [...document.querySelectorAll(".code")];
  for (const run of runs) {
    run.querySelector(".code-head").addEventListener("click", () => {
      run.classList.toggle(root.classList.contains("prose-only") ? "opened" : "closed");
    });
  }
}`,
    colours: `
keyword const
constant root
keyword =
constant document
keyword const
constant runs
keyword =
keyword ...
constant document
function .querySelectorAll
string ".code"
keyword for
keyword const
constant run
keyword of
constant run
function .querySelector
string ".code-head"
function .addEventListener
string "click"
punctuation ,
keyword =>
constant run
function .
constant classList
function .toggle
constant root
function .
constant classList
function .contains
string "prose-only"
keyword ?
string "opened"
keyword :
string "closed"
`,
  },
  {
    name: "rules, selectors and values",
    lang: "css",
    code: `/* The bar */
:root {
  --bar: 3.25rem;
  --ink: #1f2328;
}
.rail [aria-current="page"],
.code pre > .line::before {
  color: var(--muted);
  padding: 0.5rem calc(var(--side) * 2);
  font-weight: 600 !important;
}`,
    colours: `
comment /*
comment The
comment bar
comment */
function :root
keyword :
constant 3.25
keyword rem
keyword :
constant #1f2328
function .rail
function aria-current
keyword =
string "page"
punctuation ,
function .code
string pre
keyword >
function .line::before
constant color
keyword :
function var
constant (--muted)
constant padding
keyword :
constant 0.5
keyword rem
function calc
constant (
function var
constant (--side)
keyword *
constant 2)
constant font-weight
keyword :
constant 600
keyword !important
`,
  },
  {
    name: "an at-rule",
    lang: "css",
    code: `@media (max-width: 62rem) {
  .rail {
    position: fixed;
    transition: opacity 0.12s ease-out;
  }
}`,
    colours: `
keyword @media
constant max-width
keyword :
constant 62
keyword rem
function .rail
constant position
keyword :
constant fixed
constant transition
keyword :
constant opacity
constant 0.12
keyword s
constant ease-out
`,
  },
  {
    name: "a page",
    lang: "html",
    code: `<!doctype html>
<html lang="en">
  <!-- The frame -->
  <head>
    <link rel="stylesheet" href="/assets/style.css" />
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body data-path="src/a.ts">
    <script>
      const key = "prose:mode";
    </script>
  </body>
</html>`,
    colours: `
string doctype
function html
string html
function lang
keyword =
string "en"
comment <!--
comment The
comment frame
comment -->
string head
string link
function rel
keyword =
string "stylesheet"
function href
keyword =
string "/assets/style.css"
string style
string body
constant margin
keyword :
constant 0
string style
string head
string body
function data-path
keyword =
string "src/a.ts"
string script
keyword const
constant key
keyword =
string "prose:mode"
string script
string body
string html
`,
  },
  {
    name: "a component",
    lang: "svelte",
    code: `<script lang="ts">
  let { count = 0 }: { count?: number } = $props();
</script>

<button class="btn" onclick={() => count++}>
  {count}
</button>
{#if count > 3}
  <p>Big</p>
{/if}`,
    colours: `
string script
function lang
keyword =
string "ts"
keyword let
keyword =
constant 0
keyword :
keyword ?:
constant number
keyword =
function props
string script
string button
function class
keyword =
string "btn"
function onclick
keyword =
keyword =>
keyword ++
string button
keyword if
keyword >
constant 3
string p
string p
keyword if
`,
  },
  {
    name: "a workflow",
    lang: "yaml",
    code: `# Checks every pull request.
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - run: |
          pnpm install
          pnpm run test`,
    colours: `
comment #
comment Checks
comment every
comment pull
comment request.
keyword name:
string ci
constant on
keyword :
keyword pull_request:
keyword push:
keyword branches:
string main
keyword jobs:
keyword test:
keyword runs-on:
string ubuntu-latest
keyword timeout-minutes:
constant 10
keyword steps:
keyword uses:
string actions/checkout@v5
keyword run:
keyword |
string pnpm
string install
string pnpm
string run
string test
`,
  },
  {
    name: "a manifest",
    lang: "json",
    code: `{
  "name": "@amitkaps/prose",
  "version": "0.3.0",
  "private": false,
  "files": ["dist"],
  "engines": { "node": ">=24" }
}`,
    colours: `
keyword "name"
punctuation :
string "@amitkaps/prose"
punctuation ,
keyword "version"
punctuation :
string "0.3.0"
punctuation ,
keyword "private"
punctuation :
constant false
punctuation ,
keyword "files"
punctuation :
string "dist"
punctuation ,
keyword "engines"
punctuation :
keyword "node"
punctuation :
string ">=24"
`,
  },
  {
    name: "a config",
    lang: "toml",
    code: `# The site
name = "prose"
compatibility_date = "2026-10-01"

[assets]
directory = ".prose"
html_handling = "auto-trailing-slash"`,
    colours: `
comment #
comment The
comment site
keyword =
string "prose"
keyword =
string "2026-10-01"
keyword =
string ".prose"
keyword =
string "auto-trailing-slash"
`,
  },
  {
    name: "a doc",
    lang: "md",
    code: `# Usage

Install it, then read a repository with **prose**. See [writing](writing.md) for _the rules_.

- Run \`prose .\` in a folder.
- Build with \`prose build\`.

\`\`\`ts
const site = build(".");
\`\`\``,
    colours: `
strong #
strong Usage
strong **prose**
link [
keyword writing
link ](writing.md)
emphasis _the
emphasis rules_
string \`prose
string .\`
string \`prose
string build\`
string \`\`\`ts
keyword const
constant site
keyword =
function build
string "."
string \`\`\`
`,
  },
  {
    name: "a script",
    lang: "sh",
    code: `#!/usr/bin/env bash
# Build and test
for f in src/*.ts; do
  if [ -f "$f" ]; then
    echo "checking $f" | tail -1
  fi
done
pnpm run build > /dev/null 2>&1 || exit 1`,
    colours: `
comment #!/usr/bin/env
comment bash
comment #
comment Build
comment and
comment test
keyword for
keyword in
string src/*.ts
keyword do
keyword if
keyword -f
string "$f"
keyword then
function echo
string "checking
string $f"
keyword |
function tail
string -1
keyword fi
keyword done
function pnpm
string run
string build
keyword >
string /dev/null
keyword 2>&1
keyword ||
function exit
constant 1
`,
  },
];

describe("highlight: colours, as shiki gave them", () => {
  it.each(CASES)("$lang: $name", ({ code, lang, colours: want }) => {
    expect(colours(code, lang)).toBe(want);
  });
});

describe("highlight: the HTML", () => {
  it("writes one line span per line, and splits a token that spans lines", () => {
    expect(highlight("/* a\nb */\nx", "ts")).toBe(
      '<pre class="highlighted"><code><span class="line"><span class="comment">/* a</span></span>\n' +
        '<span class="line"><span class="comment">b */</span></span>\n<span class="line">x</span></code></pre>',
    );
  });

  it("escapes the code, and reads an unknown language as plain text", () => {
    expect(langFor("py")).toBe("text");
    expect(highlight("<a> & b", "py")).toContain('<span class="line">&lt;a&gt; &amp; b</span>');
  });

  it("colours EBNF, which shiki lacked, and `.gitignore`, which it left plain", () => {
    expect(highlight("digit ::= [0-9]", "ebnf")).toContain('<span class="constant">[0-9]</span>');
    expect(highlight("# built\n!keep", "gitignore")).toContain(
      '<span class="comment"># built</span>',
    );
  });
});

describe("markdownHtml", () => {
  const doc = [
    "```ts",
    'let a = "x";',
    "```",
    "",
    "- item",
    "",
    "  ```css",
    "  a {}",
    "  ```",
    "",
    "```=html",
    "<pre><code>raw</code></pre>",
    "```",
    "",
    "$$",
    "x^2",
    "$$",
    "",
  ].join("\n");
  const out = markdownHtml(parse(doc));

  it("highlights each fence, wherever it sits", () => {
    expect(out).toContain('<span class="string">&quot;x&quot;</span>');
    expect(out).toContain('<span class="string">a</span> {}');
    expect(out.match(/<pre class="highlighted" data-lang="/g)).toHaveLength(2);
  });

  it("names a fence's language as written, and none for a fence without one", () => {
    expect(out).toContain('<pre class="highlighted" data-lang="ts">');
    expect(markdownHtml(parse("```\nplain\n```\n"))).toContain('<pre class="highlighted"><code>');
  });

  it("leaves raw HTML and display math as markz wrote them", () => {
    expect(out).toContain("<pre><code>raw</code></pre>");
    expect(out).toContain('<pre><code class="language-math math-display">x^2');
  });
});
