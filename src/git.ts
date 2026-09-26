/** @prose
 * # Reading git blame for the staleness check
 *
 * Spec §5.2 compares a chunk's newest *code* line against its newest *prose* line, using
 * `git blame`'s per-line commit timestamps. `git blame --porcelain` is the one format that gives
 * both a full timestamp and a stable "uncommitted" marker (the all-zero SHA) without needing a
 * second `git log` call, so this module's whole job is turning that text format into
 * `{ line, time }` pairs — nothing here decides what's stale, that's `checks.ts`.
 */
import { execFileSync } from "node:child_process";

export interface BlameLine {
	line: number;
	/** Unix seconds, or `Infinity` for an uncommitted line — spec §5.2: "uncommitted changes
	 *  count as newest," so treating it as infinitely new makes the ordinary `>` comparison work
	 *  without a special case at the call site. */
	time: number;
}

const UNCOMMITTED_SHA = "0000000000000000000000000000000000000000";
const HEADER_RE = /^([0-9a-f]{40}) (\d+) (\d+)(?: \d+)?$/;

/** @prose
 * Parses `git blame --porcelain`'s text format: each line's record starts with a header
 * (`sha origLine finalLine`), and only a commit's *first* appearing line in the output carries
 * its full metadata (`author-time <unix>` among it) — every later line from the same commit
 * repeats just the header, so this keeps a `sha → author-time` cache to fill those back in.
 */
function parseBlame(output: string): BlameLine[] {
	const lines = output.split("\n");
	const timeBySha = new Map<string, number>();
	const result: BlameLine[] = [];
	let i = 0;
	while (i < lines.length) {
		const header = HEADER_RE.exec(lines[i]!);
		if (!header) {
			i++;
			continue;
		}
		const [, sha = "", , finalLineStr] = header;
		const finalLine = Number(finalLineStr);
		i++;
		while (i < lines.length && !lines[i]!.startsWith("\t")) {
			const timeMatch = /^author-time (\d+)/.exec(lines[i]!);
			if (timeMatch) timeBySha.set(sha, Number(timeMatch[1]));
			i++;
		}
		const time = sha === UNCOMMITTED_SHA ? Number.POSITIVE_INFINITY : (timeBySha.get(sha) ?? 0);
		result.push({ line: finalLine, time });
		i++; // the tab-prefixed content line itself
	}
	return result;
}

/** @prose
 * One `git blame` per file, not per chunk — a file with several chunks would otherwise re-run
 * the same blame that many times. Returns `null` rather than throwing when the file isn't
 * tracked yet or there's no git repo at all: a brand-new, all-uncommitted file has nothing
 * meaningful to compare against, and the staleness check (§5.2) treats "can't tell" as "don't
 * flag," not as an error.
 */
export function blameFile(root: string, relPath: string): BlameLine[] | null {
	try {
		const output = execFileSync("git", ["blame", "--porcelain", "--", relPath], {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return parseBlame(output);
	} catch {
		return null;
	}
}

/** The newest (largest) timestamp among blame lines within `[startLine, endLine]`, or `0` if the
 *  range is empty — `0` compares as "oldest possible," so a missing range never looks stale. */
export function newestTime(blame: BlameLine[], startLine: number, endLine: number): number {
	let max = 0;
	for (const { line, time } of blame) {
		if (line >= startLine && line <= endLine) max = Math.max(max, time);
	}
	return max;
}

/** @prose
 * # Ignoring reformats (spec §5.2)
 *
 * Planned. Run blame with `-w`, and pass `.git-blame-ignore-revs` when the repo has one, so a
 * whitespace-only reformat neither flags a chunk as stale nor clears it.
 */
