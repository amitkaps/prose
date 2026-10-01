#!/usr/bin/env node
/** @prose
 * # `prose [dir]`
 *
 * The command: serve a repository and open it in the browser; as `prose build`, write the same
 * pages for a static host; as `prose publish`, commit them to a branch a host deploys from. No
 * config, and only the few flags a person would reach for.
 *
 * What each does is in [reading](../docs/reading.md); the flags are a port, not opening the
 * browser, where a build goes, and a published site's branch (`build.ts`, `publish.ts`).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "./build.js";
import { publish } from "./publish.js";
import { serve } from "./server.js";

const HELP = `Usage: prose [dir] [options]
       prose build [dir] [--out <dir>]
       prose publish [dir] [--branch <name>]

Open a repository in the browser as a Markdown-first document. Read-only.
\`prose build\` writes the same pages as a static site, from the last commit.
\`prose publish\` commits that site to a branch for a host to serve; it doesn't push.

Options:
  --port <n>   Port to try first (default 1234; the next free one if taken)
  --no-open    Don't open the browser
  --out <dir>  Where \`prose build\` writes (default .prose/site)
  --branch <name>  The branch \`prose publish\` commits to (default prose)
  -h, --help   Show this help
  -v, --version
`;

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  };
  return pkg.version;
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
  let branch: string | undefined;
  const command = argv[0] === "build" || argv[0] === "publish" ? argv[0] : null;
  const building = command === "build";
  const publishing = command === "publish";
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
    } else if (publishing && (arg === "--branch" || arg.startsWith("--branch="))) {
      branch = value();
      if (!branch) throw new Error("--branch needs a name");
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
    for (const warning of built.warnings) process.stderr.write(`prose: warning: ${warning}\n`);
    process.stdout.write(`prose: ${built.pages} pages from ${built.version}\n  ${built.out}\n`);
    return;
  }
  if (publishing) {
    const done = await publish(dir, { branch });
    for (const warning of done.built.warnings) process.stderr.write(`prose: warning: ${warning}\n`);
    process.stdout.write(
      done.changed
        ? `prose: published ${done.built.version} to ${done.branch} (${done.commit.slice(0, 7)})\n  git push origin ${done.branch}\n`
        : `prose: ${done.branch} already has these pages (${done.commit.slice(0, 7)})\n`,
    );
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
