/** @prose
 * # Command tests
 *
 * What the command promises a script or CI: the exit codes, which stream each line goes to, the
 * summary by code, the line that names `prose rules`, and the count it always ends with. Each runs the built command on a small
 * repository, so the file builds it first.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const cli = resolve("dist/cli.js");
const roots: string[] = [];
beforeAll(() => void execFileSync("pnpm", ["run", "build"], { stdio: "ignore" }), 60_000);
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

/** A repository of `files`, in a fresh folder. */
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "prose-cli-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

function run(cwd: string, ...args: string[]) {
  const { status, stdout, stderr } = spawnSync("node", [cli, ...args], { cwd, encoding: "utf8" });
  return { status, out: stdout.trim().split("\n"), err: stderr.trim().split("\n") };
}

const clean = { "README.md": "# Demo\n\nA demo.\n" };
const wrong = {
  "README.md": "# Demo\n\nSee [a][1].\n\n[1]: a.md\n",
  "a.md": "# A\n\nText.\n",
  "src/a.ts": "export const a = 1;\n",
};
const joined = {
  "README.md":
    "# Demo\n\nOne idea; another.\n\nTwo ideas; more.\n\nIt never throws: it keeps going.\n",
};

describe("prose check", () => {
  it("passes clean text, with the count on stdout", () => {
    const { status, out, err } = run(repo(clean), "check");
    expect(status).toBe(0);
    expect(out).toEqual(["prose: 1 file checked"]);
    expect(err).toEqual([""]);
  });

  it("fails on a warning, and ends on stderr with a summary by code and the count", () => {
    const { status, out, err } = run(repo(wrong), "check");
    expect(status).toBe(1);
    expect(out).toEqual([""]);
    expect(err.slice(-3)).toEqual([
      "prose: by code: reference-link 2, no-prose 1, no-readme 1",
      "prose: `prose rules <code>` says what a code asks for",
      "prose: 4 warnings in 2 files and 1 folder, of 3 files checked",
    ]);
    expect(err.slice(0, -3).every((line) => line.startsWith("prose: warning: "))).toBe(true);
  });

  it("gives one warning no summary", () => {
    const { err } = run(repo({ "README.md": "# Demo\n\nA demo.\n", "src/a.md": "# A\n" }), "check");
    expect(err).toEqual([
      "prose: warning: src/: no-readme: folder with no `README.md`; write a `README.md` that says what lives there",
      "prose: `prose rules <code>` says what a code asks for",
      "prose: 1 warning in 1 folder, of 2 files checked",
    ]);
  });
});

describe("prose style", () => {
  it("passes with its advice on stdout, a summary by code and the count", () => {
    const { status, out, err } = run(repo(joined), "style");
    expect(status).toBe(0);
    expect(out).toEqual([
      "prose: style: README.md:3:9: joining-semicolon: semicolon joining two ideas; write two sentences",
      "prose: style: README.md:5:10: joining-semicolon: semicolon joining two ideas; write two sentences",
      "prose: style: README.md:7:16: joining-colon: colon joining two ideas; write two sentences",
      "prose: by code: joining-semicolon 2, joining-colon 1",
      "prose: `prose rules <code>` says what a code asks for",
      "prose: 3 suggestions in 1 file, of 1 file read",
    ]);
    expect(err).toEqual([""]);
  });

  it("names a path that holds nothing it reads, so a typo isn't clean", () => {
    const { status, out, err } = run(repo(clean), "style", "nope");
    expect(status).toBe(0);
    expect(err).toEqual(["prose: nope: no file prose reads"]);
    expect(out).toEqual(["prose: no suggestions, of 0 files read"]);
  });

  it("exits quietly when the reader stops early", () => {
    const many = Array.from({ length: 2000 }, (_, i) => `Idea ${i}; another.\n`).join("\n");
    const root = repo({ "README.md": `# Demo\n\n${many}` });
    const { status, stdout, stderr } = spawnSync(
      "bash",
      ["-c", `node "${cli}" style | head -1; exit "\${PIPESTATUS[0]}"`],
      { cwd: root, encoding: "utf8" },
    );
    expect(stdout).toMatch(/^prose: style: README\.md:3:\d+: joining-semicolon: /);
    expect(stderr).toBe("");
    expect(status).toBe(0);
  });
});

describe("prose rules", () => {
  it("prints the agent rules under their groups, each with the codes that check it", () => {
    const { status, out } = run(repo(clean), "rules");
    expect(status).toBe(0);
    expect(out.slice(0, 4)).toEqual([
      "## Where prose goes",
      "",
      expect.stringMatching(
        /^- \*\*Every file\.\*\* Every source file opens with a `@prose` comment/,
      ),
      "  Checked by `no-prose` and `no-readme`.",
    ]);
    expect(out).toContain("## Keeping it true");
    expect(out).toContain("  Checked by markz's warnings, `heading-skip` and `marker-line`.");
  });

  it("prints one code's row, then the rule it serves", () => {
    const out = run(repo(clean), "rules", "joining-semicolon").out;
    expect(out.slice(0, 3)).toEqual([
      "joining-semicolon (style): a semicolon joins two ideas",
      "  https://prose.amitkaps.com/docs/usage.md#joining-semicolon",
      "",
    ]);
    expect(out[3]).toMatch(/^- \*\*Plain sentences\.\*\* /);
  });

  it("prints a build code's row alone, since it serves no rule", () => {
    expect(run(repo(clean), "rules", "uncommitted-changes").out).toEqual([
      "uncommitted-changes (warning): the build leaves out uncommitted changes",
      "  https://prose.amitkaps.com/docs/usage.md#uncommitted-changes",
    ]);
  });

  it("prints a markz code's text, its rule in markz's syntax, and the rule it serves", () => {
    const out = run(repo(clean), "rules", "reference-link").out;
    expect(out.slice(0, 3)).toEqual([
      "reference-link (markz): reference link; write inline links",
      "  https://markz.amitkaps.com/docs/syntax.md#reference-link",
      "",
    ]);
    expect(out[3]).toMatch(/^- \*\*markz's Markdown\.\*\* /);
  });

  it("fails on a code neither gives", () => {
    const { status, err } = run(repo(clean), "rules", "nope");
    expect(status).toBe(1);
    expect(err[0]).toBe("prose: nope isn't a code prose or markz gives");
  });
});

describe("flags", () => {
  it("prints help and the version", () => {
    const root = repo(clean);
    expect(run(root, "--help").out[0]).toBe("Usage: prose [dir] [options]");
    expect(run(root, "--version").out[0]).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("fails on an unknown option or a bad port, with the reason", () => {
    const root = repo(clean);
    const unknown = run(root, "--nope");
    expect(unknown.status).toBe(1);
    expect(unknown.err[0]).toBe("prose: Unknown option --nope");
    const port = run(root, "--port", "x");
    expect(port.status).toBe(1);
    expect(port.err[0]).toBe("prose: --port needs a number from 0 to 65535, not x");
  });
});
