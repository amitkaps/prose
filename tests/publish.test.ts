import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { publish } from "../src/publish.js";

let root: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

/** The files on a branch, and one file's text. */
const onBranch = (ref = "prose") => git("ls-tree", "-r", "--name-only", ref).split("\n");
const show = (path: string, ref = "prose") => git("show", `${ref}:${path}`);

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "prose-publish-repo-"));
  const files: Record<string, string> = {
    ".gitignore": ".prose/\n",
    "README.md": "# Demo\n",
    "src/a.ts": "/** @prose\n * Does a.\n */\nexport const a = 1;\n",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  git("init", "-q", "-b", "main");
  git("config", "user.name", "t");
  git("config", "user.email", "t@t");
  git("add", "-A");
  git("commit", "-q", "-m", "first");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("publish", () => {
  it("commits the site to an orphan branch, leaving the checkout alone", async () => {
    writeFileSync(join(root, "scratch.ts"), "export const s = 1;\n");
    const head = git("rev-parse", "HEAD");
    const status = git("status", "--porcelain");
    const done = await publish(root);
    expect(done).toMatchObject({ branch: "prose", changed: true, domain: null });
    expect(git("rev-parse", "prose")).toBe(done.commit);
    expect(git("rev-list", "--count", "prose")).toBe("1");
    expect(onBranch().sort()).toEqual(
      [
        ".gitignore.html",
        ".nojekyll",
        "404.html",
        "README.md.html",
        "index.html",
        "src/a.ts.html",
        "src/index.html",
      ].sort(),
    );
    expect(show("src/a.ts.html")).toContain("Does a.");
    expect(git("log", "-1", "--format=%B", "prose")).toContain(`Built from ${head}.`);
    // The checkout: same branch, same commit, same changes, and the index untouched.
    expect(git("symbolic-ref", "--short", "HEAD")).toBe("main");
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("status", "--porcelain")).toBe(status);
    rmSync(join(root, "scratch.ts"));
  });

  it("makes no commit when nothing changed, and one on top when something did", async () => {
    const before = git("rev-parse", "prose");
    const same = await publish(root);
    expect(same).toMatchObject({ changed: false, commit: before });
    writeFileSync(
      join(root, "src/a.ts"),
      "/** @prose\n * Does a, now.\n */\nexport const a = 2;\n",
    );
    git("commit", "-q", "-am", "second");
    const next = await publish(root);
    expect(next.changed).toBe(true);
    expect(git("rev-parse", "prose^")).toBe(before);
    expect(git("diff", "--name-only", "prose^", "prose").split("\n")).toContain("src/a.ts.html");
  });

  it("writes a domain once and carries it forward, until it's replaced or dropped", async () => {
    expect((await publish(root, { domain: "docs.example.com" })).domain).toBe("docs.example.com");
    expect(show("CNAME")).toBe("docs.example.com");
    writeFileSync(join(root, "README.md"), "# Demo, again\n");
    git("commit", "-q", "-am", "third");
    expect((await publish(root)).domain).toBe("docs.example.com");
    expect(show("CNAME")).toBe("docs.example.com");
    await publish(root, { domain: "read.example.com" });
    expect(show("CNAME")).toBe("read.example.com");
    await publish(root, { domain: null });
    expect(onBranch()).not.toContain("CNAME");
  });

  it("publishes to another branch, and refuses a checked-out branch or a bad domain", async () => {
    await publish(root, { branch: "gh-pages" });
    expect(onBranch("gh-pages")).toContain("index.html");
    await expect(publish(root, { branch: "main" })).rejects.toThrow("is checked out");
    await expect(publish(root, { branch: "a..b" })).rejects.toThrow("valid branch name");
    await expect(publish(root, { domain: "https://x.com/" })).rejects.toThrow("isn't a domain");
  });
});
