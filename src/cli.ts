#!/usr/bin/env node
/** @prose
 * # `prose [dir]`
 *
 * The command. `prose` serves a repository and opens it in the browser. `prose build` writes the
 * same pages as static files, for any host to serve. `prose check` fails on what the text gets
 * wrong, so CI can stop a merge ([warnings.ts](warnings.ts)). There's no config.
 *
 * `prose style` gives advice on how the files just written read, and always passes
 * ([style.ts](style.ts)).
 *
 * `check` and `style` read the working tree, as `prose .` does, not the commit a build publishes.
 * So `check` never warns about uncommitted changes, or about where a build would go.
 *
 * The flags are only the few a person would reach for. They set the port, skip opening the
 * browser, and say where a build goes ([build.ts](build.ts)). What each page shows is in
 * [reading](../docs/reading.md).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build } from "./build.js";
import { serve } from "./server.js";
import { styleAdvice } from "./style.js";
import { projectFiles } from "./tree.js";
import { contentWarnings, formatWarning, type Warning } from "./warnings.js";

const HELP = `Usage: prose [dir] [options]
       prose build [dir] [--out <dir>]
       prose check [dir]
       prose style [path ...]

Open a repository in the browser as a Markdown-first document. Read-only.
\`prose build\` writes the same pages as a static site, from the last commit.
\`prose check\` prints what the text gets wrong, and fails if it finds anything.
\`prose style\` gives advice on how the files you name read, and always passes.

Options:
  --port <n>   Port to try first (default 1234; the next free one if taken)
  --no-open    Don't open the browser
  --out <dir>  Where \`prose build\` writes (default .prose)
  -h, --help   Show this help
  -v, --version
`;

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  };
  return pkg.version;
}

/** `prose: warning: docs/x.md:3:5: reference-link: …`, on stderr. */
function report(w: Warning): void {
  process.stderr.write(`prose: warning: ${formatWarning(w)}\n`);
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** @prose
 * ## `prose style`
 *
 * Advice on the files or folders named, relative to where it runs, or on every file with none.
 * It's printed to stdout, since it's what was asked for, and it always exits 0. A path that holds
 * nothing prose reads is named, so a typo isn't mistaken for clean text.
 */
function style(paths: string[]): void {
  const root = resolve(".");
  const all = projectFiles(root);
  const files = new Set<string>();
  for (const given of paths.length ? paths : ["."]) {
    const path = relative(root, resolve(given)).replace(/\\/g, "/");
    const found = all.filter((f) => !path || f === path || f.startsWith(`${path}/`));
    if (found.length === 0) process.stderr.write(`prose: ${given}: no file prose reads\n`);
    for (const f of found) files.add(f);
  }
  const advice = styleAdvice(root, [...files].sort());
  for (const a of advice) process.stdout.write(`prose: style: ${formatWarning(a)}\n`);
  if (advice.length) {
    const where = new Set(advice.map((a) => a.path)).size;
    process.stdout.write(
      `prose: ${count(advice.length, "suggestion")} in ${count(where, "file")}\n`,
    );
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { stdio: "ignore", detached: true })
      .on("error", () => {})
      .unref();
  } catch {
    // No browser to open is fine: the URL is printed.
  }
}

async function main(argv: string[]): Promise<void> {
  let dir = ".";
  let port = 1234;
  let open = true;
  let out: string | undefined;
  if (argv[0] === "style") {
    const paths = argv.slice(1);
    if (paths.some((a) => a === "-h" || a === "--help")) return void process.stdout.write(HELP);
    return style(paths);
  }
  const command = argv[0] === "build" || argv[0] === "check" ? argv[0] : null;
  const building = command === "build";
  if (command) argv = argv.slice(1);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") return void process.stdout.write(HELP);
    if (arg === "-v" || arg === "--version") return void process.stdout.write(`${version()}\n`);
    const value = () => (arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i]);
    if (arg === "--no-open") open = false;
    else if (building && (arg === "--out" || arg.startsWith("--out="))) {
      out = value();
      if (!out) throw new Error("--out needs a folder");
    } else if (arg === "--port" || arg.startsWith("--port=")) {
      const given = value();
      port = Number(given);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`--port needs a number from 0 to 65535, not ${given ?? "nothing"}`);
      }
    } else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}\n\n${HELP}`);
    else dir = arg;
  }
  if (building) {
    const built = await build(dir, { out });
    built.warnings.forEach(report);
    process.stdout.write(`prose: ${built.pages} pages from ${built.version}\n  ${built.out}\n`);
    return;
  }
  if (command === "check") {
    const root = resolve(dir);
    const warnings = contentWarnings(root, projectFiles(root));
    warnings.forEach(report);
    if (warnings.length) {
      const files = new Set(warnings.map((w) => w.path)).size;
      process.stderr.write(
        `prose: ${count(warnings.length, "warning")} in ${count(files, "file")}\n`,
      );
      process.exitCode = 1;
    }
    return;
  }
  const served = await serve(resolve(dir), { port });
  process.stdout.write(`prose: ${resolve(dir)}\n  ${served.url}\n`);
  if (open) openBrowser(served.url);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`prose: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
