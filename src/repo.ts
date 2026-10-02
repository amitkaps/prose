/** @prose
 * # Where the repository lives
 *
 * The repository's name and GitHub address, read from its `origin` remote. The name is the
 * project's on every page; the address lets a page link to the repository, a commit and a tag.
 *
 * The name comes from the remote, not the folder, because a host builds in a checkout folder of
 * its own (Cloudflare's is `repo`). With no remote, or for a subfolder, the folder's name stands in, and with no
 * GitHub remote the page leaves the links out.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";

/** `git@github.com:user/repo.git`, `ssh://git@github.com/user/repo.git` and
 *  `https://github.com/user/repo.git` are all `https://github.com/user/repo`. */
export function githubUrl(remote: string): string | undefined {
  const match =
    /^(?:git@github\.com:|(?:ssh:\/\/git@|https?:\/\/(?:[^@/]+@)?)github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(
      remote.trim(),
    );
  return match ? `https://github.com/${match[1]}` : undefined;
}

/** The repository's name from any remote: its last path segment, without `.git`. */
export function remoteName(remote: string): string | undefined {
  return /([^/:\s]+?)(?:\.git)?\/?$/.exec(remote.trim())?.[1];
}

const origins = new Map<string, string | undefined>();

/** The `origin` remote, asked of git once per folder. */
function origin(root: string): string | undefined {
  if (!origins.has(root)) {
    let remote: string | undefined;
    try {
      remote = execFileSync("git", ["remote", "get-url", "origin"], {
        cwd: root,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      remote = undefined;
    }
    origins.set(root, remote);
  }
  return origins.get(root);
}

/** The repository's GitHub address, if `origin` is on GitHub. */
export function repoUrl(root: string): string | undefined {
  const remote = origin(root);
  return remote ? githubUrl(remote) : undefined;
}

/** The project's name: the `origin` repository's, or the folder's when there's no remote or the
 *  project is a subfolder (`prose tests/fixtures/simple` is `simple`). */
export function projectName(root: string): string {
  const folder = basename(resolve(root));
  const remote = origin(root);
  if (!remote) return folder;
  let top: string;
  try {
    top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return folder;
  }
  return realpathSync(top) === realpathSync(root) ? (remoteName(remote) ?? folder) : folder;
}
