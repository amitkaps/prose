/** @prose
 * # `prose publish`
 *
 * `prose build`, committed to a branch a host deploys from: `prose` by default, an orphan branch
 * holding only the site, as plain files with nothing for any one host in them. It never touches
 * the working tree, the index or `HEAD`, and it doesn't push, so nothing leaves the machine unasked.
 *
 * The pages go through a temporary index into `git write-tree`, `git commit-tree` puts the tree
 * on the branch's last commit, and `git update-ref` moves the branch, only if it's still where it
 * was read. A build is byte-identical for the same commit, so a publish commit holds only the
 * pages that changed, and a publish that changes nothing makes no commit.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, type Built } from "./build.js";

export interface PublishOptions {
  /** The branch to commit the site to; `prose` by default. */
  branch?: string;
}

export interface Published {
  branch: string;
  /** The branch's commit after publishing; the previous one when nothing changed. */
  commit: string;
  changed: boolean;
  built: Built;
}

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: env ? { ...process.env, ...env } : undefined,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(cwd: string, args: string[]): string | null {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
}

export async function publish(dir: string, options: PublishOptions = {}): Promise<Published> {
  const root = resolve(dir);
  const branch = options.branch ?? "prose";
  if (tryGit(root, ["check-ref-format", "--branch", branch]) === null) {
    throw new Error(`${branch} isn't a valid branch name`);
  }
  if (tryGit(root, ["symbolic-ref", "--short", "-q", "HEAD"]) === branch) {
    throw new Error(`${branch} is checked out; publish to it from another branch`);
  }

  const ref = `refs/heads/${branch}`;
  const parent = tryGit(root, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]);

  const temp = mkdtempSync(join(tmpdir(), "prose-publish-"));
  try {
    const built = await build(root, { out: join(temp, "site") });
    // The build's marker only guards a local folder; the site itself is just the pages.
    rmSync(join(built.out, ".prose-build"));

    const gitDir = git(root, ["rev-parse", "--absolute-git-dir"]);
    const env = { GIT_INDEX_FILE: join(temp, "index") };
    // `-f`: a page named like an ignored file (`.env.html` under a global ignore) is still a page.
    git(built.out, [`--git-dir=${gitDir}`, `--work-tree=${built.out}`, "add", "-A", "-f"], env);
    const tree = git(built.out, [`--git-dir=${gitDir}`, "write-tree"], env);

    if (parent && git(root, ["rev-parse", `${parent}^{tree}`]) === tree) {
      return { branch, commit: parent, changed: false, built };
    }
    const source = git(root, ["rev-parse", "HEAD"]);
    const message = `prose ${built.version}\n\nBuilt from ${source}.\n`;
    const commit = git(root, [
      "commit-tree",
      tree,
      ...(parent ? ["-p", parent] : []),
      "-m",
      message,
    ]);
    // The old value makes the move conditional: if the branch moved meanwhile, this fails.
    git(root, ["update-ref", "-m", "prose publish", ref, commit, parent ?? ""]);
    return { branch, commit, changed: true, built };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
