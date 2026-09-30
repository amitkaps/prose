#!/usr/bin/env node
/** @prose
 * # `prose [dir]`
 *
 * The command: serve a repository and open it in the browser (spec §4). No config, and only
 * the few flags a person would reach for: a port, and not opening the browser.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "./server.js";

const HELP = `Usage: prose [dir] [options]

Open a repository in the browser as a Markdown-first document. Read-only.

Options:
  --port <n>   Port to try first (default 1234; the next free one if taken)
  --no-open    Don't open the browser
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
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === "-h" || arg === "--help") return void process.stdout.write(HELP);
		if (arg === "-v" || arg === "--version") return void process.stdout.write(`${version()}\n`);
		if (arg === "--no-open") open = false;
		else if (arg === "--port" || arg.startsWith("--port=")) {
			const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
			port = Number(value);
			if (!Number.isInteger(port) || port < 0 || port > 65535) {
				throw new Error(`--port needs a number from 0 to 65535, not ${value ?? "nothing"}`);
			}
		} else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}\n\n${HELP}`);
		else dir = arg;
	}
	const served = await serve(resolve(dir), { port });
	process.stdout.write(`prose: ${resolve(dir)}\n  ${served.url}\n`);
	if (open) openBrowser(served.url);
}

main(process.argv.slice(2)).catch((error: unknown) => {
	process.stderr.write(`prose: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
