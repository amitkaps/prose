import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { stripProseHtml } from "./plugin.js";

describe("stripProseHtml (spec §6.4)", () => {
	it("removes every @prose comment and its own line, leaving unmarked markup untouched", () => {
		const source = readFileSync(join(__dirname, "..", "examples", "single", "index.html"), "utf-8");
		const stripped = stripProseHtml(source);
		expect(stripped).not.toContain("@prose");
		expect(stripped).not.toContain("The counter's only page");
		expect(stripped).toContain("<title>Counter</title>");
		expect(stripped).toContain('<output id="count" aria-live="polite">0</output>');
		expect(stripped).toContain('<script type="module" src="/main.js"></script>');
	});

	it("leaves an unmarked HTML comment alone", () => {
		const source = "<!-- just a note for readers -->\n<div>hi</div>\n";
		expect(stripProseHtml(source)).toBe(source);
	});

	it("also strips an unresolved @note comment, not just @prose", () => {
		const source = ["<!-- @prose File. -->", "<!-- @note Fix this? -->", "<h1>hi</h1>", ""].join(
			"\n",
		);
		const stripped = stripProseHtml(source);
		expect(stripped).toBe("<h1>hi</h1>\n");
	});

	it("leaves no blank line behind where a removed comment sat", () => {
		const source = "<div>\n\t<!-- @prose A chunk. -->\n\t<h1>hi</h1>\n</div>\n";
		const stripped = stripProseHtml(source);
		expect(stripped).toBe("<div>\n\t<h1>hi</h1>\n</div>\n");
	});
});
