#!/usr/bin/env node
/** @prose
 * # `prose [dir]`
 *
 * The command. `prose` serves a repository and opens it in the browser. `prose build` writes the
 * same pages as static files, for any host to serve. `prose check` fails on what the text gets
 * wrong, so CI can stop a merge ([warnings.ts](warnings.ts)). There's no config.
 *
 * `prose style` gives advice on how the files just written read, and always passes
 * ([style.ts](style.ts)). `prose rules` prints the rules both read for, from the docs this version
 * shipped with ([rules.ts](rules.ts)). `prose outline` writes the repository's map for agents
 * ([outline.ts](outline.ts)). `prose help` prints the commands from the same docs, where
 * each is stated once, and a test holds each command below to it.
 *
 * `check` and `style` read the working tree, as `prose .` does, not the commit a build publishes.
 * So `check` never warns about uncommitted changes, or about where a build would go. `check` always
 * ends with how many files it read, and how many `.gitattributes` left out. A skip is never
 * silent, and a wrong folder doesn't pass as clean. Before that, both count what they found by
 * code, so a reader sees the shape of a long list without tallying it. Then a line names
 * `prose rules <code>`, so an agent that meets a code learns where its rule is.
 *
 * The flags are only the few a person would reach for. They set the port, skip opening the
 * browser, and say where a build goes ([build.ts](build.ts)). What each page shows is in
 * [reading](../docs/reading.md).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build } from "./build.js";
import { finding, printHelp, printOne, printRules } from "@amitkaps/markz/rules";
import { OUTLINE, writeOutline } from "./outline.js";
import { proseCommands, sets } from "./rules.js";
import { serve } from "./server.js";
import { styleAdvice } from "./style.js";
import { projectFiles } from "./tree.js";
import { checkedCount, contentWarnings, formatWarning, type Warning } from "./warnings.js";

const help = (): string => printHelp(proseCommands())!;

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  };
  return pkg.version;
}

/** `prose: warning: docs/x.md:3:5: reference-link: …`, on stderr. */
function report(w: Warning): void {
  process.stderr.write(`${formatWarning(w)}\n`);
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** `prose: by code: joining-semicolon 3, joining-colon 1`, most first, so a long list reads at a
 *  glance without counting it. One finding needs no summary. */
function byCode(found: Warning<string>[]): string {
  if (found.length < 2) return "";
  const counts = new Map<string, number>();
  for (const w of found) counts.set(w.code, (counts.get(w.code) ?? 0) + 1);
  const ranked = [...counts].sort(([a, m], [b, n]) => n - m || a.localeCompare(b));
  return `prose: by code: ${ranked.map(([code, n]) => `${code} ${n}`).join(", ")}\n`;
}

const RULES = "prose: `prose rules <code>` says what a code asks for\n";

/** @prose
 * # `prose style`
 *
 * Advice on the files or folders named, relative to where it runs, or on every file with none.
 * It's printed to stdout, since it's what was asked for, and it always exits 0.
 *
 * It ends with how many files it read, as `prose check` does. A path that holds nothing prose
 * reads is named, so a typo isn't mistaken for clean text.
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
  for (const a of advice) process.stdout.write(`${formatWarning(a, "note")}\n`);
  process.stdout.write(byCode(advice));
  if (advice.length) process.stdout.write(RULES);
  const read = readCount(root, [...files], "read");
  const where = new Set(advice.map((a) => a.path)).size;
  process.stdout.write(
    advice.length
      ? `prose: ${count(advice.length, "suggestion")} in ${count(where, "file")}, of ${read}\n`
      : `prose: no suggestions, of ${read}\n`,
  );
}

/** How many files a command read, and how many `.gitattributes` left out, so a skip is never
 *  silent. */
function readCount(root: string, files: string[], verb: string): string {
  const { checked, left } = checkedCount(root, files);
  return `${count(checked, "file")} ${verb}${left ? `, ${left} left out by .gitattributes` : ""}`;
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
    if (paths.some((a) => a === "-h" || a === "--help")) return void process.stdout.write(help());
    return style(paths);
  }
  if (argv[0] === "help") {
    const [name, ...rest] = argv.slice(1);
    const printed = rest.length ? undefined : printHelp(proseCommands(), name);
    if (printed === undefined)
      throw new Error(`prose has no command \`${argv.slice(1).join(" ")}\``);
    return void process.stdout.write(printed);
  }
  if (argv[0] === "outline") {
    const [given, ...rest] = argv.slice(1);
    if (given === "-h" || given === "--help") return void process.stdout.write(help());
    if (rest.length || given?.startsWith("-"))
      throw new Error(`prose outline takes one folder\n\n${help()}`);
    const files = writeOutline(resolve(given ?? "."));
    return void process.stdout.write(`prose: ${count(files, "file")} in ${OUTLINE}\n`);
  }
  if (argv[0] === "rules") {
    const [code, ...rest] = argv.slice(1);
    if (code === "-h" || code === "--help") return void process.stdout.write(help());
    if (rest.length || code?.startsWith("-"))
      throw new Error(`prose rules takes one code\n\n${help()}`);
    const printed = code ? printOne(sets, code) : printRules(sets);
    if (printed === undefined) throw new Error(`prose and markz state no \`${code}\``);
    return void process.stdout.write(printed);
  }
  const command = argv[0] === "build" || argv[0] === "check" ? argv[0] : null;
  const building = command === "build";
  if (command) argv = argv.slice(1);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") return void process.stdout.write(help());
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
    } else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}\n\n${help()}`);
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
    const files = projectFiles(root);
    const warnings = contentWarnings(root, files);
    warnings.forEach(report);
    const read = readCount(root, files, "checked");
    if (warnings.length) {
      // A folder's warning, like a missing README, is on its path with a trailing slash.
      const paths = [...new Set(warnings.map((w) => w.path))];
      const folders = paths.filter((p) => p?.endsWith("/")).length;
      const where = [
        paths.length - folders ? count(paths.length - folders, "file") : "",
        folders ? count(folders, "folder") : "",
      ]
        .filter(Boolean)
        .join(" and ");
      process.stderr.write(byCode(warnings) + RULES);
      process.stderr.write(`prose: ${count(warnings.length, "warning")} in ${where}, of ${read}\n`);
      process.exitCode = 1;
    } else process.stdout.write(`prose: ${read}\n`);
    return;
  }
  const served = await serve(resolve(dir), { port });
  process.stdout.write(`prose: ${resolve(dir)}\n  ${served.url}\n`);
  if (open) openBrowser(served.url);
}

// A reader that stops early, like `| head`, closes the pipe. That's done, not a crash.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw error;
});

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${finding({ tool: "prose", level: "error", message })}\n`);
  process.exit(1);
});
