import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { blameFile, newestTime } from "./git.js";

let root: string;

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

function git(...args: string[]): void {
	execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

describe("blameFile", () => {
	it("returns null for a file with no git repo above it", () => {
		root = mkdtempSync(join(tmpdir(), "prose-git-test-"));
		writeFileSync(join(root, "a.js"), "const a = 1;\n");
		expect(blameFile(root, "a.js")).toBeNull();
	});

	it("reads a committed line's real timestamp, and treats an uncommitted line as newest", () => {
		root = mkdtempSync(join(tmpdir(), "prose-git-test-"));
		git("init", "-q");
		git("config", "user.email", "test@example.com");
		git("config", "user.name", "Test");
		writeFileSync(join(root, "a.js"), "const a = 1;\nconst b = 2;\n");
		git("add", "a.js");
		git("commit", "-q", "-m", "initial");

		writeFileSync(join(root, "a.js"), "const a = 1;\nconst b = 2;\nconst c = 3;\n");

		const blame = blameFile(root, "a.js");
		expect(blame).not.toBeNull();
		expect(blame).toHaveLength(3);
		// The two committed lines share one real, finite timestamp.
		expect(blame![0]!.time).toBe(blame![1]!.time);
		expect(Number.isFinite(blame![0]!.time)).toBe(true);
		// The uncommitted third line counts as newest (spec §5.2).
		expect(blame![2]!.time).toBe(Number.POSITIVE_INFINITY);
		expect(newestTime(blame!, 1, 2)).toBe(blame![0]!.time);
		expect(newestTime(blame!, 1, 3)).toBe(Number.POSITIVE_INFINITY);
	});

	it("newestTime returns 0 for a line range with no blame data", () => {
		expect(newestTime([{ line: 5, time: 100 }], 1, 2)).toBe(0);
	});
});
