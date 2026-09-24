// Guards against the class of bug fixed in commit 24e1417: `new URL(<literal>, import.meta.url)`
// is specially intercepted by Vite's build as a static-asset reference and resolved at build
// time, not runtime — which once silently inlined an unrelated file as a base64 data: URL. That
// bug built cleanly and passed every Node-based check; only inspecting the actual bundle catches
// it, so this runs as part of `pnpm build`, after the client SPA is built.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(import.meta.dirname, "..", "client", "dist", "assets");
const offenders = [];

for (const file of readdirSync(assetsDir)) {
	if (!file.endsWith(".js")) continue;
	const contents = readFileSync(join(assetsDir, file), "utf-8");
	if (contents.includes("data:text/javascript")) offenders.push(file);
}

if (offenders.length > 0) {
	console.error(
		`[check-client-bundle] Found inlined data:text/javascript in: ${offenders.join(", ")}`,
	);
	console.error(
		"This usually means a `new URL(<literal>, import.meta.url)` call got statically resolved " +
			"at build time instead of staying a runtime URL join. See docs/lessons.md.",
	);
	process.exit(1);
}

console.log(
	`[check-client-bundle] OK — no stray data:text/javascript in ${readdirSync(assetsDir).length} assets.`,
);
