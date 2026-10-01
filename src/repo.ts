/** @prose
 * # Where the repository lives
 *
 * The GitHub address of a repository, read from its `origin` remote, so a page can link to the
 * repository, a commit and a tag. A repository with no GitHub remote has none, and the page
 * leaves the links out.
 */
import { execFileSync } from "node:child_process";

/** `git@github.com:user/repo.git`, `ssh://git@github.com/user/repo.git` and
 *  `https://github.com/user/repo.git` are all `https://github.com/user/repo`. */
export function githubUrl(remote: string): string | undefined {
  const match =
    /^(?:git@github\.com:|(?:ssh:\/\/git@|https?:\/\/(?:[^@/]+@)?)github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(
      remote.trim(),
    );
  return match ? `https://github.com/${match[1]}` : undefined;
}

const known = new Map<string, string | undefined>();

/** The repository's GitHub address, asked of git once per folder. */
export function repoUrl(root: string): string | undefined {
  if (!known.has(root)) {
    let url: string | undefined;
    try {
      url = githubUrl(
        execFileSync("git", ["remote", "get-url", "origin"], {
          cwd: root,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
    } catch {
      url = undefined;
    }
    known.set(root, url);
  }
  return known.get(root);
}
