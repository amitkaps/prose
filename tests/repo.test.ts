/** @prose
 * # Repository and footer tests
 *
 * A GitHub address from every spelling of a remote, and none from any other host; and the rail's
 * footer: Live locally, a snapshot with its commit and, only when given one, its tag.
 */
import { describe, expect, it } from "vite-plus/test";
import { railFooter } from "../src/rail.js";
import { githubUrl } from "../src/repo.js";

describe("githubUrl", () => {
  it("reads ssh, scp-style and https remotes, with or without .git", () => {
    for (const remote of [
      "git@github.com:amitkaps/prose.git",
      "ssh://git@github.com/amitkaps/prose.git",
      "https://github.com/amitkaps/prose.git",
      "https://github.com/amitkaps/prose",
      "https://token@github.com/amitkaps/prose.git\n",
    ]) {
      expect(githubUrl(remote)).toBe("https://github.com/amitkaps/prose");
    }
  });

  it("has none for another host", () => {
    expect(githubUrl("git@gitlab.com:amitkaps/prose.git")).toBeUndefined();
    expect(githubUrl("/some/local/path")).toBeUndefined();
  });
});

describe("railFooter", () => {
  const repo = "https://github.com/amitkaps/prose";

  it("says Live locally, with the repository mark", () => {
    const html = railFooter({ live: true, repo });
    expect(html).toContain("Live");
    expect(html).toContain(`href="${repo}"`);
    expect(html).not.toContain("Snapshot");
  });

  it("names the commit, and the tag only when there is one", () => {
    const plain = railFooter({ live: false, snapshot: { commit: "abc1234" }, repo });
    expect(plain).toContain(`${repo}/commit/abc1234`);
    expect(plain).not.toContain("releases/tag");
    const tagged = railFooter({
      live: false,
      snapshot: { commit: "abc1234", tag: "v0.2.0" },
      repo,
    });
    expect(tagged).toContain(`${repo}/releases/tag/v0.2.0`);
  });

  it("links nothing without a GitHub remote", () => {
    const html = railFooter({ live: false, snapshot: { commit: "abc1234" } });
    expect(html).toContain("Snapshot · abc1234");
    expect(html).not.toContain("<a ");
  });
});
